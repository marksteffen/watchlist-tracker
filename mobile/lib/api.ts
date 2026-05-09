const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL!

export async function syncWatchlist(jwt: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${apiBase}/api/sync-watchlist`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${jwt}` },
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { ok: false, error: data.error ?? `Sync failed (${res.status})` }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Network error' }
  }
}

export async function refreshStreaming(jwt: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${apiBase}/api/refresh-streaming`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${jwt}` },
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { ok: false, error: data.error ?? `Refresh failed (${res.status})` }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Network error' }
  }
}

export async function validateUsername(username: string): Promise<boolean> {
  try {
    const res = await fetch(`${apiBase}/api/validate-username?username=${encodeURIComponent(username)}`)
    if (!res.ok) return false
    const data = await res.json()
    return data.valid === true
  } catch {
    return false
  }
}

export interface ProviderWithLogo {
  provider_id: number
  provider_name: string
  logo_url: string | null
}

export async function fetchStreamingProviders(): Promise<ProviderWithLogo[]> {
  try {
    const res = await fetch(`${apiBase}/api/streaming-providers`)
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}
