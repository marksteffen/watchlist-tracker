import { NextResponse } from 'next/server'
import { getAllStreamingProviders, logoUrl } from '@/lib/tmdb'

export async function GET() {
  try {
    const allProviders = await getAllStreamingProviders('US')
    const providers = allProviders
      .sort((a, b) => a.display_priority - b.display_priority)
      .map(p => ({
        provider_id: p.provider_id,
        provider_name: p.provider_name,
        logo_url: logoUrl(p.logo_path, 'w45'),
      }))
    return NextResponse.json(providers, {
      headers: { 'Cache-Control': 'public, max-age=86400' },
    })
  } catch {
    return NextResponse.json([])
  }
}
