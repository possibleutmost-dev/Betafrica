'use client'

import { useEffect, useState } from 'react'
import { useShell } from '@/components/site-shell'
import { formatMoney } from '@/lib/countries'

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
