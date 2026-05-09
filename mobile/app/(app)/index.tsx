import { useCallback, useEffect, useState } from 'react'
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { useSession } from '@/lib/session'
import { supabase } from '@/lib/supabase'
import { syncWatchlist, refreshStreaming } from '@/lib/api'
import { FilmCard } from '@/components/FilmCard'
import type { Film, StreamingProvider } from '@shared/types'
import { PROVIDER_ACTIVE_WINDOW_DAYS, NEW_THRESHOLD_DAYS } from '@shared/constants'

type SortMode = 'new_first' | 'alpha'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isNew(firstSeenAt: string): boolean {
  return (Date.now() - new Date(firstSeenAt).getTime()) / (1000 * 60 * 60 * 24) <= NEW_THRESHOLD_DAYS
}

function staleThresholdISO(): string {
  const d = new Date()
  d.setDate(d.getDate() - PROVIDER_ACTIVE_WINDOW_DAYS)
  return d.toISOString()
}

// ---------------------------------------------------------------------------
// Skeleton card
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <View style={skeletonStyles.card}>
      <View style={skeletonStyles.poster} />
      <View style={skeletonStyles.info}>
        <View style={skeletonStyles.line} />
        <View style={[skeletonStyles.line, skeletonStyles.lineShort]} />
      </View>
    </View>
  )
}

const skeletonStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#27272a',
    borderRadius: 8,
    overflow: 'hidden',
  },
  poster: {
    aspectRatio: 2 / 3,
    backgroundColor: '#3f3f46',
  },
  info: {
    padding: 6,
    gap: 4,
  },
  line: {
    height: 10,
    backgroundColor: '#3f3f46',
    borderRadius: 4,
  },
  lineShort: {
    width: '50%',
  },
})

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

interface UserData {
  letterboxd_username: string | null
  streaming_subscriptions: string[] | null
  last_synced_at: string | null
}

