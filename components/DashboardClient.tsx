'use client'

import { useState, useTransition } from 'react'
import { FilmCard } from './FilmCard'
import { useRouter } from 'next/navigation'

interface Provider {
  provider_id: number
  provider_name: string
  provider_logo_path: string | null
  first_seen_at: string
}

interface Film {
  id: string
  title: string
  year: number | null
  poster_url: string | null
  letterboxd_slug: string
  providers: Provider[]
}

interface Props {
  films: Film[]
  subscribedProviderIds: number[]
  lastSynced: string | null
  username: string | null
}

type SortMode = 'new_first' | 'alpha' | 'watchlist'

function Spinner() {
  return (
    <span className="w-3.5 h-3.5 rounded-full border-2 border-zinc-500 border-t-white animate-spin inline-block" />
  )
}

const NEW_THRESHOLD_DAYS = 14

function isNew(firstSeenAt: string): boolean {
  return (Date.now() - new Date(firstSeenAt).getTime()) / (1000 * 60 * 60 * 24) <= NEW_THRESHOLD_DAYS
}

export function DashboardClient({ films, subscribedProviderIds, lastSynced, username }: Props) {
  const [myServicesOnly, setMyServicesOnly] = useState(subscribedProviderIds.length > 0)
  const [sortMode, setSortMode] = useState<SortMode>('new_first')
  const [isSyncing, startSync] = useTransition()
  const [isRefreshing, startRefresh] = useTransition()
  const [statusMessage, setStatusMessage] = useState('')
  const router = useRouter()

  const subscribedSet = new Set(subscribedProviderIds)

  const sorted = [...films].sort((a, b) => {
    if (sortMode === 'alpha') return a.title.localeCompare(b.title)
    if (sortMode === 'new_first') {
      const aHasNew = a.providers.some(p => (!myServicesOnly || subscribedSet.has(p.provider_id)) && isNew(p.first_seen_at))
      const bHasNew = b.providers.some(p => (!myServicesOnly || subscribedSet.has(p.provider_id)) && isNew(p.first_seen_at))
      if (aHasNew && !bHasNew) return -1
      if (!aHasNew && bHasNew) return 1
    }
    return 0
  })

  async function handleSync() {
    startSync(async () => {
      setStatusMessage('')
      const res = await fetch('/api/sync-watchlist', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setStatusMessage(`Synced: +${data.added} added, -${data.removed} removed`)
        router.refresh()
      } else {
        setStatusMessage(data.error || 'Sync failed')
      }
    })
  }

  async function handleRefresh() {
    startRefresh(async () => {
      setStatusMessage('')
      const res = await fetch('/api/refresh-streaming', { method: 'POST' })
      if (res.ok) {
        setStatusMessage('Streaming data refreshed')
        router.refresh()
      } else {
        setStatusMessage('Refresh failed')
      }
    })
  }

  const newCount = films.filter(f =>
    f.providers.some(p =>
      (!myServicesOnly || subscribedSet.has(p.provider_id)) && isNew(p.first_seen_at)
    )
  ).length

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 px-4 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-white">
              Watchlist Tracker
              {username && <span className="ml-2 text-zinc-400 font-normal text-sm">@{username}</span>}
            </h1>
            {lastSynced && (
              <p className="text-xs text-zinc-500 mt-0.5">
                Last synced {new Date(lastSynced).toLocaleString()}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSync}
              disabled={isSyncing || isRefreshing}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 transition-colors"
            >
              {isSyncing && <Spinner />}
              {isSyncing ? 'Syncing…' : 'Sync Watchlist'}
            </button>
            <button
              onClick={handleRefresh}
              disabled={isSyncing || isRefreshing}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 transition-colors"
            >
              {isRefreshing && <Spinner />}
              {isRefreshing ? 'Refreshing…' : 'Refresh Streaming'}
            </button>
            <a
              href="/settings"
              className="text-sm px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors"
            >
              Settings
            </a>
          </div>
        </div>
      </header>

      {/* Controls */}
      <div className="border-b border-zinc-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-4">
          {/* Summary */}
          <div className="flex items-center gap-3 text-sm text-zinc-400">
            <span>{films.length} films</span>
            {newCount > 0 && (
              <span className="text-emerald-400 font-medium">{newCount} newly streaming</span>
            )}
          </div>

          <div className="ml-auto flex items-center gap-3">
            {/* My services toggle */}
            {subscribedProviderIds.length > 0 && (
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <div
                  onClick={() => setMyServicesOnly(v => !v)}
                  className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${myServicesOnly ? 'bg-emerald-500' : 'bg-zinc-700'}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${myServicesOnly ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-zinc-300">My services only</span>
              </label>
            )}

            {/* Sort */}
            <select
              value={sortMode}
              onChange={e => setSortMode(e.target.value as SortMode)}
              className="text-sm bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-300"
            >
              <option value="new_first">Newly streaming first</option>
              <option value="alpha">Alphabetical</option>
              <option value="watchlist">Watchlist order</option>
            </select>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="px-4 py-2 max-w-7xl mx-auto">
          <p className="text-sm text-emerald-400">{statusMessage}</p>
        </div>
      )}

      {/* Film grid */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {films.length === 0 && isSyncing ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {Array.from({ length: 18 }).map((_, i) => (
              <div key={i} className="animate-pulse rounded-lg overflow-hidden bg-zinc-800 aspect-[2/3]" />
            ))}
          </div>
        ) : films.length === 0 ? (
          <div className="text-center py-20 text-zinc-500">
            <p className="text-lg">No films yet.</p>
            <p className="text-sm mt-2">
              {username
                ? 'Click "Sync Watchlist" to load your Letterboxd watchlist.'
                : 'Go to Settings to set your Letterboxd username first.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {sorted.map(film => (
              <FilmCard
                key={film.id}
                title={film.title}
                year={film.year}
                posterUrl={film.poster_url}
                letterboxdSlug={film.letterboxd_slug}
                providers={film.providers}
                subscribedProviderIds={subscribedSet}
                showAllProviders={!myServicesOnly || subscribedProviderIds.length === 0}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
