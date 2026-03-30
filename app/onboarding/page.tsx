import { redirect } from 'next/navigation'
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase-server'
import { getAllStreamingProviders, logoUrl } from '@/lib/tmdb'
import { OnboardingClient } from '@/components/OnboardingClient'

export default async function OnboardingPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth')

  const db = createServiceRoleClient()
  const { data: profile } = await db
    .from('users')
    .select('letterboxd_username, streaming_subscriptions')
    .eq('id', user.id)
    .single()

  // Already set up — skip onboarding
  if (profile?.letterboxd_username && (profile?.streaming_subscriptions ?? []).length > 0) {
    redirect('/dashboard')
  }

  const allProviders = await getAllStreamingProviders('US')
  const providers = allProviders
    .sort((a, b) => a.display_priority - b.display_priority)
    .slice(0, 50)
    .map(p => ({
      provider_id: p.provider_id,
      provider_name: p.provider_name,
      logo_url: logoUrl(p.logo_path, 'w45'),
    }))

  return (
    <OnboardingClient
      userId={user.id}
      initialUsername={profile?.letterboxd_username ?? ''}
      initialSubscriptions={(profile?.streaming_subscriptions ?? []).map(Number)}
      providers={providers}
    />
  )
}
