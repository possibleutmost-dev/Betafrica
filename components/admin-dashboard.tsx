'use client'

import { useEffect, useState } from 'react'
import { BarChart3, FileCheck2, Settings, UserCog, Users, WalletCards } from 'lucide-react'
import { formatMoney } from '@/lib/countries'

type Role = 'admin' | 'subadmin'

export function AdminDashboard({ role, close }: { role: Role; close: () => void }) {
  const isAdmin = role === 'admin'
  const [authed, setAuthed] = useState<'checking' | 'yes' | 'no'>('checking')

  useEffect(() => {
    const url = isAdmin ? '/api/admin/overview' : '/api/partner/dashboard'
    fetch(url).then((res) => setAuthed(res.ok ? 'yes' : 'no')).catch(() => setAuthed('no'))
  }, [isAdmin])

  return (
    <section className="mx-auto min-h-[620px] max-w-[1180px] bg-[#f6f7f8] px-3 py-4 sm:px-4 sm:py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ed1324]">Operations console</p>
          <h1 className="mt-1 text-2xl font-black sm:text-3xl">{isAdmin ? 'Admin dashboard' : 'Sub-admin workspace'}</h1>
          <p className="mt-1 text-sm text-[#6b7077]">{isAdmin ? 'Full platform controls, financials and staff permissions.' : 'Manage assigned operations without access to sensitive platform settings.'}</p>
        </div>
        <button onClick={close} className="border bg-white px-4 py-2 text-sm font-semibold">Back to site</button>
      </div>
      {authed === 'checking' && <p className="text-sm text-[#6b7077]">Checking access…</p>}
      {authed === 'no' && (isAdmin ? <AdminLogin onSuccess={() => setAuthed('yes')} /> : <PartnerLogin onSuccess={() => setAuthed('yes')} />)}
      {authed === 'yes' && (isAdmin ? <AdminConsole /> : <PartnerConsole onSignedOut={() => setAuthed('no')} />)}
    </section>
  )
}

export function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const submit = async () => {
    setError('')
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Could not sign in')
      return
    }
    onSuccess()
  }
  return (
    <div className="mx-auto max-w-sm bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold">Admin sign in</h2>
      <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" className="mt-4 h-11 w-full border px-3 text-sm" />
      {error && <p className="mt-2 text-xs text-[#ed1324]">{error}</p>}
      <button onClick={submit} className="mt-4 w-full bg-[#ed1324] py-3 text-sm font-semibold text-white">Enter console</button>
    </div>
  )
}

function PartnerLogin({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const submit = async () => {
    setError('')
    const res = await fetch('/api/partner/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Could not sign in')
      return
    }
    onSuccess()
  }
  return (
    <div className="mx-auto max-w-sm bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold">Sub-admin sign in</h2>
      <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" className="mt-4 h-11 w-full border px-3 text-sm" />
      <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" className="mt-3 h-11 w-full border px-3 text-sm" />
      {error && <p className="mt-2 text-xs text-[#ed1324]">{error}</p>}
      <button onClick={submit} className="mt-4 w-full bg-[#ed1324] py-3 text-sm font-semibold text-white">Enter workspace</button>
    </div>
  )
}

