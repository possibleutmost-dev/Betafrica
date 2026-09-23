'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Coins, Crown, Dices, Flame, Gem, LayoutGrid, Rocket, Search, Sparkles, Trophy as TrophyIcon, Users, Zap, type LucideIcon } from 'lucide-react'
import { CASINO_GAMES } from '@/lib/casino-catalog'
import { formatMoney } from '@/lib/countries'

const CATEGORIES: { key: string; label: string; icon: LucideIcon }[] = [
  { key: 'all', label: 'All Games', icon: LayoutGrid },
  { key: 'popular', label: 'Popular', icon: Flame },
  { key: 'crash', label: 'Crash', icon: Rocket },
  { key: 'quick', label: 'Quick', icon: Zap },
  { key: 'new', label: 'New', icon: Sparkles },
  { key: 'wheel', label: 'Wheel', icon: Coins },
  { key: 'slots', label: 'Slots', icon: Gem },
  { key: 'dice', label: 'Dice', icon: Dices },
  { key: 'table', label: 'Table', icon: Crown },
  { key: 'multiplayer', label: 'Multiplayer', icon: Users },
]

const BADGE_STYLE = {
  POPULAR: 'bg-[#ed1324]',
  NEW: 'bg-[#0b9b3a]',
  EXCLUSIVE: 'bg-[#1f1f1f] ring-1 ring-[#ffcf00] text-[#ffcf00]',
}

type Win = { code: string; amount: number; currency: string; name: string }

export function GamesLobby({ initialCategory = 'all' }: { initialCategory?: string }) {
  const [category, setCategory] = useState(initialCategory)
  const [query, setQuery] = useState('')
  const [wins, setWins] = useState<Win[]>([])

  useEffect(() => {
    fetch('/api/wins/top').then((res) => res.json()).then((json) => setWins(json.wins ?? [])).catch(() => {})
  }, [])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return CASINO_GAMES.filter((game) =>
      (category === 'all' || game.categories.includes(category)) &&
      (!q || game.name.toLowerCase().includes(q) || game.tagline.toLowerCase().includes(q)),
    )
  }, [category, query])

  const title = CATEGORIES.find((item) => item.key === category)?.label ?? 'All Games'

  return (
    <div className="games-felt min-h-[calc(100vh-120px)] py-5">
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-3 px-3 sm:px-4 md:grid-cols-[180px_minmax(0,1fr)]">
        <aside className="min-w-0 self-start overflow-hidden bg-[#353a45] text-white">
          <nav className="scrollbar-none -mb-5 flex overflow-x-auto pb-5 md:mb-0 md:flex-col md:pb-0">
            {CATEGORIES.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setCategory(key)}
                className={`flex shrink-0 items-center gap-3 px-3 py-3 text-left text-xs font-semibold ${category === key ? 'bg-[#0b9b3a]' : 'hover:bg-white/10'}`}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 space-y-3">
          <div className="overflow-hidden border border-[#b8892c] bg-[linear-gradient(90deg,#1c1506,#3b2a07_50%,#1c1506)] p-3 text-white">
            <h2 className="mb-2 text-sm font-bold">Top Wins Today</h2>
            {wins.length ? (
              <div className="scrollbar-none -mb-5 flex gap-3 overflow-x-auto pb-5">
                {wins.map((win) => (
                  <div key={win.code} className="flex shrink-0 items-center gap-3 border border-white/20 bg-black/40 px-3 py-2">
                    <TrophyIcon size={22} className="text-[#ffcf00]" />
                    <div>
                      <p className="text-sm font-black text-[#ffcf00]">{formatMoney(win.amount, win.currency)}</p>
                      <p className="text-[11px] text-white/70">{win.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-white/60">No wins settled yet today. Yours could be the first.</p>
            )}
          </div>

          <div className="bg-[#353a45] p-3 sm:p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-lg font-bold text-white">{title}</h1>
              <label className="flex h-9 w-full items-center gap-2 bg-[#2a2e37] px-3 text-sm text-white/70 sm:w-[240px]">
                <Search size={15} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search for your favourite game" className="w-full bg-transparent text-white outline-none placeholder:text-white/40" />
              </label>
            </div>
            {shown.length === 0 && <p className="py-10 text-center text-sm text-white/60">No games match your search.</p>}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {shown.map((game) => <GameTile key={game.slug} slug={game.slug} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function GameTile({ slug, compact = false }: { slug: string; compact?: boolean }) {
  const game = CASINO_GAMES.find((item) => item.slug === slug)
  if (!game) return null
  return (
    <Link href={`/games/${game.slug}`} className="group relative block aspect-square overflow-hidden rounded-lg text-left">
      <div className={`absolute inset-0 bg-gradient-to-br ${game.art} transition-transform duration-300 group-hover:scale-105`} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.25),transparent_55%)]" />
      <span className={`absolute right-3 leading-none drop-shadow-[0_6px_12px_rgba(0,0,0,0.45)] ${compact ? 'top-3 text-[40px]' : 'top-4 text-[48px] sm:top-8 sm:text-[64px]'}`}>{game.glyph}</span>
      {game.badge && !compact && <span className={`absolute left-0 top-0 px-2 py-0.5 text-[10px] font-black italic text-white ${BADGE_STYLE[game.badge]}`}>{game.badge}</span>}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-10">
        <p className={`font-black uppercase italic leading-none tracking-tight text-white drop-shadow ${compact ? 'text-sm' : 'text-base sm:text-xl'}`}>{game.name}</p>
        {!compact && <p className="mt-1 line-clamp-2 text-[11px] text-white/75">{game.tagline}</p>}
      </div>
      <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
        <span className="bg-[#0b9b3a] px-5 py-2 text-sm font-bold text-white">PLAY</span>
      </span>
    </Link>
  )
}
