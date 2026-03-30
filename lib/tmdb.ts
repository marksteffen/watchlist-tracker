import axios from 'axios'

const TMDB_BASE = 'https://api.themoviedb.org/3'
const IMAGE_BASE = 'https://image.tmdb.org/t/p'

export interface TmdbProvider {
  provider_id: number
  provider_name: string
  logo_path: string
  display_priority: number
}

export interface StreamingResult {
  providers: TmdbProvider[]
}

export interface TmdbFilm {
  id: number
  title: string
  release_date: string
  poster_path: string | null
}

function apiKey() {
  return process.env.TMDB_API_KEY!
}

export async function searchFilm(title: string, year: number | null): Promise<TmdbFilm | null> {
  try {
    const params: Record<string, string | number> = {
      api_key: apiKey(),
      query: title,
      include_adult: 'false',
    }
    if (year) params.year = year

    const { data } = await axios.get(`${TMDB_BASE}/search/movie`, { params, timeout: 8000 })
    const results: TmdbFilm[] = data.results || []
    return results[0] ?? null
  } catch {
    return null
  }
}

export async function getStreamingProviders(
  tmdbId: number,
  region = 'US'
): Promise<TmdbProvider[]> {
  try {
    const { data } = await axios.get(`${TMDB_BASE}/movie/${tmdbId}/watch/providers`, {
      params: { api_key: apiKey() },
      timeout: 8000,
    })
    const regionData = data.results?.[region]
    return (regionData?.flatrate as TmdbProvider[]) ?? []
  } catch {
    return []
  }
}

export async function getAllStreamingProviders(region = 'US'): Promise<TmdbProvider[]> {
  try {
    const { data } = await axios.get(`${TMDB_BASE}/watch/providers/movie`, {
      params: { api_key: apiKey(), watch_region: region },
      timeout: 8000,
    })
    return (data.results as TmdbProvider[]) ?? []
  } catch {
    return []
  }
}

export function posterUrl(path: string | null, size = 'w342'): string | null {
  if (!path) return null
  return `${IMAGE_BASE}/${size}${path}`
}

export function logoUrl(path: string | null, size = 'w45'): string | null {
  if (!path) return null
  return `${IMAGE_BASE}/${size}${path}`
}
