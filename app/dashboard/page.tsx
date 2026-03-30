import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase-server'
import { DashboardClient } from '@/components/DashboardClient'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth')

  const db = createServiceRoleClient()

  // Get user profile
  const { data: profile } = await db
    .from('users')
    .select('letterboxd_username, streaming_subscriptions, watchlist_last_synced_at')
    .eq('id', user.id)
    .single()

  // Guard: send incomplete profiles to onboarding
  if (!profile?.letterboxd_username || (profile?.streaming_subscriptions ?? []).length === 0) {
    redirect('/onboarding')
  }

  // Get watchlist with streaming availability
  const { data: watchlistRows } = await db
    .from('user_watchlist')
    .select(`
      film_id,
      films!inner (
        id,
        title,
        year,
        poster_url,
        letterboxd_slug,
        streaming_availability (
          provider_id,
          provider_name,
          provider_logo_path,
          first_seen_at,
          last_seen_at
        )
      )
    `)
    .eq('user_id', user.id)
    .is('removed_at', null)

  // Filter: only include streaming entries that were seen within the last 30 days
  // (a proxy for "still available" — if last_seen_at is old, the provider may have dropped it)
  const STALE_DAYS = 30
  const staleThreshold = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const films = (watchlistRows || []).map((row: any) => {
    const film = row.films
    const activeProviders = (film.streaming_availability || []).filter(
      (p: any) => p.last_seen_at >= staleThreshold
    )
    return {
      id: film.id,
      title: film.title,
      year: film.year,
      poster_url: film.poster_url,
      letterboxd_slug: film.letterboxd_slug,
      providers: activeProviders.map((p: any) => ({
        provider_id: p.provider_id,
        provider_name: p.provider_name,
        provider_logo_path: p.provider_logo_path,
        first_seen_at: p.first_seen_at,
      })),
    }
  })

  return (
    <DashboardClient
      films={films}
      subscribedProviderIds={(profile?.streaming_subscriptions || []).map(Number)}
      lastSynced={profile?.watchlist_last_synced_at ?? null}
      username={profile?.letterboxd_username ?? null}
    />
  )
}
