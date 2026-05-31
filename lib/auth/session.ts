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

type ProfileRow = {
  id: string
  email: string
  full_name: string
  avatar_url: string | null
  role: string
  team: string | null
  reports_to_id: string | null
}

function toSessionProfile(row: ProfileRow): SessionProfile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name ?? row.email.split('@')[0],
    avatarUrl: row.avatar_url,
    role: (row.role ?? 'data_entry') as UserRole,
    team: row.team,
    reportsToId: row.reports_to_id,
  }
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

  // Try to fetch existing profile
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, avatar_url, role, team, reports_to_id')
    .eq('id', user.id)
    .single()

  if (data && !error) {
    return toSessionProfile(data as ProfileRow)
  }

  // PGRST116 = no rows — profile row doesn't exist yet (trigger may not have fired).
  // Auto-create with minimal permissions so the user can reach the platform.
  // An admin can later promote the role via Supabase or the admin UI.
  if (error?.code === 'PGRST116') {
    const fullName =
      (user.user_metadata?.full_name as string | undefined) ??
      user.email?.split('@')[0] ??
      'User'

    const { data: created, error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email ?? '',
        full_name: fullName,
        role: 'data_entry',
      } as never)
      .select('id, email, full_name, avatar_url, role, team, reports_to_id')
      .single()

    if (created && !insertError) {
      return toSessionProfile(created as ProfileRow)
    }
  }

  return null
}
