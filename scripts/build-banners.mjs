// Generates the brand banners in public/banners/. Run: node scripts/build-banners.mjs
import fs from 'node:fs'

const NAVY = '#0b1b33'
const NAVY_2 = '#12305a'
const TEAL = '#0d9488'
const TEAL_LT = '#2dd4bf'
const YELLOW = '#facc15'
const W = 1280
const H = 720

const pt = (cx, cy, r, deg) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)]
const poly = (cx, cy, r, rot, n = 5) =>
  Array.from({ length: n }, (_, k) => pt(cx, cy, r, rot + (360 / n) * k).map((v) => v.toFixed(1)).join(',')).join(' ')

let uid = 0
function ball(cx, cy, r) {
  const id = `ball${uid++}`
  const inner = 0.36 * r
  const seams = []
  const patches = []
  for (let k = 0; k < 5; k++) {
    const a = -90 + 72 * k
    const [x1, y1] = pt(cx, cy, inner, a)
    const [x2, y2] = pt(cx, cy, 0.7 * r, a)
    seams.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`)
    const [px, py] = pt(cx, cy, 0.98 * r, a)
    patches.push(`<polygon points="${poly(px, py, 0.3 * r, a + 180)}"/>`)
  }
  return `
  <defs>
    <clipPath id="${id}c"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
    <radialGradient id="${id}s" cx="0.35" cy="0.3" r="0.8">
      <stop offset="0" stop-color="#fff" stop-opacity="0"/>
      <stop offset="1" stop-color="${NAVY}" stop-opacity="0.5"/>
    </radialGradient>
  </defs>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="#f8fafc"/>
  <g clip-path="url(#${id}c)">
    <polygon points="${poly(cx, cy, inner, -90)}" fill="${NAVY}"/>
    <g fill="${NAVY}">${patches.join('')}</g>
    <g stroke="${NAVY}" stroke-width="${(r * 0.035).toFixed(1)}" stroke-linecap="round">${seams.join('')}</g>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id}s)"/>
  </g>`
}

function coin(cx, cy, r, tilt = 1) {
  return `<g transform="translate(${cx} ${cy}) scale(1 ${tilt})">
    <circle r="${r}" fill="#ca8a04"/>
    <circle r="${r * 0.9}" fill="${YELLOW}"/>
    <circle r="${r * 0.64}" fill="none" stroke="#ca8a04" stroke-width="${r * 0.09}"/>
  </g>`
}

function glow(id, cx, cy, r, color, opacity) {
  return `<defs><radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="${color}" stop-opacity="${opacity}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/>
  </radialGradient></defs><rect width="${W}" height="${H}" fill="url(#${id})"/>`
}

const base = (id) => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="${NAVY}"/><stop offset="1" stop-color="${NAVY_2}"/>
</linearGradient></defs><rect width="${W}" height="${H}" fill="url(#${id})"/>`

const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice">${body}\n</svg>\n`

// Pitch in perspective along the bottom, floodlights, a ball in flight.
function hero() {
  const lines = []
  for (let i = -8; i <= 8; i++) lines.push(`<line x1="${640 + i * 60}" y1="480" x2="${640 + i * 260}" y2="${H}"/>`)
  const lights = Array.from({ length: 9 }, (_, i) => `<circle cx="${800 + i * 52}" cy="${90 - i * 6}" r="8"/>`).join('')
  const streaks = [0, 1, 2].map((i) => `<line x1="${600 - i * 40}" y1="${250 + i * 50}" x2="${850 - i * 10}" y2="${250 + i * 45}"/>`).join('')
  return svg(`
  ${base('hb')}
  ${glow('hg1', 1000, 80, 560, TEAL_LT, 0.3)}
  ${glow('hg2', 990, 310, 300, YELLOW, 0.14)}
  <g fill="#fff" opacity="0.9">${lights}</g>
  <path d="M0 480 H${W} V${H} H0Z" fill="${TEAL}" opacity="0.25"/>
  <g stroke="${TEAL_LT}" stroke-opacity="0.25" stroke-width="2">${lines.join('')}<line x1="0" y1="480" x2="${W}" y2="480"/><line x1="0" y1="570" x2="${W}" y2="570"/></g>
  <ellipse cx="640" cy="650" rx="380" ry="70" fill="none" stroke="${TEAL_LT}" stroke-opacity="0.25" stroke-width="2"/>
  <g stroke="${YELLOW}" stroke-width="9" stroke-linecap="round" opacity="0.8">${streaks}</g>
  <ellipse cx="990" cy="575" rx="120" ry="16" fill="#000" opacity="0.3"/>
  ${ball(990, 310, 130)}`)
}

