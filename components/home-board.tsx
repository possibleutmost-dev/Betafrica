'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, ExternalLink, Lock, Printer, RotateCw, SlidersHorizontal } from 'lucide-react'
import { CASINO_GAMES } from '@/lib/casino-catalog'
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

type Filter = { kind: 'all' } | { kind: 'today' } | { kind: 'next3h' } | { kind: 'league'; league: string; test: RegExp }

const POPULAR_LEAGUES: { label: string; test: RegExp }[] = [
  { label: 'AFCON Qualifiers', test: /africa cup of nations|afcon/i },
  { label: 'UEFA Nations League', test: /nations league/i },
  { label: 'International Friendlies', test: /friendl/i },
  { label: 'England Premier League', test: /^premier league$|england premier league|english premier league/i },
]

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

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
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name)
      .filter((name) => !POPULAR_LEAGUES.some((item) => item.test.test(name)))
      .slice(0, 3)
  }, [all])

  const highlights = useMemo(() => {
    const now = Date.now()
    const today = new Date().toDateString()
    return all.filter((match) => {
      if (match.isLive || !ofSport(match, tab)) return false
      const kickoff = new Date(match.kickoff)
      if (filter.kind === 'today') return kickoff.toDateString() === today
      if (filter.kind === 'next3h') return kickoff.getTime() - now <= 3 * 3_600_000 && kickoff.getTime() >= now
      if (filter.kind === 'league') return filter.test.test(match.league)
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
            {[...POPULAR_LEAGUES, ...leagues.map((name) => ({ label: name, test: new RegExp(`^${escape(name)}$`) }))].map((item) => (
              <PopularLink key={item.label} active={filter.kind === 'league' && filter.league === item.label} onClick={() => setFilter({ kind: 'league', league: item.label, test: item.test })}>{item.label}</PopularLink>
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
              <VirtualWorldBanner />
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
                <div className={`${LIVE_GRID} items-end border-b border-white/10 px-2 pt-3 text-[11px] text-white/60`}>
                  <p className="truncate pb-1 text-sm font-bold text-white">{league}</p>
                  <ColumnHead title="3 Way" labels={['1', 'X', '2']} />
                  <ColumnHead title="Next Goals" labels={['1', 'No Goal', '2']} className="max-lg:hidden pl-[48px]" />
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
          <Link href="/virtuals" className="relative block h-44 overflow-hidden bg-[#0c0c0c]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/banners/instant-virtuals.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_55%,rgba(255,180,0,0.35),rgba(0,0,0,0.55)_70%)]" />
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
  { title: 'ONE CUT', sub: 'Bet on live action every second', bg: 'bg-[#111319]', image: '/banners/hero-football.jpg', art: '' },
  { title: 'VIRTUAL WORLD', sub: 'BET ON EVERY SECOND', bg: 'bg-[#1b1e24]', image: '/banners/virtual-world.jpg', art: '' },
  { title: 'INSTANT GAMES', sub: 'Sky Rocket, Spin The Bottle and more', bg: 'bg-[linear-gradient(120deg,#13241a_0%,#1f3b26_50%,#0b9b3a_51%,#17a24a_100%)]', image: '', art: '🚀🍾🎰' },
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
      {slide.image && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={slide.image} src={slide.image} alt="" className="absolute inset-0 h-full w-full object-cover object-right" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/35 to-transparent" />
        </>
      )}
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

const LIVE_GRID = 'grid grid-cols-[1fr_222px_270px_56px] gap-1 max-lg:grid-cols-[1fr_222px_40px]'

const NEXT_GOAL = /next goal|score the \d+(st|nd|rd|th) goal|^goal \d+$/i

function halfLabel(match: BoardMatch) {
  const label = (match.minuteLabel || '').toUpperCase()
  if (label.includes('HT')) return 'HT'
  const minute = parseInt(label, 10)
  if (!Number.isFinite(minute)) return 'Live'
  return minute <= 45 ? 'H1' : 'H2'
}

function nextGoalMarkets(match: BoardMatch) {
  return match.markets.filter((market) => NEXT_GOAL.test(market.label))
}

function LiveRow({ match, has, pick }: { match: BoardMatch; has: HasFn; pick: PickFn }) {
  const main = resultMarket(match)
  const goalMarkets = nextGoalMarkets(match)
  const scored = (match.scoreHome ?? 0) + (match.scoreAway ?? 0)
  const [goalIndex, setGoalIndex] = useState(0)
  const [pickerOpen, setPickerOpen] = useState(false)
  const nextGoal = goalMarkets[goalIndex]
  const goalNumber = goalMarkets.length ? (Number(nextGoal?.label.match(/\d+/)?.[0]) || scored + 1) : scored + 1
  const extra = Math.max(0, match.markets.length - 2)

  return (
    <div className={`${LIVE_GRID} items-center border-b border-white/10 py-2 pl-0 pr-2`}>
      <Link href={`/match/${match.id}`} className="flex min-w-0 items-center gap-3 border-l-4 border-[#10a349] pl-2">
        <div className="w-11 shrink-0 text-xs font-bold">
          <p>{match.minuteLabel || 'LIVE'}</p>
          <p className="font-normal text-white/60">{match.postponed ? 'PP' : halfLabel(match)}</p>
        </div>
        <div className="min-w-0 flex-1 text-sm text-[#17a24a]">
          <p className="truncate">{match.homeTeam}</p>
          <p className="truncate">{match.awayTeam}</p>
        </div>
        <div className="shrink-0 text-right text-sm font-bold">
          <p>{match.scoreHome ?? 0}</p>
          <p>{match.scoreAway ?? 0}</p>
        </div>
      </Link>
      <OddsCells match={match} market={main} count={3} has={has} pick={pick} />
      <div className="relative flex gap-1 max-lg:hidden">
        <button
          onClick={() => goalMarkets.length > 1 && setPickerOpen((open) => !open)}
          className="flex h-10 w-[44px] shrink-0 items-center justify-center gap-1 bg-[#0b9b3a] text-sm font-bold"
          aria-label="Choose goal number"
        >
          {goalNumber} <ChevronDown size={13} />
        </button>
        {pickerOpen && (
          <div className="absolute left-0 top-11 z-20 w-[44px] bg-[#2a2e37] shadow-lg">
            {goalMarkets.map((market, i) => (
              <button key={market.key} onClick={() => { setGoalIndex(i); setPickerOpen(false) }} className="block w-full py-1.5 text-sm hover:bg-white/10">
                {Number(market.label.match(/\d+/)?.[0]) || scored + 1 + i}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1"><OddsCells match={match} market={nextGoal} count={3} has={has} pick={pick} /></div>
      </div>
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
        {['spin-the-bottle', 'sky-rocket', 'roulette-royale'].map((slug) => {
          const game = CASINO_GAMES.find((item) => item.slug === slug)!
          return (
            <Link key={slug} href={`/games/${slug}`} className="group block overflow-hidden rounded">
              <div className={`relative flex aspect-[4/3] items-center justify-center bg-gradient-to-br ${game.art}`}>
                <span className="text-5xl drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)] transition-transform group-hover:scale-110">{game.glyph}</span>              </div>
              <p className="bg-[#353a45] py-1 text-center text-xs">{game.name}</p>
            </Link>
          )
        })}
        <div className="flex flex-col items-center justify-center rounded bg-[#353a45]/60 text-center text-xs text-white/60">
          <span className="text-4xl opacity-40">🎲</span>
          New Games
          <br />
          Coming Soon
        </div>
      </div>
      <Link href="/games" className="flex items-center justify-between bg-[#1f2229] pl-0 pr-3 text-xs">
        <span className="bg-[#ffb400] px-3 py-2 font-bold text-[#1f1f1f]">Discover more games</span>
        <ExternalLink size={15} />
      </Link>
    </div>
  )
}

function VirtualWorldBanner() {
  return (
    <Link href="/virtuals" className="relative flex h-24 items-center overflow-hidden bg-[#1b1e24]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/banners/virtual-world.jpg" alt="" className="absolute inset-y-0 right-0 h-full w-[62%] object-cover object-[center_35%]" />
      <div className="absolute inset-y-0 left-[38%] w-24 bg-gradient-to-r from-[#1b1e24] to-transparent" />
      <span className="relative flex items-center gap-4 pl-6">
        <span className="text-3xl font-black italic text-white">SportyBet</span>
        <span className="h-12 w-px bg-white/40" />
        <span className="leading-tight">
          <span className="block text-2xl font-black italic text-[#ed1324]">VIRTUAL WORLD</span>
          <span className="block text-2xl font-black italic text-white">BET ON EVERY SECOND</span>
        </span>
      </span>
    </Link>
  )
}
