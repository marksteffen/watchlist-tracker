'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

interface Provider {
  provider_id: number
  provider_name: string
  logo_url: string | null
}

interface Props {
  userId: string
  initialUsername: string
  initialSubscriptions: number[]
  providers: Provider[]
}

export function OnboardingClient({ userId, initialUsername, initialSubscriptions, providers }: Props) {
  const [username, setUsername] = useState(initialUsername)
  const [subscriptions, setSubscriptions] = useState<Set<number>>(new Set(initialSubscriptions))
  const [saving, startSaving] = useTransition()
  const [validating, startValidating] = useTransition()
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'valid' | 'invalid'>(
    initialUsername ? 'valid' : 'idle'
  )
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function validateUsername() {
    if (!username.trim()) return
    startValidating(async () => {
      const res = await fetch(`/api/validate-username?username=${encodeURIComponent(username.trim())}`)
      const data = await res.json()
      setUsernameStatus(data.valid ? 'valid' : 'invalid')
    })
  }

  function toggleProvider(id: number) {
    setSubscriptions(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleContinue(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!username.trim()) {
      setError('Please enter your Letterboxd username.')
      return
    }
    if (usernameStatus === 'invalid') {
      setError('That Letterboxd username wasn\'t found. Please check it and try again.')
      return
    }
    if (subscriptions.size === 0) {
      setError('Please select at least one streaming service.')
      return
    }

    startSaving(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: dbError } = await (supabase as any)
        .from('users')
        .update({
          letterboxd_username: username.trim(),
          streaming_subscriptions: [...subscriptions].map(String),
        })
        .eq('id', userId)

      if (dbError) {
        setError('Failed to save: ' + dbError.message)
        return
      }

      // Kick off initial watchlist sync in the background
      fetch('/api/sync-watchlist', { method: 'POST' })

      router.push('/dashboard')
    })
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      <header className="border-b border-zinc-800 px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-lg font-bold">Streamlist</h1>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-10">
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-2">Welcome! Let&apos;s set up your account.</h2>
          <p className="text-zinc-400 text-sm">
            Just two quick steps and your dashboard will be ready to go.
          </p>
        </div>

        <form onSubmit={handleContinue} className="space-y-10">

          {/* Step 1: Letterboxd username */}
          <section>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-6 h-6 rounded-full bg-emerald-500 text-black text-xs font-bold flex items-center justify-center">1</span>
              <h3 className="text-base font-semibold">Your Letterboxd username</h3>
            </div>
            <p className="text-sm text-zinc-400 mb-3 ml-8">
              Your watchlist must be public. We&apos;ll use it to track streaming availability.
            </p>
            <div className="ml-8">
              <div className="relative">
                <span className="absolute inset-y-0 left-3 flex items-center text-zinc-500 text-sm">letterboxd.com/</span>
                <input
                  type="text"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setUsernameStatus('idle') }}
                  onBlur={validateUsername}
                  placeholder="yourname"
                  className="w-full pl-32 pr-4 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
              {validating && (
                <p className="text-zinc-400 text-sm mt-1">Checking…</p>
              )}
              {!validating && usernameStatus === 'valid' && (
                <p className="text-emerald-400 text-sm mt-1">Username found</p>
              )}
              {!validating && usernameStatus === 'invalid' && (
                <p className="text-red-400 text-sm mt-1">Username not found or watchlist is private</p>
              )}
            </div>
          </section>

          {/* Step 2: Streaming services */}
          <section>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-6 h-6 rounded-full bg-emerald-500 text-black text-xs font-bold flex items-center justify-center">2</span>
              <h3 className="text-base font-semibold">Your streaming services</h3>
            </div>
            <p className="text-sm text-zinc-400 mb-3 ml-8">
              Select every service you subscribe to. Your dashboard will highlight films available on these.
            </p>
            <div className="ml-8 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {providers.map(p => {
                const checked = subscriptions.has(p.provider_id)
                return (
                  <button
                    key={p.provider_id}
                    type="button"
                    onClick={() => toggleProvider(p.provider_id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors text-left ${
                      checked
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-300'
                        : 'bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                    }`}
                  >
                    {p.logo_url && (
                      <div className="relative w-6 h-6 rounded overflow-hidden flex-shrink-0">
                        <Image src={p.logo_url} alt={p.provider_name} fill className="object-cover" sizes="24px" />
                      </div>
                    )}
                    <span className="truncate">{p.provider_name}</span>
                    {checked && <span className="ml-auto text-emerald-400 text-xs">✓</span>}
                  </button>
                )
              })}
            </div>
          </section>

          {/* Error */}
          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={saving || validating}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-lg transition-colors disabled:opacity-60"
          >
            {saving ? 'Setting up…' : 'Go to my dashboard'}
          </button>
        </form>
      </main>
    </div>
  )
}