function AdminConsole() {
  const nav = ['Overview', 'Users & KYC', 'Wallets', 'Sportsbook', 'Reports', 'Team & roles', 'Settings']
  const [section, setSection] = useState(nav[0])
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    fetch('/api/admin/overview').then((res) => res.json()).then(setOverview).catch(() => {})
  }, [])

  const cards = [
    ['Total users', String(overview?.players ?? '—'), `${overview?.depositors ?? 0} depositors`, Users],
    ['Active bets', String(overview?.openTickets ?? '—'), `Stake ${overview?.openStake ?? 0}`, BarChart3],
    ['Pending reviews', String(overview?.pendingDeposits ?? '—'), 'Manual deposits', FileCheck2],
    ['Liability', moneyMap(overview?.liability), 'Open potential wins', WalletCards],
  ] as const

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-[205px_minmax(0,1fr)]">
      <aside className="min-w-0 self-start bg-[#171a20] p-3 text-white">
        <div className="mb-3 flex items-center gap-2 border-b border-white/10 px-3 pb-3 md:mb-4 md:pb-4">
          <UserCog size={20} className="text-[#ffcf00]" />
          <div>
            <p className="text-xs font-bold">Super Admin</p>
            <p className="text-[10px] text-white/50">All permissions</p>
          </div>
          <button onClick={() => fetch('/api/admin/logout', { method: 'POST' }).then(() => window.location.reload())} className="ml-auto text-xs text-white/50 md:hidden">Sign out</button>
        </div>
        <nav className="scrollbar-none flex overflow-x-auto md:block">
          {nav.map((item) => (
            <button key={item} onClick={() => setSection(item)} className={`flex shrink-0 items-center gap-3 whitespace-nowrap px-3 py-3 text-left text-sm md:w-full ${section === item ? 'bg-[#ed1324] font-semibold' : 'text-white/70 hover:bg-white/10'}`}>
              {item === 'Settings' ? <Settings size={16} /> : <BarChart3 size={16} />}
              {item}
            </button>
          ))}
        </nav>
        <button onClick={() => fetch('/api/admin/logout', { method: 'POST' }).then(() => window.location.reload())} className="mt-4 hidden w-full px-3 py-2 text-left text-xs text-white/50 md:block">Sign out</button>
      </aside>
      <div className="min-w-0 space-y-4">
        {section === 'Overview' && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {cards.map(([label, value, change, Icon]) => (
                <div key={label} className="bg-white p-4 shadow-sm">
                  <div className="flex justify-between text-[#6b7077]"><span className="text-xs font-semibold">{label}</span><Icon size={18} /></div>
                  <p className="mt-4 text-2xl font-black">{value}</p>
                  <p className="mt-1 text-xs text-[#0b9b3a]">{change}</p>
                </div>
              ))}
            </div>
            <div className="min-w-0 break-words bg-white p-4 text-sm sm:p-5">
              <h2 className="font-bold">Deposits by currency</h2>
              <p className="mt-2 text-[#6b7077]">{moneyMap(overview?.deposits) || 'No settled deposits yet.'}</p>
              <h2 className="mt-4 font-bold">Withdrawals by currency</h2>
              <p className="mt-2 text-[#6b7077]">{moneyMap(overview?.withdrawals) || 'No settled withdrawals yet.'}</p>
            </div>
          </>
        )}
        {section === 'Users & KYC' && <PlayersPanel />}
        {section === 'Wallets' && <DepositsPanel />}
        {section === 'Sportsbook' && <MatchesPanel />}
        {section === 'Reports' && <ReportsPanel />}
        {section === 'Team & roles' && <PartnersPanel />}
        {section === 'Settings' && <SettingsPanel />}
      </div>
    </div>
  )
}

function moneyMap(value: unknown) {
  if (!value || typeof value !== 'object') return '—'
  const entries = Object.entries(value as Record<string, number>)
  if (!entries.length) return '—'
  return entries.map(([currency, amount]) => formatMoney(amount, currency)).join(' · ')
}

