/**
 * The playable casino games. Shared by the lobby, the game screens and the
 * server engine, so a slug means the same game everywhere.
 */

export type Engine = 'crash' | 'dice' | 'bottle' | 'roulette' | 'wheel' | 'slot' | 'plinko'

export type CasinoGame = {
  slug: string
  name: string
  tagline: string
  engine: Engine
  categories: string[]
  badge?: 'POPULAR' | 'NEW' | 'EXCLUSIVE'
  art: string
  glyph: string
}

export const CASINO_GAMES: CasinoGame[] = [
  { slug: 'sky-rocket', name: 'Sky Rocket', tagline: 'Cash out before it flies away', engine: 'crash', categories: ['crash', 'popular', 'multiplayer'], badge: 'POPULAR', art: 'from-[#3a0a0f] via-[#8f0d17] to-[#ed1324]', glyph: '🚀' },
  { slug: 'jet-rain', name: 'Jet Rain', tagline: 'Ride the multiplier', engine: 'crash', categories: ['crash', 'new'], badge: 'NEW', art: 'from-[#141a26] via-[#39475f] to-[#d52b2b]', glyph: '✈️' },
  { slug: 'galaxy-go', name: 'Galaxy Go', tagline: 'Orbit crash', engine: 'crash', categories: ['crash', 'new'], badge: 'NEW', art: 'from-[#07072a] via-[#2d2d9c] to-[#9b5cff]', glyph: '🪐' },
  { slug: 'lucky-birds', name: 'Lucky Birds', tagline: 'Flap to multiply', engine: 'crash', categories: ['crash', 'quick'], art: 'from-[#08314a] via-[#1c7fc0] to-[#ffd23f]', glyph: '🐦' },
  { slug: 'spin-the-bottle', name: 'Spin The Bottle', tagline: 'Up or down, 1.94x', engine: 'bottle', categories: ['quick', 'popular'], badge: 'EXCLUSIVE', art: 'from-[#2a1d05] via-[#8a6212] to-[#f2b632]', glyph: '🍾' },
  { slug: 'lucky-dice', name: 'Lucky Dice', tagline: 'Roll over or under', engine: 'dice', categories: ['dice', 'quick'], art: 'from-[#1f0b2a] via-[#5a1d7a] to-[#28c76f]', glyph: '🎲' },
  { slug: 'roulette-royale', name: 'Roulette Royale', tagline: 'Red, black, green or a number', engine: 'roulette', categories: ['table', 'wheel', 'popular'], badge: 'POPULAR', art: 'from-[#101010] via-[#3b0b0b] to-[#1f8a4c]', glyph: '🎰' },
  { slug: 'spin-match', name: 'Spin Match', tagline: 'Wheel of fortune up to 10x', engine: 'wheel', categories: ['wheel', 'quick'], art: 'from-[#3a0710] via-[#b3122a] to-[#ffcf00]', glyph: '🎡' },
  { slug: 'fruit-party', name: 'Fruit Party', tagline: 'Three reels, up to 50x', engine: 'slot', categories: ['slots', 'popular'], art: 'from-[#123e48] via-[#12a76c] to-[#ffd23f]', glyph: '🍒' },
  { slug: 'plinko-drop', name: 'Plinko Drop', tagline: 'Watch it bounce, up to 5.4x', engine: 'plinko', categories: ['quick', 'new'], badge: 'NEW', art: 'from-[#1a0633] via-[#5b1c9e] to-[#ff5fa2]', glyph: '🔴' },
]

export function findGame(slug: string) {
  return CASINO_GAMES.find((game) => game.slug === slug) ?? null
}

/** Crash multiplier growth: m(t) = e^(RATE * seconds). */
export const CRASH_RATE = 0.1
export const CRASH_MAX = 1000

export function crashMultiplierAt(elapsedMs: number) {
  return Math.min(CRASH_MAX, Math.floor(Math.exp((CRASH_RATE * elapsedMs) / 1000) * 100) / 100)
}

/** Milliseconds after the start at which the multiplier reaches `m`. */
export function crashTimeFor(m: number) {
  return (Math.log(Math.max(1, m)) / CRASH_RATE) * 1000
}

/** Spin Match wheel, 20 segments (97.5% return). */
export const WHEEL_SEGMENTS = [0, 1.5, 0, 2, 0, 1.5, 0, 3, 0, 1.5, 0, 2, 0, 1.5, 0, 5, 0, 1.5, 0, 0]

/** Plinko, 8 rows: payout by the bin the ball lands in (98.2% return). */
export const PLINKO_BINS = [5.4, 2, 1.1, 1, 0.5, 1, 1.1, 2, 5.4]

export const ROULETTE_REDS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]

export const MIN_STAKE = 1
export const MAX_STAKE = 10_000
