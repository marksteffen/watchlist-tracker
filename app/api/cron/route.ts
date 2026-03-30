import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase-server'
import { refreshStreamingForUser } from '@/app/api/refresh-streaming/route'
import { fetchWatchlist } from '@/lib/letterboxd'
import { searchFilm, posterUrl } from '@/lib/tmdb'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = createServiceRoleClient()
  const now = new Date()

  // Get all users
  const { data: users } = await db.from('users').select('id, letterboxd_username, watchlist_last_synced_at')

  if (!users || users.length === 0) {
    return NextResponse.json({ message: 'No users', processed: 0 })
  }

  let processed = 0

  for (const user of users) {
    try {
      // Re-sync watchlist weekly (or if never synced)
      const lastSynced = user.watchlist_last_synced_at ? new Date(user.watchlist_last_synced_at) : null
      const daysSinceSync = lastSynced
        ? (now.getTime() - lastSynced.getTime()) / (1000 * 60 * 60 * 24)
        : Infinity

      if (user.letterboxd_username && daysSinceSync >= 7) {
        await syncWatchlistForUser(db, user.id, user.letterboxd_username)
      }

      // Refresh streaming daily
      await refreshStreamingForUser(db, user.id)
      processed++
    } catch (err) {
      console.error(`Error processing user ${user.id}:`, err)
    }
  }

  return NextResponse.json({ message: 'Done', processed })
}

async function syncWatchlistForUser(
  db: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  username: string
) {
  const watchlistFilms = await fetchWatchlist(username)

  const { data: existingWatchlist } = await db
    .from('user_watchlist')
    .select('film_id, films!inner(letterboxd_slug)')
    .eq('user_id', userId)
    .is('removed_at', null)

  const existingSlugs = new Set(
    (existingWatchlist || []).map((row: any) => row.films.letterboxd_slug)
  )
  const newSlugs = new Set(watchlistFilms.map((f: any) => f.slug))

  // Soft-delete removed films
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
        .eq('user_id', userId)
        .in('film_id', filmsToRemove.map((f: any) => f.id))
    }
  }

  // Add new films
  const newFilms = watchlistFilms.filter((f: any) => !existingSlugs.has(f.slug))
  for (const film of newFilms) {
    const { data: existingFilm } = await db
      .from('films')
      .select('id')
      .eq('letterboxd_slug', film.slug)
      .single()

    let filmId: string
    if (existingFilm) {
      filmId = existingFilm.id
    } else {
      const tmdbResult = await searchFilm(film.title, film.year)
      const { data: newFilm } = await db
        .from('films')
        .insert({
          letterboxd_slug: film.slug,
          title: film.title,
          year: film.year,
          tmdb_id: tmdbResult?.id ?? null,
          poster_url: tmdbResult?.poster_path ? posterUrl(tmdbResult.poster_path) : null,
        })
        .select('id')
        .single()
      if (!newFilm) continue
      filmId = newFilm.id
    }

    await db.from('user_watchlist').upsert(
      { user_id: userId, film_id: filmId, added_at: new Date().toISOString(), removed_at: null },
      { onConflict: 'user_id,film_id', ignoreDuplicates: false }
    )
  }

  await db.from('users').update({ watchlist_last_synced_at: new Date().toISOString() }).eq('id', userId)
}