export default function DashboardScreen() {
  const { session } = useSession()

  const [isLoading, setIsLoading] = useState(true)
  const [films, setFilms] = useState<Film[]>([])
  const [subscribedProviderIds, setSubscribedProviderIds] = useState<Set<number>>(new Set())
  const [userData, setUserData] = useState<UserData | null>(null)
  const [myServicesOnly, setMyServicesOnly] = useState(false)
  const [sortMode, setSortMode] = useState<SortMode>('new_first')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [statusIsError, setStatusIsError] = useState(false)

  // ---------------------------------------------------------------------------
  // Data fetch
  // ---------------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    if (!session) return

    const userId = session.user.id

    // Check onboarding
    const { data: user } = await supabase
      .from('users')
      .select('letterboxd_username, streaming_subscriptions, last_synced_at')
      .eq('id', userId)
      .single()

    if (!user?.letterboxd_username) {
      router.replace('/(app)/onboarding')
      return
    }

    setUserData(user as UserData)

    const subIds = new Set<number>(
      (Array.isArray(user.streaming_subscriptions) ? user.streaming_subscriptions : []).map(Number)
    )
    setSubscribedProviderIds(subIds)
    setMyServicesOnly(subIds.size > 0)

    // Fetch watchlist with streaming availability
    const stale = staleThresholdISO()
    const { data: watchlistRows } = await supabase
      .from('user_watchlist')
      .select(`
        film_id,
        films!inner (
          id, title, year, poster_url, letterboxd_slug,
          streaming_availability (
            provider_id, provider_name, provider_logo_path,
            first_seen_at, last_seen_at
          )
        )
      `)
      .eq('user_id', userId)
      .is('removed_at', null)

    if (!watchlistRows) {
      setFilms([])
      setIsLoading(false)
      return
    }

    const mapped: Film[] = watchlistRows.map((row) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const filmRaw = (row as any).films as {
        id: string
        title: string
        year: number | null
        poster_url: string | null
        letterboxd_slug: string
        streaming_availability: Array<{
          provider_id: number
          provider_name: string
          provider_logo_path: string | null
          first_seen_at: string
          last_seen_at: string
        }>
      }

      const providers: StreamingProvider[] = (filmRaw.streaming_availability ?? [])
        .filter((sa) => sa.last_seen_at >= stale)
        .map((sa) => ({
          provider_id: sa.provider_id,
          provider_name: sa.provider_name,
          provider_logo_path: sa.provider_logo_path,
          first_seen_at: sa.first_seen_at,
        }))

      return {
        id: filmRaw.id,
        title: filmRaw.title,
        year: filmRaw.year,
        poster_url: filmRaw.poster_url,
        letterboxd_slug: filmRaw.letterboxd_slug,
        providers,
      }
    })

    setFilms(mapped)
    setIsLoading(false)
  }, [session])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ---------------------------------------------------------------------------
  // Pull-to-refresh
  // ---------------------------------------------------------------------------

  const handleRefresh = useCallback(async () => {
    if (!session) return
    setIsRefreshing(true)
    setStatusMessage('')
    setStatusIsError(false)

    const jwt = session.access_token
    const [syncResult, refreshResult] = await Promise.all([
      syncWatchlist(jwt),
      refreshStreaming(jwt),
    ])

    if (!syncResult.ok || !refreshResult.ok) {
      setStatusMessage(syncResult.error ?? refreshResult.error ?? 'Sync failed')
      setStatusIsError(true)
    } else {
      setStatusMessage('Synced')
      setStatusIsError(false)
    }

    await fetchData()
    setIsRefreshing(false)
  }, [session, fetchData])

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const currentSubscribedSet = myServicesOnly ? subscribedProviderIds : new Set<number>()
  const showAllProviders = !myServicesOnly || subscribedProviderIds.size === 0

  const visibleFilms = myServicesOnly && subscribedProviderIds.size > 0
    ? films.filter(f => f.providers.some(p => subscribedProviderIds.has(p.provider_id)))
    : films

  const sorted = [...visibleFilms].sort((a, b) => {
    if (sortMode === 'alpha') return a.title.localeCompare(b.title)
    // new_first
    const aHasNew = a.providers.some(p =>
      (!myServicesOnly || currentSubscribedSet.has(p.provider_id)) && isNew(p.first_seen_at)
    )
    const bHasNew = b.providers.some(p =>
      (!myServicesOnly || currentSubscribedSet.has(p.provider_id)) && isNew(p.first_seen_at)
    )
    if (aHasNew && !bHasNew) return -1
    if (!aHasNew && bHasNew) return 1
    return 0
  })

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const lastSynced = userData?.last_synced_at
    ? new Date(userData.last_synced_at).toLocaleString()
    : null

  const username = userData?.letterboxd_username ?? null

  // Header component rendered inside FlatList
  const ListHeader = (
    <View>
      {/* App header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>
            Watchlist Tracker
            {username ? (
              <Text style={styles.headerUsername}> @{username}</Text>
            ) : null}
          </Text>
          {lastSynced && (
            <Text style={styles.headerSub}>Last synced {lastSynced}</Text>
          )}
        </View>
        <Pressable
          onPress={() => router.push('/(app)/settings' as Parameters<typeof router.push>[0])}
          style={styles.settingsBtn}
        >
          <Text style={styles.settingsBtnText}>Settings</Text>
        </Pressable>
      </View>

      {/* Status message */}
      {!!statusMessage && (
        <View style={styles.statusBar}>
          <Text style={[styles.statusText, statusIsError && styles.statusError]}>
            {statusMessage}
          </Text>
        </View>
      )}

      {/* Controls */}
      <View style={styles.controls}>
        {/* My services toggle */}
        {subscribedProviderIds.size > 0 && (
          <Pressable
            style={styles.toggleRow}
            onPress={() => setMyServicesOnly(v => !v)}
          >
            <View style={[styles.toggleTrack, myServicesOnly && styles.toggleTrackOn]}>
              <View style={[styles.toggleThumb, myServicesOnly && styles.toggleThumbOn]} />
            </View>
            <Text style={styles.toggleLabel}>My services only</Text>
          </Pressable>
        )}

        {/* Sort toggle */}
        <View style={styles.sortRow}>
          <Pressable
            onPress={() => setSortMode('new_first')}
            style={[styles.sortBtn, sortMode === 'new_first' && styles.sortBtnActive]}
          >
            <Text style={[styles.sortBtnText, sortMode === 'new_first' && styles.sortBtnTextActive]}>
              Newest
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setSortMode('alpha')}
            style={[styles.sortBtn, sortMode === 'alpha' && styles.sortBtnActive]}
          >
            <Text style={[styles.sortBtnText, sortMode === 'alpha' && styles.sortBtnTextActive]}>
              A–Z
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  )

  // Loading skeleton
  if (isLoading) {
    return (
      <View style={styles.container}>
        {ListHeader}
        <View style={styles.grid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={i} style={styles.gridItem}>
              <SkeletonCard />
            </View>
          ))}
        </View>
      </View>
    )
  }

  // Empty state
  if (films.length === 0) {
    return (
      <View style={styles.container}>
        {ListHeader}
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No films yet.</Text>
          <Text style={styles.emptySub}>Pull down to sync your watchlist.</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        numColumns={2}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.columnWrapper}
        renderItem={({ item }) => (
          <View style={styles.gridItem}>
            <FilmCard
              film={item}
              subscribedProviderIds={subscribedProviderIds}
              showAllProviders={showAllProviders}
            />
          </View>
        )}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#10b981"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No films on your services.</Text>
            <Text style={styles.emptySub}>Toggle off "My services only" to see all.</Text>
          </View>
        }
      />
    </View>
  )
}

const COLUMN_GAP = 8
const GRID_PADDING = 12

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  listContent: {
    paddingBottom: 32,
  },
  columnWrapper: {
    gap: COLUMN_GAP,
    paddingHorizontal: GRID_PADDING,
    marginBottom: COLUMN_GAP,
  },
  gridItem: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: COLUMN_GAP,
    paddingHorizontal: GRID_PADDING,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    marginBottom: 0,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  headerUsername: {
    color: '#a1a1aa',
    fontWeight: '400',
    fontSize: 14,
  },
  headerSub: {
    color: '#52525b',
    fontSize: 11,
    marginTop: 2,
  },
  settingsBtn: {
    backgroundColor: '#27272a',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
  },
  settingsBtnText: {
    color: '#d4d4d8',
    fontSize: 13,
    fontWeight: '500',
  },

  // Status bar
  statusBar: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#18181b',
  },
  statusText: {
    color: '#34d399',
    fontSize: 12,
  },
  statusError: {
    color: '#f87171',
  },

  // Controls
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    marginBottom: 10,
    gap: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  toggleTrack: {
    width: 36,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3f3f46',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleTrackOn: {
    backgroundColor: '#10b981',
  },
  toggleThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  toggleThumbOn: {
    alignSelf: 'flex-end',
  },
  toggleLabel: {
    color: '#d4d4d8',
    fontSize: 13,
  },
  sortRow: {
    flexDirection: 'row',
    gap: 4,
  },
  sortBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#27272a',
  },
  sortBtnActive: {
    backgroundColor: '#3f3f46',
  },
  sortBtnText: {
    color: '#71717a',
    fontSize: 12,
    fontWeight: '500',
  },
  sortBtnTextActive: {
    color: '#fff',
  },

  // Empty
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    color: '#a1a1aa',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySub: {
    color: '#71717a',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
})
