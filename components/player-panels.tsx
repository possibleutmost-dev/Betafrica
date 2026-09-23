'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useShell } from '@/components/site-shell'
import { formatMoney } from '@/lib/countries'
import { useSession } from '@/lib/store'

type MePayload = {
  user: {
    balance: number
    currency: string
    total_deposited: number
    payout_number: string | null
    payout_bank: string | null
    phone: string
  }
  country: {
    currencySymbol: string
    minFirstDeposit: number
    gateway: string
    payoutRail: 'mobile' | 'bank'
    networks: string[]
  }
  withdrawal: { unlocked: boolean; failed: string | null; progress: { have: number; need: number; label: string } }
}

export function DepositPanel({ onNotice }: { onNotice: (message: string) => void }) {
  const { player } = useShell()
  const [amount, setAmount] = useState('')
  const [phone, setPhone] = useState(player?.phone ?? '')
  const [sender, setSender] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [account, setAccount] = useState<Record<string, string>>({})

  useEffect(() => {
    fetch('/api/settings').then((res) => res.json()).then((json) => setAccount(json.settings ?? {})).catch(() => {})
  }, [])

  if (!player) return <NeedSignIn />

  const start = async () => {
    setError('')
    setBusy(true)
    try {
      const res = await fetch('/api/deposits/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: player.id, amount: Number(amount), phone }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not start your deposit')
        return
      }
      if (json.redirectUrl) {
        window.location.href = json.redirectUrl
        return
      }
      onNotice(json.awaitingPrompt ? 'Approve the prompt on your phone.' : `Deposit started. Reference ${json.reference}.`)
    } catch {
      setError('Could not start your deposit')
    } finally {
      setBusy(false)
    }
  }

  const manual = async () => {
    if (!file) {
      setError('Add a screenshot of the transfer')
      return
    }
    setError('')
    setBusy(true)
    try {
      const body = new FormData()
      body.set('userId', player.id)
      body.set('amount', amount)
      body.set('senderNumber', sender)
      body.set('screenshot', file)
      const res = await fetch('/api/deposits/manual', { method: 'POST', body })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not submit your deposit')
        return
      }
      onNotice('Deposit submitted. It will show in your wallet after confirmation.')
      setAmount('')
      setFile(null)
    } catch {
      setError('Could not submit your deposit')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mx-auto grid max-w-[900px] gap-4 px-4 py-6 md:grid-cols-2">
      <Panel title="Deposit" text="Fund your wallet on your country’s payment rail.">
        <Field label="Amount" value={amount} onChange={setAmount} />
        <Field label="Mobile number" value={phone} onChange={setPhone} />
        {error && <p className="mb-3 text-xs text-[#ed1324]">{error}</p>}
        <button disabled={busy} onClick={start} className="h-11 w-full bg-[#0b9b3a] text-sm font-semibold text-white disabled:opacity-60">Continue</button>
      </Panel>
      <Panel title="Manual transfer" text={account.deposit_account_number ? `Send to ${account.deposit_account_name ?? ''} · ${account.deposit_account_number} · ${account.deposit_account_network ?? ''}` : 'Send to the operator number, then upload the receipt.'}>
        <Field label="Amount sent" value={amount} onChange={setAmount} />
        <Field label="Number you sent from" value={sender} onChange={setSender} />
        <label className="mb-3 block text-xs font-semibold">
          Screenshot
          <input type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="mt-1 block w-full text-xs" />
        </label>
        <button disabled={busy} onClick={manual} className="h-11 w-full border text-sm font-semibold disabled:opacity-60">Submit receipt</button>
      </Panel>
    </section>
  )
}

export function WithdrawPanel({ onNotice }: { onNotice: (message: string) => void }) {
  const { player } = useShell()
  const [me, setMe] = useState<MePayload | null>(null)
  const [amount, setAmount] = useState('')
  const [number, setNumber] = useState('')
  const [bank, setBank] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!player) return
    fetch(`/api/me?userId=${player.id}`).then((res) => res.json()).then((json) => {
      if (!json.user) return
      setMe(json)
      setNumber(json.user.payout_number ?? '')
      setBank(json.user.payout_bank ?? '')
    }).catch(() => {})
  }, [player])

  if (!player) return <NeedSignIn />

  const submit = async () => {
    setError('')
    setBusy(true)
    try {
      const res = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: player.id, amount: Number(amount), payoutNumber: number, payoutBank: bank }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not request a withdrawal')
        return
      }
      onNotice(json.message ?? 'Withdrawal request received.')
    } catch {
      setError('Could not request a withdrawal')
    } finally {
      setBusy(false)
    }
  }

  const progress = me?.withdrawal.progress

  return (
    <section className="mx-auto max-w-[560px] px-4 py-6">
      <Panel title="Withdraw" text={`Available ${formatMoney(player.balance, player.currency)}`}>
        {progress && <p className="mb-3 text-xs text-[#6b7077]">{progress.label}</p>}
        <Field label="Amount" value={amount} onChange={setAmount} />
        <Field label={me?.country.payoutRail === 'bank' ? 'Account number' : 'Wallet number'} value={number} onChange={setNumber} />
        {me?.country.payoutRail === 'bank' && <Field label="Bank name" value={bank} onChange={setBank} />}
        {error && <p className="mb-3 text-xs text-[#ed1324]">{error}</p>}
        <button disabled={busy} onClick={submit} className="h-11 w-full bg-[#0b9b3a] text-sm font-semibold text-white disabled:opacity-60">Request withdrawal</button>
      </Panel>
    </section>
  )
}

