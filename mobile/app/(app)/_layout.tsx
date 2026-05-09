import { Redirect, Stack } from 'expo-router'
import { useSession } from '@/lib/session'
import { View, ActivityIndicator, AppState, Text } from 'react-native'
import { useEffect, useRef, useState } from 'react'
import { syncAll } from '@/lib/sync'
import { supabase } from '@/lib/supabase'

const SYNC_DEBOUNCE_MS = 60 * 60 * 1000  // 1 hour

export default function AppLayout() {
  const { session, isLoading } = useSession()
  const lastSyncRef = useRef<number>(0)
  const isSyncingRef = useRef(false)
  const [syncStatus, setSyncStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!session) return

    async function runSync() {
      if (isSyncingRef.current) return
      if (Date.now() - lastSyncRef.current < SYNC_DEBOUNCE_MS && lastSyncRef.current !== 0) return

      // Check if onboarding is complete before syncing
      const { data: profile } = await supabase
        .from('users')
        .select('letterboxd_username')
        .eq('id', session!.user.id)
        .single()

      if (!profile?.letterboxd_username) return  // not onboarded yet

      isSyncingRef.current = true
      const result = await syncAll(session!.access_token)
      isSyncingRef.current = false
      lastSyncRef.current = Date.now()

      if (!result.ok) {
        setSyncStatus(result.error ?? 'Sync failed')
        setTimeout(() => setSyncStatus(null), 4000)
      }
    }

    // Sync on mount
    runSync()

    // Re-sync when app comes to foreground
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') runSync()
    })

    return () => subscription.remove()
  }, [session])

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#09090b' }}>
        <ActivityIndicator color="#10b981" />
      </View>
    )
  }

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#09090b' }}>
      {syncStatus && (
        <View style={{ backgroundColor: '#ef4444', paddingHorizontal: 16, paddingVertical: 6 }}>
          <Text style={{ color: '#fff', fontSize: 12, textAlign: 'center' }}>{syncStatus}</Text>
        </View>
      )}
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  )
}
