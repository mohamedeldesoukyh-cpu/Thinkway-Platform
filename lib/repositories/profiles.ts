import { createClient } from '@/lib/supabase/server'
import type { Tables, TablesUpdate, UserRoleDb, UserStatusDb } from '@/types/database'
import type { RepoResult, RepoList, ListParams } from '@/lib/database'
import { pgError, pageRange } from '@/lib/database'

export type Profile = Tables<'profiles'>

export async function getProfileById(id: string): Promise<RepoResult<Profile>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return { data: null, error: pgError(error) }
  return { data, error: null }
}

export async function getProfileByEmail(email: string): Promise<RepoResult<Profile>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('email', email)
    .single()

  if (error) return { data: null, error: pgError(error) }
  return { data, error: null }
}

export async function listProfiles(params: ListParams & { role?: UserRoleDb; status?: UserStatusDb } = {}): Promise<RepoList<Profile>> {
  const supabase = await createClient()
  const { page = 1, pageSize = 25, role, status } = params
  const [from, to] = pageRange(page, pageSize)

  let query = supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .order('full_name', { ascending: true })
    .range(from, to)

  if (role)   query = query.eq('role', role)
  if (status) query = query.eq('status', status)

  const { data, error, count } = await query

  if (error) return { data: null, error: pgError(error) }
  return { data: { rows: data ?? [], total: count ?? 0 }, error: null }
}

export async function updateProfile(
  id: string,
  payload: TablesUpdate<'profiles'>
): Promise<RepoResult<Profile>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()

  if (error) return { data: null, error: pgError(error) }
  return { data, error: null }
}

export async function updateProfileRole(
  id: string,
  role: Profile['role']
): Promise<RepoResult<Profile>> {
  return updateProfile(id, { role })
}

export async function updateProfileStatus(
  id: string,
  status: Profile['status']
): Promise<RepoResult<Profile>> {
  return updateProfile(id, { status })
}