type Ticket = {
  code: string
  stake: number
  total_odds: number
  potential_win: number
  currency: string
  status: string
  payout: number | null
  selections: { home_team: string; away_team: string; market: string; outcome: string; odds: number; result: string }[]
}

export function BetsPanel({ onNotice }: { onNotice: (message: string) => void }) {
  const { player } = useShell()
  const setBalance = useSession((state) => state.setBalance)
  const [bets, setBets] = useState<Ticket[] | null>(null)
  const [error, setError] = useState('')

  const load = () => {
    if (!player) return
    fetch(`/api/bets/mine?userId=${player.id}`).then(async (res) => {
      const json = await res.json()
      if (!res.ok) setError(json.error ?? 'Could not load your bets')
      else setBets(json.bets ?? [])
    }).catch(() => setError('Could not load your bets'))
  }

  useEffect(load, [player])

  if (!player) return <NeedSignIn />

  const cashout = async (code: string) => {
    const detail = await fetch(`/api/bets/${code}?userId=${player.id}`).then((res) => res.json())
    if (!detail.cashout?.available) {
      onNotice(detail.cashout?.reason ? 'Cashout is not available on this ticket.' : 'Cashout is not available on this ticket.')
      return
    }
    const res = await fetch(`/api/bets/${code}/cashout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: player.id, expected: detail.cashout.amount }),
    })
    const json = await res.json()
    if (!res.ok) {
      onNotice(json.error ?? 'Cashout was refused')
      return
    }
    if (typeof json.balance === 'number') setBalance(json.balance)
    onNotice(`Cashed out ${formatMoney(json.amount ?? detail.cashout.amount, player.currency)}.`)
    load()
  }

  return (
    <section className="mx-auto max-w-[900px] px-4 py-6">
      <div className="bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-black">My bets</h1>
        {error && <p className="mt-3 text-sm text-[#ed1324]">{error}</p>}
        {bets && bets.length === 0 && <p className="mt-4 text-sm text-[#6b7077]">You have no tickets yet.</p>}
        <div className="mt-4 divide-y">
          {(bets ?? []).map((bet) => (
            <div key={bet.code} className="py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/my-bets/${bet.code}`} className="font-bold hover:text-[#ed1324]">{bet.code} · {bet.status} ›</Link>
                <p>{formatMoney(bet.stake, bet.currency)} @ {Number(bet.total_odds).toFixed(2)} → {formatMoney(bet.potential_win, bet.currency)}</p>
              </div>
              {(bet.selections ?? []).map((leg, index) => (
                <p key={index} className="mt-1 text-xs text-[#6b7077]">{leg.home_team} vs {leg.away_team} · {leg.outcome} @ {Number(leg.odds).toFixed(2)} · {leg.result}</p>
              ))}
              {bet.status === 'pending' && (
                <button onClick={() => cashout(bet.code)} className="mt-2 border px-3 py-1 text-xs font-semibold">Cash out</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function TransactionsPanel() {
  const { player } = useShell()
  const [rows, setRows] = useState<{ reference: string; amount: number; currency: string; provider: string; status: string; created_at: string; metadata?: { type?: string } }[]>([])

  useEffect(() => {
    if (!player) return
    fetch(`/api/transactions?userId=${player.id}`).then((res) => res.json()).then((json) => setRows(json.transactions ?? [])).catch(() => {})
  }, [player])

  if (!player) return <NeedSignIn />

  return (
    <section className="mx-auto max-w-[900px] px-4 py-6">
      <div className="bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-black">Transactions</h1>
        <div className="mt-4 divide-y">
          {rows.map((row) => (
            <div key={row.reference} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div className="min-w-0 break-words">
                <p className="font-semibold">{row.metadata?.type ?? 'payment'} · {row.provider}</p>
                <p className="text-xs text-[#8b8f94]">{row.reference} · {new Date(row.created_at).toLocaleString()}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-bold">{formatMoney(row.amount, row.currency)}</p>
                <p className="text-xs text-[#6b7077]">{row.status}</p>
              </div>
            </div>
          ))}
          {rows.length === 0 && <p className="py-6 text-sm text-[#6b7077]">No payments yet.</p>}
        </div>
      </div>
    </section>
  )
}

export function NeedSignIn() {
  const { openAuth } = useShell()
  return (
    <section className="mx-auto max-w-[560px] px-4 py-12 text-center text-sm text-[#6b7077]">
      <p>Sign in to use this page.</p>
      <button onClick={() => openAuth('login')} className="mt-4 bg-[#0b9b3a] px-6 py-2.5 font-semibold text-white">Login</button>
    </section>
  )
}

function Panel({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <div className="bg-white p-5 shadow-sm">
      <h1 className="text-2xl font-black">{title}</h1>
      <p className="mb-4 mt-1 text-sm text-[#6b7077]">{text}</p>
      {children}
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="mb-3 block text-xs font-semibold">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-11 w-full border px-3 text-sm font-normal" />
    </label>
  )
}
