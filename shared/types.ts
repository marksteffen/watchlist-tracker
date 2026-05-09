export interface Provider {
  provider_id: number
  provider_name: string
  provider_logo_path: string | null
  first_seen_at?: string
}

export interface Film {
  id: string
  title: string
  year: number | null
  poster_url: string | null
  letterboxd_slug: string
  providers: Provider[]
}

export interface SyncResult {
  ok: boolean
  error?: string
}