function PlayersPanel() {
  const [players, setPlayers] = useState<Record<string, unknown>[]>([])
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')

  const load = (q = query) => {
    fetch(`/api/admin/players?q=${encodeURIComponent(q)}`).then((res) => res.json()).then((json) => setPlayers(json.players ?? []))
  }
  useEffect(() => { load('') }, [])

  const act = async (userId: string, action: string, amount?: number) => {
    const res = await fetch('/api/admin/players', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action, amount }),
    })
    const json = await res.json()
    setMessage(res.ok ? 'Saved.' : json.error ?? 'Could not update the player')
    load()
  }

  return (
    <div className="bg-white p-5">
      <div className="flex gap-2">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, phone or email" className="h-10 flex-1 border px-3 text-sm" />
        <button onClick={() => load()} className="bg-[#171a20] px-4 text-sm font-semibold text-white">Search</button>
      </div>
      {message && <p className="mt-2 text-xs text-[#0b9b3a]">{message}</p>}
      <div className="mt-4 divide-y text-sm">
        {players.map((player) => (
          <div key={String(player.id)} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div>
              <p className="font-semibold">{String(player.name)} · {String(player.phone)}</p>
              <p className="text-xs text-[#6b7077]">{formatMoney(Number(player.balance), String(player.currency))} · deposited {formatMoney(Number(player.total_deposited), String(player.currency))}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => act(String(player.id), player.withdrawal_approved ? 'revoke' : 'approve')} className="border px-2 py-1 text-xs">{player.withdrawal_approved ? 'Revoke' : 'Approve'}</button>
              <button onClick={() => { const amount = Number(window.prompt('Credit amount (use a negative number to deduct)') ?? ''); if (amount) act(String(player.id), 'credit', amount) }} className="border px-2 py-1 text-xs">Credit</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DepositsPanel() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const load = () => fetch('/api/admin/deposits').then((res) => res.json()).then((json) => setRows(json.deposits ?? []))
  useEffect(() => { load() }, [])
  const act = async (reference: string, action: string) => {
    await fetch('/api/admin/deposits', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reference, action }) })
    load()
  }
  return (
    <div className="min-w-0 break-words bg-white p-4 text-sm sm:p-5">
      <h2 className="font-bold">Pending manual deposits</h2>
      {rows.length === 0 && <p className="mt-3 text-[#6b7077]">Nothing waiting.</p>}
      {rows.map((row) => {
        const user = row.users as { name?: string; phone?: string } | undefined
        return (
          <div key={String(row.reference)} className="mt-3 border p-3">
            <p className="font-semibold">{user?.name} · {user?.phone}</p>
            <p>{formatMoney(Number(row.amount), String(row.currency))} · {String(row.senderNumber ?? '')}</p>
            {row.screenshotUrl ? <a className="text-xs text-[#ed1324]" href={String(row.screenshotUrl)} target="_blank" rel="noreferrer">Open screenshot</a> : null}
            <div className="mt-2 flex gap-2">
              <button onClick={() => act(String(row.reference), 'confirm')} className="bg-[#0b9b3a] px-3 py-1 text-xs text-white">Confirm</button>
              <button onClick={() => act(String(row.reference), 'reject')} className="border px-3 py-1 text-xs">Reject</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MatchesPanel() {
  const [matches, setMatches] = useState<Record<string, unknown>[]>([])
  const [form, setForm] = useState({ home_team: '', away_team: '', home_crest: '', away_crest: '', league: '', kickoff: '', odds_home: '2.00', odds_draw: '3.20', odds_away: '3.50' })
  const [uploadError, setUploadError] = useState('')
  const upload = async (side: 'home_crest' | 'away_crest', file: File | undefined) => {
    if (!file) return
    setUploadError('')
    const body = new FormData()
    body.set('file', file)
    const res = await fetch('/api/admin/upload', { method: 'POST', body })
    const json = await res.json()
    if (!res.ok) {
      setUploadError(json.error ?? 'Could not upload that crest')
      return
    }
    setForm((current) => ({ ...current, [side]: json.url }))
  }
  const load = () => fetch('/api/admin/custom-matches').then((res) => res.json()).then((json) => setMatches(json.matches ?? []))
  useEffect(() => { load() }, [])
  const create = async () => {
    await fetch('/api/admin/custom-matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        kickoff: form.kickoff ? new Date(form.kickoff).toISOString() : '',
      }),
    })
    setForm({ ...form, home_team: '', away_team: '', home_crest: '', away_crest: '' })
    load()
  }
  const finish = async (id: string) => {
    const final_home = Number(window.prompt('Home score') ?? '')
    const final_away = Number(window.prompt('Away score') ?? '')
    if (!Number.isFinite(final_home) || !Number.isFinite(final_away)) return
    await fetch('/api/admin/custom-matches', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, final_home, final_away }) })
    load()
  }
  return (
    <div className="space-y-4">
      <div className="min-w-0 break-words bg-white p-4 text-sm sm:p-5">
        <h2 className="font-bold">Create a match</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <input value={form.home_team} onChange={(event) => setForm({ ...form, home_team: event.target.value })} placeholder="Home team" className="h-10 border px-3" />
          <input value={form.away_team} onChange={(event) => setForm({ ...form, away_team: event.target.value })} placeholder="Away team" className="h-10 border px-3" />
          {(['home_crest', 'away_crest'] as const).map((side) => (
            <div key={side} className="flex items-center gap-2 border px-2 py-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={form[side] || '/crest-fallback.svg'} alt="" className="h-8 w-8 rounded-full bg-white object-contain" />
              <input value={form[side]} onChange={(event) => setForm({ ...form, [side]: event.target.value })} placeholder={side === 'home_crest' ? 'Home crest / flag URL' : 'Away crest / flag URL'} className="h-8 min-w-0 flex-1 px-1 text-xs outline-none" />
              <label className="cursor-pointer bg-[#171a20] px-2 py-1 text-[11px] font-semibold text-white">
                Upload
                <input type="file" accept="image/*" className="hidden" onChange={(event) => upload(side, event.target.files?.[0])} />
              </label>
            </div>
          ))}
          <input value={form.league} onChange={(event) => setForm({ ...form, league: event.target.value })} placeholder="League" className="h-10 border px-3" />
          <input type="datetime-local" value={form.kickoff} onChange={(event) => setForm({ ...form, kickoff: event.target.value })} className="h-10 border px-3" />
          <input value={form.odds_home} onChange={(event) => setForm({ ...form, odds_home: event.target.value })} placeholder="Home odds" className="h-10 border px-3" />
          <input value={form.odds_draw} onChange={(event) => setForm({ ...form, odds_draw: event.target.value })} placeholder="Draw odds" className="h-10 border px-3" />
          <input value={form.odds_away} onChange={(event) => setForm({ ...form, odds_away: event.target.value })} placeholder="Away odds" className="h-10 border px-3" />
        </div>
        {uploadError && <p className="mt-2 text-xs text-[#ed1324]">{uploadError}</p>}
        <button onClick={create} className="mt-3 bg-[#ed1324] px-4 py-2 text-sm font-semibold text-white">Add match</button>
      </div>
      <div className="min-w-0 break-words bg-white p-4 text-sm sm:p-5">
        {matches.map((match) => (
          <div key={String(match.id)} className="flex flex-wrap items-center justify-between gap-2 border-b py-3">
            <div>
              <p className="font-semibold">{String(match.home_team)} vs {String(match.away_team)}</p>
              <p className="text-xs text-[#6b7077]">{String(match.league)} · {match.finished ? `FT ${match.final_home}-${match.final_away}` : 'Open'}</p>
            </div>
            {!match.finished && <button onClick={() => finish(String(match.id))} className="border px-3 py-1 text-xs">Set result</button>}
          </div>
        ))}
      </div>
    </div>
  )
}

