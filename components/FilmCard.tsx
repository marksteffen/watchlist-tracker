'use client'

import Image from 'next/image'
import { ProviderBadge } from './ProviderBadge'

interface Provider {
  provider_id: number
  provider_name: string
  provider_logo_path: string | null
  first_seen_at: string
}

interface Props {
  title: string
  year: number | null
  posterUrl: string | null
  letterboxdSlug: string
  providers: Provider[]
  subscribedProviderIds: Set<number>
  showAllProviders: boolean
}

const NEW_THRESHOLD_DAYS = 14

function isNew(firstSeenAt: string): boolean {
  const diffMs = Date.now() - new Date(firstSeenAt).getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return diffDays <= NEW_THRESHOLD_DAYS
}

export function FilmCard({
  title,
  year,
  posterUrl,
  letterboxdSlug,
  providers,
  subscribedProviderIds,
  showAllProviders,
}: Props) {
  const visibleProviders = showAllProviders
    ? providers
    : providers.filter(p => subscribedProviderIds.has(p.provider_id))

  const hasNewProvider = visibleProviders.some(p => isNew(p.first_seen_at))
  const isAvailableOnMyServices = subscribedProviderIds.size > 0
    ? providers.some(p => subscribedProviderIds.has(p.provider_id))
    : providers.length > 0

  const dimmed = !showAllProviders && subscribedProviderIds.size > 0 && !isAvailableOnMyServices

  return (
    <div className={`relative rounded-lg overflow-hidden bg-zinc-900 transition-opacity ${dimmed ? 'opacity-40' : 'opacity-100'}`}>
      {/* Poster */}
      <div className="relative aspect-[2/3] bg-zinc-800">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-500 text-sm text-center px-2">
            {title}
          </div>
        )}

        {/* NEW badge */}
        {hasNewProvider && (
          <div className="absolute top-2 left-2 bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
            New
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-2">
        <a
          href={`https://letterboxd.com/film/${letterboxdSlug}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-xs font-medium text-white hover:text-emerald-400 truncate leading-tight"
          title={title}
        >
          {title}
        </a>
        {year && <p className="text-[11px] text-zinc-500 mt-0.5">{year}</p>}

        {/* Provider badges */}
        {visibleProviders.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {visibleProviders.map(p => (
              <div key={p.provider_id} className="relative">
                <ProviderBadge providerName={p.provider_name} logoPath={p.provider_logo_path} />
                {isNew(p.first_seen_at) && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full border border-zinc-900" />
                )}
              </div>
            ))}
          </div>
        )}

        {visibleProviders.length === 0 && providers.length > 0 && !showAllProviders && (
          <p className="text-[11px] text-zinc-600 mt-2">Not on your services</p>
        )}

        {providers.length === 0 && (
          <p className="text-[11px] text-zinc-600 mt-2">Not streaming</p>
        )}
      </div>
    </div>
  )
}
