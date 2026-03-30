import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase-server'
import { getStreamingProviders } from '@/lib/tmdb'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceRoleClient()
  await refreshStreamingForUser(db, user.id)

  return NextResponse.json({ success: true })
}

export async function refreshStreamingForUser(db: ReturnType<typeof createServiceRoleClient>, userId: string) {
  // Get all active watchlist films with TMDB IDs
  const { data: watchlistFilms } = await db
    .from('user_watchlist')
    .select('film_id, films!inner(id, tmdb_id, letterboxd_slug)')
    .eq('user_id', userId)
    .is('removed_at', null)

  if (!watchlistFilms || watchlistFilms.length === 0) return

  const now = new Date().toISOString()

  for (const row of watchlistFilms as any[]) {
    const film = row.films
    if (!film.tmdb_id) continue

    const providers = await getStreamingProviders(film.tmdb_id)
    const providerIds = providers.map((p: any) => p.provider_id)

    // Get currently stored providers for this film
    const { data: stored } = await db
      .from('streaming_availability')
      .select('*')
      .eq('film_id', film.id)
      .eq('region', 'US')

    const storedMap = new Map<number, { id: string }>(
      (stored || []).map((s: any) => [s.provider_id as number, s as { id: string }])
    )

    for (const provider of providers) {
      const existing = storedMap.get(provider.provider_id)
      if (existing) {
        // Still available — update last_seen_at
        await db
          .from('streaming_availability')
          .update({ last_seen_at: now })
          .eq('id', existing.id)
      } else {
        // New provider — insert
        await db.from('streaming_availability').insert({
          film_id: film.id,
          provider_id: provider.provider_id,
          provider_name: provider.provider_name,
          provider_logo_path: provider.logo_path,
          region: 'US',
          first_seen_at: now,
          last_seen_at: now,
        })
      }
    }

    // Small delay to respect TMDB rate limits
    await new Promise(resolve => setTimeout(resolve, 50))
  }
}