function ReportsPanel() {
  const [bets, setBets] = useState<Record<string, unknown>[]>([])
  const [payments, setPayments] = useState<Record<string, unknown>[]>([])
  useEffect(() => {
    fetch('/api/admin/bets').then((res) => res.json()).then((json) => setBets(json.bets ?? []))
    fetch('/api/admin/payments').then((res) => res.json()).then((json) => setPayments(json.payments ?? []))
  }, [])
  const resolve = async (reference: string) => {
    await fetch('/api/admin/payments', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reference, status: 'resolved' }) })
    const json = await fetch('/api/admin/payments').then((res) => res.json())
    setPayments(json.payments ?? [])
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="min-w-0 break-words bg-white p-4 text-sm sm:p-5">
        <h2 className="font-bold">Tickets</h2>
        {bets.slice(0, 30).map((bet) => (
          <div key={String(bet.code)} className="border-b py-2">
            <p className="font-semibold">{String(bet.code)} · {String(bet.status)}</p>
            <p className="text-xs text-[#6b7077]">{formatMoney(Number(bet.stake), String(bet.currency))} → {formatMoney(Number(bet.potential_win), String(bet.currency))}</p>
          </div>
        ))}
      </div>
      <div className="min-w-0 break-words bg-white p-4 text-sm sm:p-5">
        <h2 className="font-bold">Payments</h2>
        {payments.slice(0, 30).map((payment) => (
          <div key={String(payment.reference)} className="flex flex-wrap items-center justify-between gap-2 border-b py-2">
            <div>
              <p className="font-semibold">{formatMoney(Number(payment.amount), String(payment.currency))} · {String(payment.status)}</p>
              <p className="text-xs text-[#6b7077]">{String(payment.provider)} · {String(payment.reference)}</p>
            </div>
            {payment.status === 'pending' && <button onClick={() => resolve(String(payment.reference))} className="border px-2 py-1 text-xs">Resolve</button>}
          </div>
        ))}
      </div>
    </div>
  )
}

