'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { Player } from '@/lib/store'

const countries = [
  { code: 'NG', name: 'Nigeria' },
  { code: 'GH', name: 'Ghana' },
  { code: 'KE', name: 'Kenya' },
  { code: 'ZA', name: 'South Africa' },
]

export function AuthForm({ mode, onClose, switchMode, onSignedIn }: { mode: 'login' | 'register'; onClose: () => void; switchMode: () => void; onSignedIn: (player: Player) => void }) {
  const [identifier, setIdentifier] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [countryCode, setCountryCode] = useState('NG')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const saved = sessionStorage.getItem('sporty-phone')
    if (saved) setIdentifier(saved)
  }, [])

  const submit = async () => {
    setError('')
    setBusy(true)
    try {
      const res = await fetch(mode === 'login' ? '/api/auth/login' : '/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'login' ? { identifier, password } : { name, phone: identifier, password, countryCode }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Could not continue')
        return
      }
      onSignedIn({ ...json.user, balance: Number(json.user.balance) })
    } catch {
      setError('Could not reach the server')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="w-full max-w-sm bg-white p-6 shadow-xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#ed1324]">WinnBet</p>
          <h2 className="mt-1 text-xl font-bold">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        </div>
        <button onClick={onClose} aria-label="Close dialog"><X /></button>
      </div>
      {mode === 'register' && (
        <>
          <label className="mb-1 block text-xs font-semibold">Full name</label>
          <input value={name} onChange={(event) => setName(event.target.value)} className="mb-3 h-11 w-full border px-3 text-sm" placeholder="Your name" />
          <label className="mb-1 block text-xs font-semibold">Country</label>
          <select value={countryCode} onChange={(event) => setCountryCode(event.target.value)} className="mb-3 h-11 w-full border px-3 text-sm">
            {countries.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
          </select>
        </>
      )}
      <label className="mb-1 block text-xs font-semibold">{mode === 'login' ? 'Mobile number or email' : 'Mobile number'}</label>
      <input value={identifier} onChange={(event) => setIdentifier(event.target.value)} className="mb-3 h-11 w-full border px-3 text-sm" placeholder="+234 Mobile Number" />
      <label className="mb-1 block text-xs font-semibold">Password</label>
      <input value={password} onChange={(event) => setPassword(event.target.value)} className="mb-4 h-11 w-full border px-3 text-sm" placeholder="Password" type="password" />
      {error && <p className="mb-3 text-xs text-[#ed1324]">{error}</p>}
      <button disabled={busy} onClick={submit} className="w-full bg-[#0b9b3a] py-3 font-semibold text-white disabled:opacity-60">{busy ? 'Please wait…' : mode === 'login' ? 'Login' : 'Register'}</button>
      <button onClick={switchMode} className="mt-4 w-full text-center text-xs text-[#ed1324]">{mode === 'login' ? 'Need an account? Register' : 'Already registered? Login'}</button>
      <p className="mt-4 text-center text-xs text-[#8b8f94]">18+ Gamble responsibly. Never bet more than you can afford.</p>
    </div>
  )
}
