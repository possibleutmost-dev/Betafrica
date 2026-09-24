// BetAfrica mark: the continent in navy on a yellow tile, Ghana marked in teal.
// Same drawing as public/icon.svg; keep the two in step.
const AFRICA = 'M22 14 30 10 42 9 52 12 60 11 70 15 74 24 80 34 86 38 96 38 90 50 82 60 78 68 76 78 70 86 60 94 52 94 46 86 44 74 42 62 40 54 34 50 24 50 14 46 6 38 8 28 14 20Z'

export function BrandMark({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#facc15" />
      <g transform="translate(4.5 4) scale(0.23)">
        <path d={AFRICA} fill="#0b1b33" stroke="#0b1b33" strokeWidth="4" strokeLinejoin="round" />
        <ellipse cx="88" cy="78" rx="3" ry="7" transform="rotate(20 88 78)" fill="#0b1b33" />
        <circle cx="29" cy="44" r="5" fill="#0d9488" stroke="#facc15" strokeWidth="2" />
      </g>
    </svg>
  )
}