function PartnersPanel() {
  const [partners, setPartners] = useState<Record<string, unknown>[]>([])
  const load = () => fetch('/api/admin/sub-admins').then((res) => res.json()).then((json) => setPartners(json.partners ?? []))
  useEffect(() => { load() }, [])
  const act = async (id: string, action: string) => {
    await fetch('/api/admin/sub-admins', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }) })
    load()
  }
  return (
    <div className="min-w-0 break-words bg-white p-4 text-sm sm:p-5">
      <h2 className="font-bold">Sub-admins</h2>
      {partners.map((partner) => (
        <div key={String(partner.id)} className="flex flex-wrap items-center justify-between gap-2 border-b py-3">
          <div>
            <p className="font-semibold">{String(partner.name)} · {String(partner.email)}</p>
            <p className="text-xs text-[#6b7077]">Code {String(partner.referral_code)} · {String(partner.referredPlayers)} players · {partner.approved ? 'Approved' : 'Waiting'}</p>
          </div>
          <button onClick={() => act(String(partner.id), partner.approved ? 'revoke' : 'approve')} className="border px-3 py-1 text-xs">{partner.approved ? 'Revoke' : 'Approve'}</button>
        </div>
      ))}
    </div>
  )
}

function SettingsPanel() {
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  useEffect(() => {
    fetch('/api/admin/settings').then((res) => res.json()).then((json) => setSettings(json.settings ?? {}))
  }, [])
  const save = async () => {
    const res = await fetch('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ settings }) })
    setMessage(res.ok ? 'Saved.' : 'Could not save settings')
  }
  const keys = ['deposit_account_name', 'deposit_account_number', 'deposit_account_network']
  return (
    <div className="min-w-0 break-words bg-white p-4 text-sm sm:p-5">
      <h2 className="font-bold">Deposit account</h2>
      {keys.map((key) => (
        <label key={key} className="mt-3 block text-xs font-semibold">
          {key.replaceAll('_', ' ')}
          <input value={settings[key] ?? ''} onChange={(event) => setSettings({ ...settings, [key]: event.target.value })} className="mt-1 h-10 w-full border px-3 text-sm font-normal" />
        </label>
      ))}
      {message && <p className="mt-2 text-xs text-[#0b9b3a]">{message}</p>}
      <button onClick={save} className="mt-4 bg-[#171a20] px-4 py-2 text-sm font-semibold text-white">Save settings</button>
    </div>
  )
}

function PartnerConsole({ onSignedOut }: { onSignedOut: () => void }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null)
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')

  const load = () => fetch('/api/partner/dashboard').then((res) => res.json()).then(setData)
  useEffect(() => { load() }, [])

  const partner = (data?.partner ?? {}) as { name?: string; referral_code?: string; approved?: boolean }
  const wallet = data?.wallet as { balance?: number; currency?: string } | null
  const players = (data?.players ?? []) as { id: string; name: string; phone: string; total_deposited: number; currency: string }[]
  const commissions = (data?.commissions ?? []) as { id: string; amount: number; currency: string; deposit_amount: number }[]

  const credit = async () => {
    const res = await fetch('/api/partner/credit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: Number(amount) }) })
    const json = await res.json()
    setMessage(res.ok ? 'Wallet credited.' : json.error ?? 'Could not credit')
    setAmount('')
    load()
  }

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-[205px_minmax(0,1fr)]">
      <aside className="bg-[#171a20] p-3 text-white">
        <div className="mb-4 flex items-center gap-2 border-b border-white/10 px-3 pb-4">
          <UserCog size={20} className="text-[#ffcf00]" />
          <div>
            <p className="text-xs font-bold">Sub-admin</p>
            <p className="text-[10px] text-white/50">{partner.approved ? 'Approved' : 'Waiting for approval'}</p>
          </div>
        </div>
        <button onClick={async () => { await fetch('/api/partner/logout', { method: 'POST' }); onSignedOut() }} className="w-full px-3 py-2 text-left text-xs text-white/50">Sign out</button>
      </aside>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Referral code" value={partner.referral_code ?? '—'} />
          <Stat label="Players" value={String(players.length)} />
          <Stat label="Betting wallet" value={wallet ? formatMoney(Number(wallet.balance), wallet.currency ?? 'NGN') : 'Not opened'} />
        </div>
        <div className="min-w-0 break-words bg-white p-4 text-sm sm:p-5">
          <h2 className="font-bold">Credit betting wallet</h2>
          {!wallet && (
            <button
              onClick={async () => {
                const phone = window.prompt('Phone number for the betting account') ?? ''
                const res = await fetch('/api/partner/play', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, countryCode: 'NG' }) })
                const json = await res.json()
                setMessage(res.ok ? 'Betting account opened.' : json.error ?? 'Could not open the account')
                load()
              }}
              className="mt-3 border px-3 py-2 text-xs font-semibold"
            >
              Open betting account
            </button>
          )}
          <div className="mt-3 flex gap-2">
            <input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Amount" className="h-10 flex-1 border px-3" />
            <button onClick={credit} className="bg-[#0b9b3a] px-4 text-sm font-semibold text-white">Credit</button>
          </div>
          {message && <p className="mt-2 text-xs">{message}</p>}
          <p className="mt-2 text-xs text-[#6b7077]">Used today {String(data?.creditedToday ?? 0)} of {String(data?.dailyLimit ?? 0)}.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="min-w-0 break-words bg-white p-4 text-sm sm:p-5">
            <h2 className="font-bold">Referred players</h2>
            {players.map((player) => <p key={player.id} className="border-b py-2">{player.name} · {player.phone} · {formatMoney(player.total_deposited, player.currency)}</p>)}
          </div>
          <div className="min-w-0 break-words bg-white p-4 text-sm sm:p-5">
            <h2 className="font-bold">Commission</h2>
            {commissions.map((row) => <p key={row.id} className="border-b py-2">{formatMoney(row.amount, row.currency)} on {formatMoney(row.deposit_amount, row.currency)}</p>)}
          </div>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="bg-white p-4 shadow-sm"><p className="text-xs font-semibold text-[#6b7077]">{label}</p><p className="mt-3 text-xl font-black">{value}</p></div>
}
