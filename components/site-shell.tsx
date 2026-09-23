'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronDown, Headphones, Menu, ShieldCheck, X } from 'lucide-react'
import { AuthForm } from '@/components/auth-form'
import { WinCelebration, hasCelebrated, markCelebrated } from '@/components/tickets'
import { formatMoney } from '@/lib/countries'
import { useSession, type Player } from '@/lib/store'

type AuthMode = 'login' | 'register'
type Shell = { notify: (message: string) => void; openAuth: (mode?: AuthMode) => void; player: Player | null }

const ShellContext = createContext<Shell>({ notify: () => {}, openAuth: () => {}, player: null })

export const useShell = () => useContext(ShellContext)

const mainNav = [
  ['Sports', '/'],
  ['Games', '/games'],
  ['Live Betting', '/live'],
  ['Virtuals', '/virtuals'],
  ['Jackpot', '/jackpot'],
  ['Promotions', '/promotions'],
  ['Load Code', '/load-code'],
  ['Help', '/help'],
] as const

const accountNav = [
  ['My Bets', '/my-bets'],
  ['Withdraw', '/withdraw'],
  ['Transactions', '/transactions'],
] as const

const sportTabs = [
  ['Home', '/'],
  ['Football', '/football'],
  ['Live Betting', '/live'],
  ['Casino', '/games'],
  ['Crash Games', '/crash-games'],
  ['Basketball', '/basketball'],
  ['Tennis', '/tennis'],
  ['Virtuals', '/virtuals'],
] as const

