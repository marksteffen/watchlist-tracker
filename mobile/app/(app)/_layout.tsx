import { Redirect, Stack } from 'expo-router'
import { useSession } from '@/lib/session'
import { View, ActivityIndicator } from 'react-native'

export default function AppLayout() {
  const { session, isLoading } = useSession()

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

  return <Stack screenOptions={{ headerShown: false }} />
}
