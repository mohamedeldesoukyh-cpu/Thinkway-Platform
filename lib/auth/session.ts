import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types/auth'

export interface SessionProfile {
  id: string
  email: string
  fullName: string
  avatarUrl: string | null
  role: UserRole
  team: string | null
  reportsToId: string | null
}

export async function getCurrentUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null
  return user
}

export async function getCurrentProfile(): Promise<SessionProfile | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, role, team, reports_to_id')
    .eq('id', user.id)
    .single()

  if (error || !data) return null

  // Cast to access shape — type will be fully inferred once Supabase CLI generates types
  const profile = data as {
    id: string
    email: string
    full_name: string
    avatar_url: string | null
    role: string
    team: string | null
    reports_to_id: string | null
  }

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    avatarUrl: profile.avatar_url,
    role: profile.role as UserRole,
    team: profile.team,
    reportsToId: profile.reports_to_id,
  }
}
