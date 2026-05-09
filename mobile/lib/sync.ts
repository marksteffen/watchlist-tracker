import { syncWatchlist, refreshStreaming } from './api'
import type { SyncResult } from '@shared/types'

export async function syncAll(jwt: string): Promise<SyncResult> {
  const watchlistResult = await syncWatchlist(jwt)
  if (!watchlistResult.ok) {
    return { ok: false, error: watchlistResult.error }
  }
  const streamingResult = await refreshStreaming(jwt)
  if (!streamingResult.ok) {
    return { ok: false, error: streamingResult.error }
  }
  return { ok: true }
}
