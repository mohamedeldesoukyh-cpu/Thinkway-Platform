import { createClient } from '@/lib/supabase/server'
import type { Tables, TablesInsert, TablesUpdate, VendorStatusDb, InfluencerTierDb, PlatformTypeDb } from '@/types/database'
import type { RepoResult, RepoList, ListParams } from '@/lib/database'
import { pgError, pageRange } from '@/lib/database'
import type { CreateVendorInput, UpdateVendorInput, SocialProfileInput } from '@/lib/validators/vendor'

export type Vendor             = Tables<'vendors'>
export type VendorSocialProfile = Tables<'vendor_social_profiles'>

export type VendorWithSocials = Vendor & { social_profiles: VendorSocialProfile[] }

export async function listVendors(
  params: ListParams & {
    status?:   VendorStatusDb
    tier?:     InfluencerTierDb
    platform?: PlatformTypeDb
    search?:   string
  } = {}
): Promise<RepoList<Vendor>> {
  const supabase = await createClient()
  const { page = 1, pageSize = 25, status, tier, platform, search, orderBy = 'created_at', orderDir = 'desc' } = params
  const [from, to] = pageRange(page, pageSize)

  let query = supabase
    .from('vendors')
    .select('*', { count: 'exact' })
    .is('deleted_at', null)
    .order(orderBy, { ascending: orderDir === 'asc' })
    .range(from, to)

  if (status)   query = query.eq('status', status)
  if (tier)     query = query.eq('tier', tier)
  if (platform) query = query.eq('primary_platform', platform)
  if (search)   query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,display_name.ilike.%${search}%`)

  const { data, error, count } = await query

  if (error) return { data: null, error: pgError(error) }
  return { data: { rows: data ?? [], total: count ?? 0 }, error: null }
}

export async function getVendorById(id: string): Promise<RepoResult<VendorWithSocials>> {
  const supabase = await createClient()

  const [vendorRes, socialsRes] = await Promise.all([
    supabase.from('vendors').select('*').eq('id', id).is('deleted_at', null).single(),
    supabase.from('vendor_social_profiles').select('*').eq('vendor_id', id),
  ])

  if (vendorRes.error) return { data: null, error: pgError(vendorRes.error) }
  return {
    data: { ...vendorRes.data, social_profiles: socialsRes.data ?? [] },
    error: null,
  }
}

export async function createVendorRecord(
  payload: CreateVendorInput,
  actorId: string
): Promise<RepoResult<VendorWithSocials>> {
  const supabase = await createClient()
  const { social_profiles = [], payment_details, ...vendorData } = payload

  const insertData: TablesInsert<'vendors'> = {
    first_name:               vendorData.first_name,
    last_name:                vendorData.last_name,
    display_name:             vendorData.display_name ?? null,
    email:                    vendorData.email,
    phone:                    vendorData.phone ?? null,
    bio:                      vendorData.bio ?? null,
    location:                 vendorData.location ?? '',
    country:                  vendorData.country ?? '',
    nationality:              vendorData.nationality ?? null,
    primary_language:         vendorData.primary_language ?? 'en',
    languages:                vendorData.languages ?? [],
    niche:                    vendorData.niche ?? [],
    content_categories:       vendorData.content_categories ?? [],
    tier:                     vendorData.tier ?? 'micro',
    status:                   vendorData.status ?? 'pending_onboarding',
    primary_platform:         vendorData.primary_platform ?? 'instagram',
    default_rate:             vendorData.default_rate ?? 0,
    default_currency:         vendorData.default_currency ?? 'USD',
    tax_id:                   vendorData.tax_id ?? null,
    payment_details:          payment_details ? (payment_details as unknown as import('@/types/database').Json) : null,
    notes:                    vendorData.notes ?? null,
    tags:                     vendorData.tags ?? [],
    agent_name:               vendorData.agent_name ?? null,
    agent_email:              vendorData.agent_email ?? null,
    contract_signed_at:       vendorData.contract_signed_at ?? null,
    onboarded_at:             vendorData.onboarded_at ?? null,
    active_manager_id:        vendorData.active_manager_id ?? null,
    created_by:               actorId,
    updated_by:               actorId,
  }

  const { data: vendor, error: vendorErr } = await supabase
    .from('vendors')
    .insert(insertData)
    .select('*')
    .single()

  if (vendorErr) return { data: null, error: pgError(vendorErr) }

  let savedSocials: VendorSocialProfile[] = []
  if (social_profiles.length > 0) {
    const { data } = await supabase
      .from('vendor_social_profiles')
      .insert(social_profiles.map((s) => ({ ...s, vendor_id: vendor.id })))
      .select('*')
    savedSocials = data ?? []
  }

  return { data: { ...vendor, social_profiles: savedSocials }, error: null }
}

export async function updateVendorRecord(
  id: string,
  payload: UpdateVendorInput,
  actorId: string
): Promise<RepoResult<Vendor>> {
  const supabase = await createClient()
  const { social_profiles: _sp, payment_details, ...fields } = payload as UpdateVendorInput & { social_profiles?: SocialProfileInput[] }

  const updateData: TablesUpdate<'vendors'> = {
    ...fields,
    payment_details: payment_details ? (payment_details as unknown as import('@/types/database').Json) : undefined,
    updated_by: actorId,
  }

  const { data, error } = await supabase
    .from('vendors')
    .update(updateData)
    .eq('id', id)
    .is('deleted_at', null)
    .select('*')
    .single()

  if (error) return { data: null, error: pgError(error) }
  return { data, error: null }
}

export async function softDeleteVendor(id: string, actorId: string): Promise<RepoResult<null>> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('vendors')
    .update({ deleted_at: new Date().toISOString(), updated_by: actorId })
    .eq('id', id)
    .is('deleted_at', null)

  if (error) return { data: null, error: pgError(error) }
  return { data: null, error: null }
}

export async function upsertVendorSocialProfiles(
  vendorId: string,
  profiles: SocialProfileInput[]
): Promise<RepoResult<VendorSocialProfile[]>> {
  const supabase = await createClient()

  await supabase.from('vendor_social_profiles').delete().eq('vendor_id', vendorId)

  if (profiles.length === 0) return { data: [], error: null }

  const { data, error } = await supabase
    .from('vendor_social_profiles')
    .insert(profiles.map((p) => ({ ...p, vendor_id: vendorId })))
    .select('*')

  if (error) return { data: null, error: pgError(error) }
  return { data: data ?? [], error: null }
}
