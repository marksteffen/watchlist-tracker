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

export function SettingsClient({ userId, initialUsername, initialSubscriptions, providers }: Props) {
  const [username, setUsername] = useState(initialUsername)
  const [subscriptions, setSubscriptions] = useState<Set<number>>(new Set(initialSubscriptions))
  const [saving, startSaving] = useTransition()
  const [validating, startValidating] = useTransition()
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'valid' | 'invalid'>('idle')
  const [saveStatus, setSaveStatus] = useState('')
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

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaveStatus('')
    startSaving(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('users')
        .update({
          letterboxd_username: username.trim() || null,
          streaming_subscriptions: [...subscriptions].map(String),
        })
        .eq('id', userId)

      if (error) {
        setSaveStatus('Failed to save: ' + error.message)
      } else {
        setSaveStatus('Saved!')
        router.refresh()
      }
    })
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/dashboard" className="text-zinc-400 hover:text-white text-sm">← Dashboard</a>
            <h1 className="text-lg font-bold">Settings</h1>
          </div>
          <button
            onClick={handleSignOut}
            className="text-sm text-zinc-400 hover:text-red-400 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <form onSubmit={handleSave} className="space-y-10">

          {/* Letterboxd Username */}
          <section>
            <h2 className="text-base font-semibold text-white mb-1">Letterboxd username</h2>
            <p className="text-sm text-zinc-400 mb-3">
              Enter your Letterboxd username. Your watchlist must be public.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
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
            </div>
            {usernameStatus === 'valid' && (
              <p className="text-emerald-400 text-sm mt-1">Username found</p>
            )}
            {usernameStatus === 'invalid' && (
              <p className="text-red-400 text-sm mt-1">Username not found or watchlist is private</p>
            )}
          </section>

          {/* Streaming Services */}
          <section>
            <h2 className="text-base font-semibold text-white mb-1">My streaming services</h2>
            <p className="text-sm text-zinc-400 mb-3">
              Select the services you subscribe to. The dashboard will prioritize films available on these.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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

          {/* Save */}
          <div className="flex items-center gap-4">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-lg transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save settings'}
            </button>
            {saveStatus && (
              <p className={`text-sm ${saveStatus.startsWith('Failed') ? 'text-red-400' : 'text-emerald-400'}`}>
                {saveStatus}
              </p>
            )}
          </div>
        </form>
      </main>
    </div>
  )
}
