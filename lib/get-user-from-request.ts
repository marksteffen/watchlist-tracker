import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from './supabase-server'
import type { User } from '@supabase/supabase-js'

export async function getUserFromRequest(req: Request): Promise<{ user: User | null; error: string | null }> {
  // Check for Bearer token first
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    )
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) {
      return { user: null, error: 'Invalid or expired token' }
    }
    return { user: data.user, error: null }
  }

  // Fall through to cookie-based auth
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return { user: null, error: 'Not authenticated' }
  }
  return { user, error: null }
}