const RECENT_WIN_MS = 3 * 86_400_000

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const storedPlayer = useSession((state) => state.player)
  const signIn = useSession((state) => state.signIn)
  const signOut = useSession((state) => state.signOut)
  const [mounted, setMounted] = useState(false)
  const [auth, setAuth] = useState<AuthMode | null>(null)
  const [notice, setNotice] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [win, setWin] = useState<{ code: string; amount: number; currency: string } | null>(null)

  useEffect(() => setMounted(true), [])

  // The session lives in localStorage, so it is only read after hydration.
  const player = mounted ? storedPlayer : null

  useEffect(() => {
    if (!player?.id) return
    let alive = true
    fetch(`/api/me?userId=${player.id}`)
      .then((res) => res.json())
      .then((json) => {
        if (!alive || !json.user) return
        signIn({
          id: json.user.id,
          name: json.user.name,
          phone: json.user.phone,
          email: json.user.email,
          country_code: json.user.country_code,
          currency: json.user.currency,
          balance: Number(json.user.balance),
        })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [player?.id, signIn])

  useEffect(() => {
    if (!player?.id) return
    let alive = true
    fetch(`/api/bets/mine?userId=${player.id}`)
      .then((res) => res.json())
      .then((json) => {
        if (!alive) return
        const bets = (json.bets ?? []) as { code: string; status: string; payout: number | null; potential_win: number; currency: string; settled_at: string | null }[]
        const fresh = bets.find((bet) =>
          bet.status === 'won' &&
          !hasCelebrated(bet.code) &&
          (!bet.settled_at || Date.now() - new Date(bet.settled_at).getTime() < RECENT_WIN_MS),
        )
        if (!fresh) return
        markCelebrated(fresh.code)
        setWin({ code: fresh.code, amount: Number(fresh.payout ?? fresh.potential_win), currency: fresh.currency })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [player?.id])

  useEffect(() => setMenuOpen(false), [pathname])

  const notify = useCallback((message: string) => setNotice(message), [])
  const openAuth = useCallback((mode: AuthMode = 'login') => setAuth(mode), [])
  const shell = useMemo(() => ({ notify, openAuth, player }), [notify, openAuth, player])

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`))
  const bare = pathname.startsWith('/admin') || pathname.startsWith('/sub-admin')
  const gamesPage = pathname.startsWith('/games') || pathname === '/crash-games'

  if (bare) {
    return <ShellContext.Provider value={shell}><main className="min-h-screen bg-[#eef0f4] text-[#24262c]">{children}</main></ShellContext.Provider>
  }

  const topLinks = [...mainNav, ...(player ? accountNav : [])]

  return (
    <ShellContext.Provider value={shell}>
      <main className="min-h-screen bg-[#eef0f4] text-[#24262c]">
        <header className="bg-[#ed1324] text-white shadow-sm">
          <div className="mx-auto flex max-w-[1180px] items-center gap-4 px-4 py-3">
            <button onClick={() => setMenuOpen((open) => !open)} className="md:hidden" aria-label="Open menu"><Menu size={22} /></button>
            <Link href="/" className="whitespace-nowrap text-[28px] font-black italic tracking-[-2px]">SportyBet <span className="text-[22px] not-italic">▮▮</span></Link>
            <span className="hidden text-xs font-semibold md:block">{player ? player.country_code : 'Nigeria'} <ChevronDown size={13} className="inline" /></span>
            <div className="ml-auto flex items-center gap-2">
              {player ? (
                <>
                  <span className="hidden text-sm font-semibold sm:inline">{formatMoney(player.balance, player.currency)}</span>
                  <Link href="/deposit" className="flex h-9 items-center bg-white px-4 text-sm font-semibold text-[#ed1324]">Deposit</Link>
                  <button onClick={() => signOut()} className="h-9 px-3 text-sm font-semibold">Logout</button>
                </>
              ) : (
                <>
                  <button onClick={() => setAuth('login')} className="h-9 px-4 text-sm font-semibold">Login</button>
                  <button onClick={() => setAuth('register')} className="h-9 border border-white px-4 text-sm font-semibold">Register</button>
                </>
              )}
            </div>
          </div>
          <nav className={`mx-auto max-w-[1180px] gap-1 overflow-x-auto px-4 text-sm font-semibold md:flex ${menuOpen ? 'flex flex-col md:flex-row' : 'hidden'}`}>
            {topLinks.map(([label, href]) => (
              <Link key={label} href={href} className={`whitespace-nowrap px-4 py-3 hover:bg-[#c9101f] ${isActive(href) ? 'bg-[#c9101f]' : ''}`}>{label}</Link>
            ))}
            <span className="ml-auto hidden px-3 py-3 text-xs md:block">GMT+00:00</span>
          </nav>
        </header>
        {!gamesPage && (
          <div className="border-b bg-white shadow-sm">
            <div className="mx-auto flex max-w-[1180px] overflow-x-auto px-4">
              {sportTabs.map(([label, href]) => (
                <Link key={label} href={href} className={`whitespace-nowrap px-4 py-3 text-sm ${isActive(href) ? 'border-b-4 border-[#ed1324] font-semibold' : 'text-[#5c6068]'}`}>{label}</Link>
              ))}
            </div>
          </div>
        )}

        {children}

        {notice && (
          <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded bg-[#22262c] px-5 py-3 text-sm text-white shadow-xl">
            {notice}
            <button onClick={() => setNotice('')} className="ml-4 text-white/60" aria-label="Close notice"><X size={16} /></button>
          </div>
        )}
        <button onClick={() => setNotice('Support is available on the number shown at deposit.')} className="fixed bottom-6 right-6 flex h-12 w-12 items-center justify-center rounded-full bg-[#ed1324] text-white shadow-lg" aria-label="Contact support"><Headphones size={22} /></button>
        {auth && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
            <AuthForm
              mode={auth}
              onClose={() => setAuth(null)}
              switchMode={() => setAuth(auth === 'login' ? 'register' : 'login')}
              onSignedIn={(next) => {
                signIn(next)
                setAuth(null)
                setNotice(`Welcome, ${next.name}.`)
              }}
            />
          </div>
        )}
        {win && <WinCelebration code={win.code} amount={win.amount} currency={win.currency} onClose={() => setWin(null)} />}
        <footer className={`border-t bg-white ${gamesPage ? '' : 'mt-8'}`}>
          <div className="mx-auto flex max-w-[1180px] flex-wrap justify-between gap-4 px-4 py-6 text-xs text-[#6b7077]">
            <span className="font-semibold text-[#ed1324]">SportyBet</span>
            <span className="flex gap-2">
              <Link href="/help">Responsible Betting</Link>·<Link href="/help">Terms & Conditions</Link>·<Link href="/help">Privacy Policy</Link>
            </span>
            <span className="flex items-center gap-1"><ShieldCheck size={15} /> 18+ Gamble responsibly</span>
          </div>
        </footer>
      </main>
    </ShellContext.Provider>
  )
}
