/**
 * Database layer — re-exports and shared helpers for typed Supabase access.
 * Repositories import from here; application code imports from repositories.
 */
export { createClient as createServerClient } from '@/lib/supabase/server'
export { createClient as createBrowserClient } from '@/lib/supabase/client'

export type { Database, Tables, TablesInsert, TablesUpdate, Json } from '@/types/database'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

/** Typed Supabase client used throughout the repository layer. */
export type DbClient = SupabaseClient<Database>

/** Discriminated result type for all repository functions. */
export type RepoResult<T> =
  | { data: T; error: null }
  | { data: null; error: string }

/** Paginated list result. */
export type RepoList<T> = RepoResult<{ rows: T[]; total: number }>

export interface ListParams {
  page?: number
  pageSize?: number
  orderBy?: string
  orderDir?: 'asc' | 'desc'
}

/** Maps a Postgrest error to a human-readable string. */
export function pgError(err: { message: string; code?: string }): string {
  if (err.code === '23505') return 'A record with this value already exists.'
  if (err.code === '23503') return 'Referenced record does not exist.'
  if (err.code === '42501') return 'Insufficient permissions.'
  return err.message
}

/** Calculates pagination range for Supabase .range(from, to) */
export function pageRange(page = 1, pageSize = 25): [number, number] {
  const from = (page - 1) * pageSize
  return [from, from + pageSize - 1]
}