// Racing lanes, chequered flag, ball: football, racing and more.
function virtualWorld() {
  const lanes = Array.from({ length: 7 }, (_, i) => `<path d="M${420 + i * 130} ${H} L${820 + i * 90} 0"/>`).join('')
  const s = 34
  const fx = 1010
  const fy = 140
  const cells = []
  for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) if ((r + c) % 2 === 0) cells.push(`<rect x="${c * s}" y="${r * s}" width="${s}" height="${s}"/>`)
  const flag = `<rect x="${fx - 12}" y="${fy - 20}" width="12" height="460" rx="6" fill="${YELLOW}"/>
  <g transform="translate(${fx} ${fy}) skewY(-8)">
    <rect width="${6 * s}" height="${5 * s}" fill="#f8fafc"/>
    <g fill="${NAVY}">${cells.join('')}</g>
  </g>`
  const speed = [0, 1, 2, 3].map((i) => `<line x1="${480 + i * 20}" y1="${420 + i * 40}" x2="${690 + i * 10}" y2="${420 + i * 40}"/>`).join('')
  return svg(`
  ${base('vb')}
  ${glow('vg1', 1000, 360, 600, TEAL, 0.5)}
  <g stroke="${TEAL_LT}" stroke-opacity="0.22" stroke-width="3" fill="none">${lanes}</g>
  ${flag}
  <g stroke="${YELLOW}" stroke-width="8" stroke-linecap="round" opacity="0.75">${speed}</g>
  ${ball(820, 500, 115)}`)
}

// Rocket on a rising multiplier curve, coins.
function instantGames() {
  const rocket = `<g transform="translate(940 260) rotate(40)">
    <path d="M-22 60 Q0 180 22 60Z" fill="${YELLOW}"/>
    <path d="M-12 60 Q0 130 12 60Z" fill="#fff" opacity="0.85"/>
    <path d="M-34 10 L-72 72 L-30 55Z M34 10 L72 72 L30 55Z" fill="${TEAL}"/>
    <path d="M0 -125 C42 -82 44 -10 36 60 L-36 60 C-44 -10 -42 -82 0 -125Z" fill="#f8fafc"/>
    <path d="M0 -125 C18 -106 30 -84 36 -58 L-36 -58 C-30 -84 -18 -106 0 -125Z" fill="${TEAL}"/>
    <circle cy="-10" r="18" fill="${NAVY}" stroke="${TEAL_LT}" stroke-width="7"/>
    <rect x="-24" y="56" width="48" height="12" rx="4" fill="#94a3b8"/>
  </g>`
  const coins = [
    [690, 570, 46, 0.9], [790, 630, 34, 0.5], [1160, 540, 42, 0.8], [1200, 170, 30, 1], [620, 170, 24, 0.7], [1060, 650, 30, 0.45],
  ].map(([x, y, r, t]) => coin(x, y, r, t)).join('')
  return svg(`
  ${base('gb')}
  ${glow('gg1', 940, 280, 480, TEAL_LT, 0.32)}
  <path d="M420 ${H} C700 660 800 520 870 350" fill="none" stroke="${TEAL_LT}" stroke-width="10" stroke-linecap="round" opacity="0.75"/>
  <g fill="#fff" opacity="0.5"><circle cx="560" cy="110" r="3"/><circle cx="1240" cy="330" r="4"/><circle cx="1110" cy="90" r="3"/><circle cx="700" cy="330" r="2.5"/></g>
  ${coins}
  ${rocket}
  <text x="1050" y="450" font-family="Arial, Helvetica, sans-serif" font-size="66" font-weight="900" fill="${YELLOW}">2.47x</text>`)
}

// Centred lightning in a teal burst; the card's text sits over the middle.
function instantVirtuals() {
  const rays = Array.from({ length: 16 }, (_, i) => {
    const [x1, y1] = pt(640, 360, 120, i * 22.5)
    const [x2, y2] = pt(640, 360, 900, i * 22.5)
    return `<line x1="${x1.toFixed(0)}" y1="${y1.toFixed(0)}" x2="${x2.toFixed(0)}" y2="${y2.toFixed(0)}"/>`
  }).join('')
  return svg(`
  ${base('ib')}
  ${glow('ig1', 640, 360, 620, TEAL, 0.55)}
  <g stroke="${TEAL_LT}" stroke-opacity="0.18" stroke-width="26">${rays}</g>
  <path d="M700 110 L510 400 H630 L570 620 L790 300 H665Z" fill="${YELLOW}" opacity="0.2"/>
  ${ball(170, 560, 130)}
  ${coin(1120, 170, 64, 0.9)}${coin(1200, 300, 38, 0.6)}`)
}

const out = 'public/banners'
fs.writeFileSync(`${out}/hero-football.svg`, hero())
fs.writeFileSync(`${out}/virtual-world.svg`, virtualWorld())
fs.writeFileSync(`${out}/instant-games.svg`, instantGames())
fs.writeFileSync(`${out}/instant-virtuals.svg`, instantVirtuals())
console.log('banners written')
