export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string | null
          letterboxd_username: string | null
          streaming_subscriptions: string[]
          watchlist_last_synced_at: string | null
          created_at: string
        }
        Insert: {
          id: string
          email?: string | null
          letterboxd_username?: string | null
          streaming_subscriptions?: string[]
          watchlist_last_synced_at?: string | null
          created_at?: string
        }
        Update: {
          email?: string | null
          letterboxd_username?: string | null
          streaming_subscriptions?: string[]
          watchlist_last_synced_at?: string | null
        }
      }
      films: {
        Row: {
          id: string
          letterboxd_slug: string
          title: string
          year: number | null
          tmdb_id: number | null
          poster_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          letterboxd_slug: string
          title: string
          year?: number | null
          tmdb_id?: number | null
          poster_url?: string | null
          created_at?: string
        }
        Update: {
          title?: string
          year?: number | null
          tmdb_id?: number | null
          poster_url?: string | null
        }
      }
      user_watchlist: {
        Row: {
          id: string
          user_id: string
          film_id: string
          added_at: string
          removed_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          film_id: string
          added_at?: string
          removed_at?: string | null
        }
        Update: {
          removed_at?: string | null
        }
      }
      streaming_availability: {
        Row: {
          id: string
          film_id: string
          provider_id: number
          provider_name: string
          provider_logo_path: string | null
          region: string
          first_seen_at: string
          last_seen_at: string
        }
        Insert: {
          id?: string
          film_id: string
          provider_id: number
          provider_name: string
          provider_logo_path?: string | null
          region?: string
          first_seen_at?: string
          last_seen_at?: string
        }
        Update: {
          last_seen_at?: string
        }
      }
    }
  }
}

export type UserRow = Database['public']['Tables']['users']['Row']
export type FilmRow = Database['public']['Tables']['films']['Row']
export type WatchlistRow = Database['public']['Tables']['user_watchlist']['Row']
export type StreamingRow = Database['public']['Tables']['streaming_availability']['Row']
