'use client'

import Link from 'next/link'
import { AdminLogin } from '@/components/admin-dashboard'

export function AdminLoginPage({ next }: { next: string }) {
  return (
    <section className="mx-auto max-w-[1180px] px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#0f766e]">Operations console</p>
          <h1 className="mt-1 text-3xl font-black">Admin dashboard</h1>
        </div>
        <Link href="/" className="border bg-white px-4 py-2 text-sm font-semibold">Back to site</Link>
      </div>
      <AdminLogin onSuccess={() => window.location.assign(next)} />
    </section>
  )
}
