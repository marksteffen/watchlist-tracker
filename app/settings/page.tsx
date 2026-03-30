import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase-server'
import { getAllStreamingProviders, logoUrl } from '@/lib/tmdb'
import { SettingsClient } from '@/components/SettingsClient'

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth')

  const db = createServiceRoleClient()
  const { data: profile } = await db
    .from('users')
    .select('letterboxd_username, streaming_subscriptions')
    .eq('id', user.id)
    .single()

  // Fetch all available streaming providers from TMDB
  const allProviders = await getAllStreamingProviders('US')
  const providers = allProviders
    .sort((a, b) => a.display_priority - b.display_priority)
    .map(p => ({
      provider_id: p.provider_id,
      provider_name: p.provider_name,
      logo_url: logoUrl(p.logo_path, 'w45'),
    }))

  return (
    <SettingsClient
      userId={user.id}
      initialUsername={profile?.letterboxd_username ?? ''}
      initialSubscriptions={(profile?.streaming_subscriptions || []).map(Number)}
      providers={providers}
    />
  )
}
