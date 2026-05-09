// For provider picker UIs (onboarding, settings)
export interface ProviderOption {
  provider_id: number
  provider_name: string
  provider_logo_path: string | null
}

// For streaming availability records (dashboard)
export interface StreamingProvider extends ProviderOption {
  first_seen_at: string
}

export interface Film {
  id: string
  title: string
  year: number | null
  poster_url: string | null
  letterboxd_slug: string
  providers: StreamingProvider[]
}

export interface SyncResult {
  ok: boolean
  error?: string
}
