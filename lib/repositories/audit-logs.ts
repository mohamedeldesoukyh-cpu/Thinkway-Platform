import { createClient } from '@/lib/supabase/server'
import type { Tables, TablesInsert } from '@/types/database'
import type { RepoResult, RepoList, ListParams } from '@/lib/database'
import { pgError, pageRange } from '@/lib/database'

export type AuditLog = Tables<'audit_logs'>

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'export'
  | 'approve'
  | 'reject'
  | 'send'
  | 'void'

export type AuditResourceType =
  | 'campaign'
  | 'client'
  | 'vendor'
  | 'invoice'
  | 'payment'
  | 'profile'
  | 'approval'
  | 'deliverable'

export interface LogActionParams {
  actorId:      string
  actorEmail:   string
  actorRole:    string
  action:       AuditAction
  resourceType: AuditResourceType
  resourceId?:  string
  resourceName?: string
  changes?:     Record<string, unknown>
  ipAddress?:   string
  userAgent?:   string
}

export async function logAction(params: LogActionParams): Promise<void> {
  const supabase = await createClient()

  const insertData: TablesInsert<'audit_logs'> = {
    actor_id:      params.actorId,
    actor_email:   params.actorEmail,
    actor_role:    params.actorRole,
    action:        params.action,
    resource_type: params.resourceType,
    resource_id:   params.resourceId ?? null,
    resource_name: params.resourceName ?? null,
    changes:       params.changes ? (params.changes as import('@/types/database').Json) : null,
    ip_address:    params.ipAddress ?? null,
    user_agent:    params.userAgent ?? null,
  }

  await supabase.from('audit_logs').insert(insertData)
}

export async function listAuditLogs(
  params: ListParams & {
    actorId?:      string
    resourceType?: string
    resourceId?:   string
    action?:       string
  } = {}
): Promise<RepoList<AuditLog>> {
  const supabase = await createClient()
  const { page = 1, pageSize = 50, actorId, resourceType, resourceId, action } = params
  const [from, to] = pageRange(page, pageSize)

  let query = supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (actorId)      query = query.eq('actor_id', actorId)
  if (resourceType) query = query.eq('resource_type', resourceType)
  if (resourceId)   query = query.eq('resource_id', resourceId)
  if (action)       query = query.eq('action', action)

  const { data, error, count } = await query

  if (error) return { data: null, error: pgError(error) }
  return { data: { rows: data ?? [], total: count ?? 0 }, error: null }
}
