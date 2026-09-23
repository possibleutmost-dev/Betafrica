'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, Lock, Printer, RotateCw, SlidersHorizontal } from 'lucide-react'
import { GameTile } from '@/components/games-lobby'
import {
  BetslipPanel, Crest, QuickRegister, kickoffLabel, legFor, resultMarket, useFixtureFeed,
  type BoardMarket, type BoardMatch, type BoardPrice,
} from '@/components/match-board'
import { formatMoney } from '@/lib/countries'
import { useSlip } from '@/lib/store'

const SPORT_TABS = ['Football', 'vFootball', 'Basketball', 'Tennis', 'eFootball'] as const
const MORE_SPORTS = ['Table Tennis', 'Ice Hockey', 'Volleyball', 'Handball', 'Rugby', 'Cricket'] as const
type SportTab = (typeof SPORT_TABS)[number] | (typeof MORE_SPORTS)[number]

const SPORT_KEYS: Record<SportTab, string[]> = {
  Football: ['football', 'soccer'],
  vFootball: ['virtual', 'virtuals', 'vfootball'],
  Basketball: ['basketball'],
  Tennis: ['tennis'],
  eFootball: ['efootball', 'esoccer'],
  'Table Tennis': ['table-tennis', 'table tennis'],
  'Ice Hockey': ['ice-hockey', 'hockey'],
  Volleyball: ['volleyball'],
  Handball: ['handball'],
  Rugby: ['rugby'],
  Cricket: ['cricket'],
}

type Filter = { kind: 'all' } | { kind: 'today' } | { kind: 'next3h' } | { kind: 'league'; league: string }

const VIEW_TO_TAB: Record<string, SportTab> = {
  Football: 'Football',
  Basketball: 'Basketball',
  Tennis: 'Tennis',
  Virtuals: 'vFootball',
}

function ofSport(match: BoardMatch, tab: SportTab) {
  return SPORT_KEYS[tab].includes((match.sport || 'football').toLowerCase())
}

function secondMarket(match: BoardMatch) {
  return match.markets.find((market) => market.key === 'ou25') ?? match.markets.find((market) => /2\.5/.test(market.label))
}

function byLeague(matches: BoardMatch[]) {
  const groups = new Map<string, BoardMatch[]>()
  for (const match of matches) groups.set(match.league, [...(groups.get(match.league) ?? []), match])
  return [...groups.entries()]
}

