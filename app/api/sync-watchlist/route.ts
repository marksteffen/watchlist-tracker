import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase-server'
import { fetchWatchlist } from '@/lib/letterboxd'
import { searchFilm, posterUrl } from '@/lib/tmdb'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get user's Letterboxd username
  const db = createServiceRoleClient()
  const { data: profile } = await db
    .from('users')
    .select('letterboxd_username')
    .eq('id', user.id)
    .single()

  if (!profile?.letterboxd_username) {
    return NextResponse.json({ error: 'No Letterboxd username set' }, { status: 400 })
  }

  const username = profile.letterboxd_username

  // Fetch current watchlist from Letterboxd
  let watchlistFilms
  try {
    watchlistFilms = await fetchWatchlist(username)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch Letterboxd watchlist' }, { status: 502 })
  }

  // Get existing watchlist from DB
  const { data: existingWatchlist } = await db
    .from('user_watchlist')
    .select('film_id, films!inner(letterboxd_slug)')
    .eq('user_id', user.id)
    .is('removed_at', null)

  const existingSlugs = new Set<string>(
    (existingWatchlist || []).map((row: any) => row.films.letterboxd_slug as string)
  )
  const newSlugs = new Set(watchlistFilms.map(f => f.slug))

  // Soft-delete films removed from watchlist
  const removedSlugs = [...existingSlugs].filter(s => !newSlugs.has(s))
  if (removedSlugs.length > 0) {
    const { data: filmsToRemove } = await db
      .from('films')
      .select('id')
      .in('letterboxd_slug', removedSlugs)

    if (filmsToRemove && filmsToRemove.length > 0) {
      await db
        .from('user_watchlist')
        .update({ removed_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .in('film_id', filmsToRemove.map((f: any) => f.id))
    }
  }

  // Add new films
  const newFilms = watchlistFilms.filter(f => !existingSlugs.has(f.slug))
  let addedCount = 0

  for (const film of newFilms) {
    // Upsert film into films table
    const { data: existingFilm } = await db
      .from('films')
      .select('id, tmdb_id')
      .eq('letterboxd_slug', film.slug)
      .single()

    let filmId: string
    let tmdbId: number | null = null

    if (existingFilm) {
      filmId = existingFilm.id
      tmdbId = existingFilm.tmdb_id
    } else {
      // Look up on TMDB
      const tmdbResult = await searchFilm(film.title, film.year)
      tmdbId = tmdbResult?.id ?? null

      const { data: newFilm } = await db
        .from('films')
        .insert({
          letterboxd_slug: film.slug,
          title: film.title,
          year: film.year,
          tmdb_id: tmdbId,
          poster_url: tmdbResult?.poster_path ? posterUrl(tmdbResult.poster_path) : null,
        })
        .select('id')
        .single()

      if (!newFilm) continue
      filmId = newFilm.id
    }

    // Add to user watchlist
    await db
      .from('user_watchlist')
      .upsert(
        { user_id: user.id, film_id: filmId, added_at: new Date().toISOString(), removed_at: null },
        { onConflict: 'user_id,film_id', ignoreDuplicates: false }
      )

    addedCount++
  }

  // Update last synced timestamp
  await db
    .from('users')
    .update({ watchlist_last_synced_at: new Date().toISOString() })
    .eq('id', user.id)

  return NextResponse.json({
    added: addedCount,
    removed: removedSlugs.length,
    total: watchlistFilms.length,
  })
}
