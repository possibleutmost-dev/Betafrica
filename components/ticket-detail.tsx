'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Check, ChevronLeft, Copy } from 'lucide-react'
import { NeedSignIn } from '@/components/player-panels'
import { useShell } from '@/components/site-shell'
import { Trophy, WinCelebration } from '@/components/tickets'
import { formatMoney } from '@/lib/countries'
import { useSession } from '@/lib/store'

type Leg = {
  id: string
  home_team: string
  away_team: string
  league: string
  kickoff: string
  market: string
  outcome: string
  odds: number
  result: string
  final_home: number | null
  final_away: number | null
  isLive?: boolean
  liveHome?: number | null
  liveAway?: number | null
  minuteLabel?: string | null
}

type Detail = {
  bet: {
    code: string
    stake: number
    total_odds: number
    potential_win: number
    bonus: number
    currency: string
    status: string
    payout: number | null
    mode: string
    cashout_amount: number | null
    created_at: string
  }
  selections: Leg[]
  cashout: { available: boolean; amount: number }
}

const STATUS_STYLE: Record<string, string> = {
  won: 'bg-[#0b9b3a] text-white',
  lost: 'bg-[#6b7077] text-white',
  pending: 'bg-[#ffcf00] text-[#24262c]',
  cashed_out: 'bg-[#171a20] text-white',
  void: 'bg-[#d7d9dd] text-[#24262c]',
}

const RESULT_STYLE: Record<string, string> = {
  won: 'text-[#0b9b3a]',
  lost: 'text-[#ed1324]',
  pending: 'text-[#8b8f94]',
  void: 'text-[#8b8f94]',
}

export function TicketDetail({ code }: { code: string }) {
  const { player, notify } = useShell()
  const setBalance = useSession((state) => state.setBalance)
  const [data, setData] = useState<Detail | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [celebrate, setCelebrate] = useState(false)

  const load = useCallback(async () => {
    if (!player) return
    try {
      const res = await fetch(`/api/bets/${code}?userId=${player.id}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not load this ticket')
        return
      }
      setData(json)
      setError('')
    } catch {
      setError('Could not load this ticket')
    }
  }, [code, player])

  useEffect(() => {
    load()
    const timer = setInterval(load, 30_000)
    return () => clearInterval(timer)
  }, [load])

  if (!player) return <NeedSignIn />

  const cashout = async () => {
    if (!data?.cashout.available) return
    setBusy(true)
    try {
      const res = await fetch(`/api/bets/${code}/cashout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: player.id, expected: data.cashout.amount }),
      })
      const json = await res.json()
      if (!res.ok) {
        notify(json.error ?? 'Cashout was refused')
        return
      }
      if (typeof json.balance === 'number') setBalance(json.balance)
      notify(`Cashed out ${formatMoney(json.amount ?? data.cashout.amount, data.bet.currency)}.`)
      load()
    } finally {
      setBusy(false)
    }
  }

  const copy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    }, () => {})
  }

  const bet = data?.bet
  const payout = bet ? Number(bet.payout ?? bet.potential_win) : 0

  return (
    <section className="mx-auto max-w-[760px] px-4 py-6">
      <Link href="/my-bets" className="mb-3 inline-flex items-center text-sm text-[#6b7077]"><ChevronLeft size={16} /> My bets</Link>
      <div className="bg-white shadow-sm">
        {error && <p className="p-5 text-sm text-[#ed1324]">{error}</p>}
        {!data && !error && <p className="p-5 text-sm text-[#6b7077]">Loading ticket…</p>}
        {bet && data && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#6b7077]">Ticket code</p>
                <button onClick={copy} className="flex items-center gap-2">
                  <span className="text-2xl font-black tracking-[0.1em] text-[#ed1324]">{bet.code}</span>
                  {copied ? <Check size={16} className="text-[#0b9b3a]" /> : <Copy size={16} className="text-[#8b8f94]" />}
                </button>
                <p className="text-xs text-[#8b8f94]">{new Date(bet.created_at).toLocaleString('en-GB')}</p>
              </div>
              <span className={`px-3 py-1 text-xs font-bold uppercase ${STATUS_STYLE[bet.status] ?? 'bg-[#d7d9dd]'}`}>{bet.status.replace('_', ' ')}</span>
            </div>

            {bet.status === 'won' && (
              <button onClick={() => setCelebrate(true)} className="flex w-full flex-col items-center bg-[#181b21] py-5 text-white">
                <Trophy size={140} />
                <span className="mt-1 text-sm text-white/70">You won</span>
                <span className="text-2xl font-black text-[#ffcf00]">{formatMoney(payout, bet.currency)}</span>
              </button>
            )}

            <dl className="grid grid-cols-2 gap-3 border-b p-5 text-sm sm:grid-cols-4">
              <Stat label="Stake" value={formatMoney(Number(bet.stake), bet.currency)} />
              <Stat label="Total odds" value={Number(bet.total_odds).toFixed(2)} />
              <Stat label="Bonus" value={formatMoney(Number(bet.bonus), bet.currency)} />
              <Stat label={bet.status === 'won' || bet.status === 'cashed_out' ? 'Paid' : 'Potential win'} value={formatMoney(bet.status === 'cashed_out' ? Number(bet.cashout_amount ?? bet.payout ?? 0) : payout, bet.currency)} />
            </dl>

            <ul className="divide-y">
              {data.selections.map((leg) => {
                const score = leg.final_home != null && leg.final_away != null
                  ? `FT ${leg.final_home}-${leg.final_away}`
                  : leg.isLive && leg.liveHome != null ? `${leg.minuteLabel ?? 'LIVE'} ${leg.liveHome}-${leg.liveAway}` : new Date(leg.kickoff).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
                return (
                  <li key={leg.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm sm:px-5">
                    <div className="min-w-0 break-words">
                      <p className="font-semibold">{leg.home_team} vs {leg.away_team}</p>
                      <p className="text-xs text-[#6b7077]">{leg.league} · {leg.market} · <strong>{leg.outcome}</strong> @ {Number(leg.odds).toFixed(2)}</p>
                      <p className="text-xs text-[#8b8f94]">{score}</p>
                    </div>
                    <span className={`text-xs font-bold uppercase ${RESULT_STYLE[leg.result] ?? ''}`}>{leg.result}</span>
                  </li>
                )
              })}
            </ul>

            {bet.status === 'pending' && (
              <div className="border-t p-5">
                <button disabled={busy || !data.cashout.available} onClick={cashout} className="h-11 w-full bg-[#0b9b3a] text-sm font-semibold text-white disabled:bg-[#d7d9dd] disabled:text-[#6b7077]">
                  {data.cashout.available ? `Cash out ${formatMoney(data.cashout.amount, bet.currency)}` : 'Cashout not available'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
      {celebrate && bet && <WinCelebration code={bet.code} amount={payout} currency={bet.currency} onClose={() => setCelebrate(false)} />}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-[#6b7077]">{label}</dt>
      <dd className="mt-1 font-bold">{value}</dd>
    </div>
  )
}
