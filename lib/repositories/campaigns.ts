import { createClient } from '@/lib/supabase/server'
import type { Tables, TablesInsert, TablesUpdate, CampaignStatusDb } from '@/types/database'
import type { RepoResult, RepoList, ListParams } from '@/lib/database'
import { pgError, pageRange } from '@/lib/database'
import type {
  CreateCampaignInput,
  UpdateCampaignInput,
  AddCampaignInfluencerInput,
  UpdateCampaignInfluencerInput,
} from '@/lib/validators/campaign'

export type Campaign           = Tables<'campaigns'>
export type CampaignInfluencer = Tables<'campaign_influencers'>

export type CampaignWithInfluencers = Campaign & {
  influencers: CampaignInfluencer[]
}

export async function listCampaigns(
  params: ListParams & {
    status?:    CampaignStatusDb
    clientId?:  string
    managerId?: string
    search?:    string
    team?:      string
  } = {}
): Promise<RepoList<Campaign>> {
  const supabase = await createClient()
  const { page = 1, pageSize = 25, status, clientId, managerId, search, team, orderBy = 'created_at', orderDir = 'desc' } = params
  const [from, to] = pageRange(page, pageSize)

  let query = supabase
    .from('campaigns')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .order(orderBy, { ascending: orderDir === 'asc' })
    .range(from, to)

  if (status)    query = query.eq('status', status)
  if (clientId)  query = query.eq('client_id', clientId)
  if (managerId) query = query.eq('manager_id', managerId)
  if (team)      query = query.eq('team', team)
  if (search)    query = query.ilike('name', `%${search}%`)

  const { data, error, count } = await query

  if (error) return { data: null, error: pgError(error) }
  return { data: { rows: data ?? [], total: count ?? 0 }, error: null }
}

export async function getCampaignById(id: string): Promise<RepoResult<CampaignWithInfluencers>> {
  const supabase = await createClient()

  const [campaignRes, influencersRes] = await Promise.all([
    supabase.from('campaigns').select('*').eq('id', id).is('deleted_at', null).single(),
    supabase.from('campaign_influencers').select('*').eq('campaign_id', id),
  ])

  if (campaignRes.error) return { data: null, error: pgError(campaignRes.error) }
  return {
    data: { ...campaignRes.data, influencers: influencersRes.data ?? [] },
    error: null,
  }
}

export async function createCampaignRecord(
  payload: CreateCampaignInput,
  actorId: string
): Promise<RepoResult<Campaign>> {
  const supabase = await createClient()

  const insertData: TablesInsert<'campaigns'> = {
    name:               payload.name,
    description:        payload.description ?? null,
    client_id:          payload.client_id,
    campaign_type:      payload.campaign_type ?? 'fixed',
    status:             payload.status ?? 'draft',
    lifecycle_stage:    payload.lifecycle_stage ?? 1,
    start_date:         payload.start_date,
    end_date:           payload.end_date,
    budget_amount:      payload.budget_amount ?? 0,
    budget_currency:    payload.budget_currency ?? 'USD',
    target_reach:       payload.target_reach ?? null,
    target_impressions: payload.target_impressions ?? null,
    target_engagements: payload.target_engagements ?? null,
    target_clicks:      payload.target_clicks ?? null,
    target_conversions: payload.target_conversions ?? null,
    brief_url:          payload.brief_url ?? null,
    hashtags:           payload.hashtags ?? [],
    mentions:           payload.mentions ?? [],
    goals:              payload.goals ?? null,
    manager_id:         payload.manager_id ?? null,
    team:               payload.team ?? null,
    tags:               payload.tags ?? [],
    created_by:         actorId,
    updated_by:         actorId,
  }

  const { data, error } = await supabase
    .from('campaigns')
    .insert(insertData)
    .select('*')
    .single()

  if (error) return { data: null, error: pgError(error) }
  return { data, error: null }
}

export async function updateCampaignRecord(
  id: string,
  payload: UpdateCampaignInput,
  actorId: string
): Promise<RepoResult<Campaign>> {
  const supabase = await createClient()

  const updateData: TablesUpdate<'campaigns'> = { ...payload, updated_by: actorId }

  const { data, error } = await supabase
    .from('campaigns')
    .update(updateData)
    .eq('id', id)
    .is('deleted_at', null)
    .select('*')
    .single()

  if (error) return { data: null, error: pgError(error) }
  return { data, error: null }
}

export async function softDeleteCampaign(id: string, actorId: string): Promise<RepoResult<null>> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('campaigns')
    .update({ deleted_at: new Date().toISOString(), updated_by: actorId })
    .eq('id', id)
    .is('deleted_at', null)

  if (error) return { data: null, error: pgError(error) }
  return { data: null, error: null }
}

export async function updateCampaignLifecycle(
  id: string,
  stage: number,
  actorId: string
): Promise<RepoResult<Campaign>> {
  return updateCampaignRecord(id, { lifecycle_stage: stage }, actorId)
}

// ─── Campaign Influencers ─────────────────────────────────────────────────────

export async function addInfluencerToCampaign(
  campaignId: string,
  payload: AddCampaignInfluencerInput,
  actorId: string
): Promise<RepoResult<CampaignInfluencer>> {
  const supabase = await createClient()

  const insertData: TablesInsert<'campaign_influencers'> = {
    campaign_id:  campaignId,
    vendor_id:    payload.vendor_id,
    agreed_rate:  payload.agreed_rate ?? 0,
    currency:     payload.currency ?? 'USD',
    manager_id:   payload.manager_id ?? null,
    status:       'invited',
  }

  const { data, error } = await supabase
    .from('campaign_influencers')
    .insert(insertData)
    .select('*')
    .single()

  if (error) return { data: null, error: pgError(error) }

  await supabase
    .from('campaigns')
    .update({ updated_by: actorId })
    .eq('id', campaignId)

  return { data, error: null }
}

export async function updateCampaignInfluencer(
  id: string,
  payload: UpdateCampaignInfluencerInput
): Promise<RepoResult<CampaignInfluencer>> {
  const supabase = await createClient()

  const updateData: TablesUpdate<'campaign_influencers'> = {
    ...payload,
    confirmed_at: payload.status === 'confirmed' ? new Date().toISOString() : undefined,
  }

  const { data, error } = await supabase
    .from('campaign_influencers')
    .update(updateData)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return { data: null, error: pgError(error) }
  return { data, error: null }
}

export async function removeInfluencerFromCampaign(
  campaignId: string,
  vendorId: string
): Promise<RepoResult<null>> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('campaign_influencers')
    .update({ status: 'removed' })
    .eq('campaign_id', campaignId)
    .eq('vendor_id', vendorId)

  if (error) return { data: null, error: pgError(error) }
  return { data: null, error: null }
}