export function MatchBoard({ view, onNeedAuth, onNotice }: { view: string; onNeedAuth: () => void; onNotice: (message: string) => void }) {
  const { matches, error, reload } = useFixtureFeed()
  const legs = useSlip((state) => state.legs)
  const has = useSlip((state) => state.has)
  const toggle = useSlip((state) => state.toggle)
  const [filter, setFilter] = useState<Filter>({ kind: 'all' })
  const [tab, setTab] = useState<SportTab>(VIEW_TO_TAB[view] ?? 'Football')
  const [liveTab, setLiveTab] = useState<SportTab>('Football')

  useEffect(() => setTab(VIEW_TO_TAB[view] ?? 'Football'), [view])

  const all = useMemo(() => matches ?? [], [matches])
  const leagues = useMemo(() => {
    const counts = new Map<string, number>()
    for (const match of all) counts.set(match.league, (counts.get(match.league) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name]) => name)
  }, [all])

  const highlights = useMemo(() => {
    const now = Date.now()
    const today = new Date().toDateString()
    return all.filter((match) => {
      if (match.isLive || !ofSport(match, tab)) return false
      const kickoff = new Date(match.kickoff)
      if (filter.kind === 'today') return kickoff.toDateString() === today
      if (filter.kind === 'next3h') return kickoff.getTime() - now <= 3 * 3_600_000 && kickoff.getTime() >= now
      if (filter.kind === 'league') return match.league === filter.league
      return true
    })
  }, [all, filter, tab])

  const live = useMemo(() => all.filter((match) => match.isLive && ofSport(match, liveTab)), [all, liveTab])

  const pick = (match: BoardMatch, market: BoardMarket, price: BoardPrice) => {
    const leg = legFor(match, market, price, onNotice)
    if (leg) toggle(leg)
  }

  const filterTitle = filter.kind === 'today' ? "Today's Football" : filter.kind === 'next3h' ? 'Football in Next 3 Hours' : filter.kind === 'league' ? filter.league : 'Highlights'
  const liveOnly = view === 'Live Betting'

  return (
    <>
      <section className="bg-[#181b21] text-white">
        <div className="mx-auto grid max-w-[1180px] gap-5 px-4 py-5 md:grid-cols-[230px_1fr_200px]">
          <aside className="hidden md:block">
            <h2 className="mb-2 text-xl font-bold">Popular</h2>
            <PopularLink active={filter.kind === 'today'} onClick={() => { setTab('Football'); setFilter({ kind: 'today' }) }}>Today&apos;s Football</PopularLink>
            <PopularLink active={filter.kind === 'next3h'} onClick={() => { setTab('Football'); setFilter({ kind: 'next3h' }) }}>Football in Next 3 Hours</PopularLink>
            {leagues.map((name) => (
              <PopularLink key={name} active={filter.kind === 'league' && filter.league === name} onClick={() => setFilter({ kind: 'league', league: name })}>{name}</PopularLink>
            ))}
          </aside>
          <HeroBanner onNotice={onNotice} />
          <QuickRegister onNeedAuth={onNeedAuth} onNotice={onNotice} />
        </div>
      </section>

      <section className="mx-auto grid max-w-[1180px] gap-4 px-4 py-4 md:grid-cols-[1fr_280px]">
        <div className="min-w-0 space-y-4">
          {!liveOnly && (
            <div className="border bg-white">
              <BoardHeader title={filterTitle} onRefresh={reload} dark={false}>
                {filter.kind !== 'all' && <button onClick={() => setFilter({ kind: 'all' })} className="text-xs text-[#ed1324]">Clear filter</button>}
              </BoardHeader>
              <SportTabs value={tab} onChange={setTab} dark={false} filter />
              <div className="p-3">
                {matches === null && !error && <p className="px-3 py-8 text-sm text-[#888d93]">Loading fixtures…</p>}
                {error && <p className="px-3 py-8 text-sm text-[#ed1324]">{error}</p>}
                {matches && highlights.length === 0 && <p className="px-3 py-8 text-sm text-[#888d93]">No {tab} matches in this list right now.</p>}
                {highlights.map((match) => (
                  <HighlightRow key={match.id} match={match} has={has} pick={pick} />
                ))}
              </div>
            </div>
          )}

          <div className="bg-[#1b1e24] text-white">
            <BoardHeader title="Live Betting" onRefresh={reload} dark />
            <SportTabs value={liveTab} onChange={setLiveTab} dark />
            {matches && live.length === 0 && <p className="px-4 py-8 text-sm text-white/60">No live {liveTab} matches right now.</p>}
            {byLeague(live).map(([league, rows]) => (
              <div key={league}>
                <div className="grid grid-cols-[1fr_222px_222px_56px] items-end gap-1 border-b border-white/10 px-2 pt-3 text-[11px] text-white/60 max-lg:grid-cols-[1fr_222px_40px]">
                  <p className="truncate pb-1 text-sm font-bold text-white">{league}</p>
                  <ColumnHead title="3 Way" labels={['1', 'X', '2']} />
                  <ColumnHead title="Over/Under 2.5" labels={['Over', 'Under']} className="max-lg:hidden" />
                  <span />
                </div>
                {rows.map((match) => <LiveRow key={match.id} match={match} has={has} pick={pick} />)}
              </div>
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <BetslipPanel legs={legs} onNeedAuth={onNeedAuth} onNotice={onNotice} />
          <MiniGames />
          <Link href="/virtuals" className="relative block h-44 overflow-hidden bg-[radial-gradient(circle_at_50%_40%,#ffcf00_0%,#d98a00_18%,#2a1a00_55%,#0c0c0c_100%)]">
            <span className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-4xl">⚡</span>
              <span className="text-xs font-bold italic text-white/80">SportyBet</span>
              <span className="text-3xl font-black italic leading-none text-white [text-shadow:0_3px_0_#ed1324]">INSTANT</span>
              <span className="text-3xl font-black italic leading-none text-white [text-shadow:0_3px_0_#ed1324]">VIRTUALS</span>
            </span>
          </Link>
        </aside>
      </section>
    </>
  )
}

function PopularLink({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center justify-between border-t border-white/20 py-2.5 text-left text-[15px] ${active ? 'text-[#17a24a]' : ''}`}>
      <span className="truncate pr-2">{children}</span>
      <ChevronRight size={18} className="shrink-0 text-[#17a24a]" />
    </button>
  )
}

const SLIDES = [
  { title: 'ONE CUT', sub: 'Bet on live action every second', bg: 'bg-[linear-gradient(120deg,#363a40_0%,#111319_44%,#d91524_45%,#ed1324_68%,#16191f_69%)]', art: '' },
  { title: 'VIRTUAL WORLD', sub: 'BET ON EVERY SECOND', bg: 'bg-[linear-gradient(100deg,#1b1e24_0%,#1b1e24_52%,#c8102e_53%,#ed1324_100%)]', art: '⚽🏇🐕' },
  { title: 'INSTANT GAMES', sub: 'Sky Rocket, Spin The Bottle and more', bg: 'bg-[linear-gradient(120deg,#13241a_0%,#1f3b26_50%,#0b9b3a_51%,#17a24a_100%)]', art: '🚀🍾🎰' },
]

function HeroBanner({ onNotice }: { onNotice: (message: string) => void }) {
  const [index, setIndex] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), 5000)
    return () => clearInterval(timer)
  }, [])
  const slide = SLIDES[index]
  const href = index === 1 ? '/virtuals' : index === 2 ? '/games' : null

  return (
    <div className="relative flex min-h-[235px] flex-col justify-end overflow-hidden p-7">
      <div className={`absolute inset-0 transition-all duration-700 ${slide.bg}`} />
      {slide.art && <span className="absolute right-6 top-1/2 -translate-y-1/2 text-7xl tracking-[-0.15em] drop-shadow-[0_6px_14px_rgba(0,0,0,0.5)]">{slide.art}</span>}
      <div className="relative">
        <p className="text-sm font-black italic text-white/90">SportyBet</p>
        <div className="text-4xl font-black italic text-white">{slide.title}</div>
        <p className="mb-4 text-xs font-bold text-white/80">{slide.sub}</p>
        {href
          ? <Link href={href} className="inline-block rounded-full border-2 border-white px-5 py-1 text-xs font-semibold">PLAY NOW</Link>
          : <button onClick={() => onNotice('Pick a price on the board to start a slip.')} className="rounded-full border-2 border-white px-5 py-1 text-xs font-semibold">BET NOW</button>}
      </div>
      <div className="absolute bottom-3 right-4 flex gap-1.5">
        {SLIDES.map((item, i) => <button key={item.title} onClick={() => setIndex(i)} aria-label={`Show ${item.title}`} className={`h-1.5 rounded-full ${i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`} />)}
      </div>
    </div>
  )
}

function BoardHeader({ title, onRefresh, dark, children }: { title: string; onRefresh: () => void; dark: boolean; children?: ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 pb-2 pt-4">
      <h1 className="flex items-center gap-3 text-2xl font-semibold">
        <span className="inline-block h-6 w-6 rounded-full bg-[#10a349]" />
        {title}
      </h1>
      <div className={`flex items-center gap-5 text-xs ${dark ? 'text-[#17a24a]' : 'text-[#353a45]'}`}>
        {children}
        <button onClick={() => window.print()} className="flex items-center gap-1.5"><Printer size={15} /> Print</button>
        <button onClick={onRefresh} className="flex items-center gap-1.5"><RotateCw size={15} /> Refresh</button>
      </div>
    </div>
  )
}

function SportTabs({ value, onChange, dark, filter = false }: { value: SportTab; onChange: (tab: SportTab) => void; dark: boolean; filter?: boolean }) {
  const [more, setMore] = useState(false)
  const moreActive = (MORE_SPORTS as readonly string[]).includes(value)
  const tabClass = (active: boolean) =>
    `whitespace-nowrap px-4 py-2.5 text-sm ${active ? `border-b-[3px] border-[#10a349] font-bold ${dark ? 'text-white' : 'text-[#24262c]'}` : dark ? 'text-white/80' : 'text-[#353a45]'}`
  return (
    <div className={`relative flex items-center border-b px-2 ${dark ? 'border-white/10' : ''}`}>
      {SPORT_TABS.map((item) => <button key={item} onClick={() => onChange(item)} className={tabClass(value === item)}>{item}</button>)}
      <button onClick={() => setMore((open) => !open)} className={`${tabClass(moreActive)} flex items-center gap-1`}>{moreActive ? value : 'More Sports'} <ChevronDown size={15} /></button>
      {more && (
        <div className={`absolute left-[420px] top-full z-20 w-44 py-1 shadow-lg max-md:left-2 ${dark ? 'bg-[#2a2e37]' : 'bg-white'}`}>
          {MORE_SPORTS.map((item) => (
            <button key={item} onClick={() => { onChange(item); setMore(false) }} className={`block w-full px-4 py-2 text-left text-sm ${dark ? 'hover:bg-white/10' : 'hover:bg-[#f5f6f7]'}`}>{item}</button>
          ))}
        </div>
      )}
      {filter && <span className="ml-auto hidden items-center gap-2 px-3 text-sm text-[#353a45] md:flex">Filter <SlidersHorizontal size={15} /></span>}
    </div>
  )
}

function ColumnHead({ title, labels, className = '' }: { title: string; labels: string[]; className?: string }) {
  return (
    <div className={`text-center ${className}`}>
      <p className="pb-1">{title}</p>
      <div className={`grid gap-1 bg-white/5 py-0.5 ${labels.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {labels.map((label) => <span key={label}>{label}</span>)}
      </div>
    </div>
  )
}

type PickFn = (match: BoardMatch, market: BoardMarket, price: BoardPrice) => void
type HasFn = (matchId: string, market: string, outcome: string) => boolean

function LiveRow({ match, has, pick }: { match: BoardMatch; has: HasFn; pick: PickFn }) {
  const main = resultMarket(match)
  const second = secondMarket(match)
  const extra = Math.max(0, match.markets.length - 2)
  return (
    <div className="grid grid-cols-[1fr_222px_222px_56px] items-center gap-1 border-b border-white/10 py-2 pl-0 pr-2 max-lg:grid-cols-[1fr_222px_40px]">
      <Link href={`/match/${match.id}`} className="flex min-w-0 items-center gap-3 border-l-4 border-[#10a349] pl-2">
        <div className="w-11 shrink-0 text-xs font-bold">
          <p>{match.minuteLabel || 'LIVE'}</p>
          <p className="font-normal text-white/60">{match.postponed ? 'PP' : 'Live'}</p>
        </div>
        <div className="min-w-0 flex-1 text-sm text-[#17a24a]">
          <p className="flex items-center gap-2 truncate"><Crest src={match.homeCrest} name={match.homeTeam} size={16} />{match.homeTeam}</p>
          <p className="flex items-center gap-2 truncate"><Crest src={match.awayCrest} name={match.awayTeam} size={16} />{match.awayTeam}</p>
        </div>
        <div className="shrink-0 text-right text-sm font-bold">
          <p>{match.scoreHome ?? 0}</p>
          <p>{match.scoreAway ?? 0}</p>
        </div>
      </Link>
      <OddsCells match={match} market={main} count={3} has={has} pick={pick} />
      <div className="max-lg:hidden"><OddsCells match={match} market={second} count={2} has={has} pick={pick} /></div>
      <Link href={`/match/${match.id}`} className="flex items-center justify-end gap-1 text-xs font-bold text-white/80">+{extra} <ChevronRight size={14} className="text-[#17a24a]" /></Link>
    </div>
  )
}

function OddsCells({ match, market, count, has, pick }: { match: BoardMatch; market?: BoardMarket; count: number; has: HasFn; pick: PickFn }) {
  const prices = market?.prices.slice(0, count) ?? []
  return (
    <div className={`grid gap-1 ${count === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {Array.from({ length: count }, (_, i) => {
        const price = prices[i]
        if (!price || !market || match.isLocked || match.postponed) {
          return <span key={i} className="flex h-10 items-center justify-center bg-[#3d424d] text-white/60"><Lock size={14} /></span>
        }
        const selected = has(match.id, market.key, price.outcome)
        return (
          <button key={price.outcome} onClick={() => pick(match, market, price)} className={`h-10 text-sm font-bold ${selected ? 'bg-[#ffcf00] text-[#1f1f1f]' : 'bg-[#0b9b3a] text-white hover:bg-[#10a349]'}`}>
            {price.odds.toFixed(2)}
          </button>
        )
      })}
    </div>
  )
}

function HighlightRow({ match, has, pick }: { match: BoardMatch; has: HasFn; pick: PickFn }) {
  const main = resultMarket(match)
  const second = secondMarket(match)
  return (
    <div className="mb-2 overflow-hidden border">
      <div className="flex justify-between bg-[#f5f6f7] px-3 py-1.5 text-xs text-[#70747a]">
        <span className="truncate">{match.league}</span>
        <span className="shrink-0">{kickoffLabel(match)}</span>
      </div>
      <div className="grid grid-cols-[1fr_210px_150px_50px] items-center gap-2 px-3 py-2 max-lg:grid-cols-[1fr_210px_40px]">
        <Link href={`/match/${match.id}`} className="min-w-0 space-y-1 text-sm">
          <span className="flex items-center gap-2 truncate"><Crest src={match.homeCrest} name={match.homeTeam} /><strong>{match.homeTeam}</strong></span>
          <span className="flex items-center gap-2 truncate text-[#73777d]"><Crest src={match.awayCrest} name={match.awayTeam} />{match.awayTeam}</span>
        </Link>
        <LightOdds match={match} market={main} count={3} has={has} pick={pick} />
        <div className="max-lg:hidden"><LightOdds match={match} market={second} count={2} has={has} pick={pick} /></div>
        <Link href={`/match/${match.id}`} className="flex items-center justify-end text-xs font-semibold text-[#6b7077]">+{Math.max(0, match.markets.length - 2)} <ChevronRight size={14} className="text-[#10a349]" /></Link>
      </div>
    </div>
  )
}

function LightOdds({ match, market, count, has, pick }: { match: BoardMatch; market?: BoardMarket; count: number; has: HasFn; pick: PickFn }) {
  const prices = market?.prices.slice(0, count) ?? []
  return (
    <div className={`grid gap-1 ${count === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {Array.from({ length: count }, (_, i) => {
        const price = prices[i]
        if (!price || !market || match.isLocked || match.postponed) {
          return <span key={i} className="flex h-10 items-center justify-center border bg-[#f1f2f4] text-[#b0b3b8]"><Lock size={13} /></span>
        }
        const selected = has(match.id, market.key, price.outcome)
        return (
          <button key={price.outcome} onClick={() => pick(match, market, price)} className={`h-10 border text-sm font-semibold ${selected ? 'border-[#10a349] bg-[#10a349] text-white' : 'bg-[#f8f9fa] hover:border-[#10a349]'}`}>
            <span className="block text-[9px] font-normal leading-none opacity-70">{price.outcome}</span>
            {price.odds.toFixed(2)}
          </button>
        )
      })}
    </div>
  )
}

type Win = { code: string; amount: number; currency: string; name: string }

function MiniGames() {
  const [win, setWin] = useState<Win | null>(null)
  useEffect(() => {
    fetch('/api/wins/top').then((res) => res.json()).then((json) => setWin(json.wins?.[0] ?? null)).catch(() => {})
  }, [])
  return (
    <div className="bg-[#2a2e37] text-white">
      <h2 className="py-2 text-center text-sm font-bold">Mini Games</h2>
      <p className="truncate bg-[#1d5f36] px-3 py-1 text-center text-[11px]">
        {win ? <>{win.name} won <b className="text-[#ffcf00]">{formatMoney(win.amount, win.currency)}</b> today</> : 'Instant games, paid straight to your balance'}
      </p>
      <div className="grid grid-cols-2 gap-2 p-2">
        {['spin-the-bottle', 'sky-rocket', 'roulette-royale', 'fruit-party'].map((slug) => <GameTile key={slug} slug={slug} compact />)}
      </div>
      <Link href="/games" className="flex items-center justify-between bg-[#ffb400] px-3 py-2 text-xs font-bold text-[#1f1f1f]">Discover more games <ChevronRight size={15} /></Link>
    </div>
  )
}
