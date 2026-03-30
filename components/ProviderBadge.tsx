'use client'

import Image from 'next/image'
import { logoUrl } from '@/lib/tmdb'

interface Props {
  providerName: string
  logoPath: string | null
}

export function ProviderBadge({ providerName, logoPath }: Props) {
  const src = logoUrl(logoPath, 'w45')

  return (
    <div
      className="relative h-7 w-7 rounded overflow-hidden bg-zinc-800 flex-shrink-0"
      title={providerName}
    >
      {src ? (
        <Image src={src} alt={providerName} fill className="object-cover" sizes="28px" />
      ) : (
        <span className="text-[8px] text-white flex items-center justify-center h-full text-center leading-tight px-0.5">
          {providerName.slice(0, 3)}
        </span>
      )}
    </div>
  )
}
