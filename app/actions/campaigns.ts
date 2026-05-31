'use server'

import { revalidatePath } from 'next/cache'
import { getCurrentProfile } from '@/lib/auth/session'
import {
  createCampaignRecord,
  updateCampaignRecord,
  softDeleteCampaign,
  updateCampaignLifecycle,
  addInfluencerToCampaign,
  updateCampaignInfluencer,
  removeInfluencerFromCampaign,
} from '@/lib/repositories/campaigns'
import { createClient } from '@/lib/supabase/server'
import {
  createCampaignSchema,
  updateCampaignSchema,
  addCampaignInfluencerSchema,
} from '@/lib/validators/campaign'
import type { CiStatusDb, DeliverableTypeDb, PlatformTypeDb, DeliverableStatusDb } from '@/types/database'
import { z } from 'zod'

export interface CampaignActionResult {
  error?: string
  fieldErrors?: Record<string, string[]>
  success?: boolean
  id?: string
}

const OPTIONAL_STRINGS = ['description', 'brief_url', 'goals', 'manager_id', 'team'] as const
const NUMBER_FIELDS    = ['budget_amount', 'lifecycle_stage'] as const
const NULLABLE_NUMBERS = ['target_reach', 'target_impressions', 'target_engagements', 'target_clicks', 'target_conversions'] as const

function coerceFormData(raw: Record<string, string>): Record<string, unknown> {
  const data: Record<string, unknown> = { ...raw }
  for (const f of OPTIONAL_STRINGS) {
    if (data[f] === '') data[f] = null
  }
  for (const f of NUMBER_FIELDS) {
    if (raw[f] !== undefined && raw[f] !== '') data[f] = Number(raw[f])
  }
  for (const f of NULLABLE_NUMBERS) {
    if (raw[f] !== '' && raw[f] !== undefined) data[f] = Number(raw[f])
    else data[f] = null
  }
  return data
}

// ─── Campaign CRUD ────────────────────────────────────────────────────────────

export async function createCampaign(
  _prev: CampaignActionResult,
  formData: FormData
): Promise<CampaignActionResult> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Unauthorized' }

  const raw = Object.fromEntries(formData.entries()) as Record<string, string>
  const parsed = createCampaignSchema.safeParse(coerceFormData(raw))
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const result = await createCampaignRecord(parsed.data, profile.id)
  if (result.error) return { error: result.error }

  revalidatePath('/campaigns')
  return { success: true, id: result.data!.id }
}

export async function updateCampaign(
  id: string,
  _prev: CampaignActionResult,
  formData: FormData
): Promise<CampaignActionResult> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Unauthorized' }

  const raw = Object.fromEntries(formData.entries()) as Record<string, string>
  const parsed = updateCampaignSchema.safeParse(coerceFormData(raw))
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const result = await updateCampaignRecord(id, parsed.data, profile.id)
  if (result.error) return { error: result.error }

  revalidatePath('/campaigns')
  revalidatePath(`/campaigns/${id}`)
  return { success: true }
}

export async function deleteCampaign(id: string): Promise<CampaignActionResult> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Unauthorized' }

  const result = await softDeleteCampaign(id, profile.id)
  if (result.error) return { error: result.error }

  revalidatePath('/campaigns')
  return { success: true }
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

export async function advanceLifecycle(
  id: string,
  stage: number
): Promise<CampaignActionResult> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Unauthorized' }

  const result = await updateCampaignLifecycle(id, stage, profile.id)
  if (result.error) return { error: result.error }

  revalidatePath(`/campaigns/${id}`)
  return { success: true }
}

// ─── Campaign Influencers ─────────────────────────────────────────────────────

export async function addInfluencer(
  campaignId: string,
  _prev: CampaignActionResult,
  formData: FormData
): Promise<CampaignActionResult> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Unauthorized' }

  const raw = Object.fromEntries(formData.entries()) as Record<string, string>
  const parsed = addCampaignInfluencerSchema.safeParse({
    vendor_id:   raw.vendor_id,
    agreed_rate: raw.agreed_rate ? Number(raw.agreed_rate) : 0,
    currency:    raw.currency || 'USD',
    manager_id:  raw.manager_id || null,
  })
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const result = await addInfluencerToCampaign(campaignId, parsed.data, profile.id)
  if (result.error) return { error: result.error }

  revalidatePath(`/campaigns/${campaignId}`)
  return { success: true }
}

export async function removeInfluencer(
  campaignId: string,
  vendorId: string
): Promise<CampaignActionResult> {
  const result = await removeInfluencerFromCampaign(campaignId, vendorId)
  if (result.error) return { error: result.error }

  revalidatePath(`/campaigns/${campaignId}`)
  return { success: true }
}

const ciStatusSchema = z.enum(['invited', 'confirmed', 'active', 'completed', 'declined', 'removed'])

export async function updateInfluencerStatus(
  ciId: string,
  campaignId: string,
  status: string
): Promise<CampaignActionResult> {
  const parsed = ciStatusSchema.safeParse(status)
  if (!parsed.success) return { error: 'Invalid status' }

  const result = await updateCampaignInfluencer(ciId, { status: parsed.data as CiStatusDb })
  if (result.error) return { error: result.error }

  revalidatePath(`/campaigns/${campaignId}`)
  return { success: true }
}

// ─── Deliverables ─────────────────────────────────────────────────────────────

const deliverableSchema = z.object({
  type:                   z.string().min(1),
  platform:               z.string().min(1),
  due_date:               z.string().min(1, 'Due date is required'),
  campaign_influencer_id: z.string().uuid().nullable().optional(),
  description:            z.string().nullable().optional(),
  requirements:           z.string().nullable().optional(),
})

export async function createDeliverable(
  campaignId: string,
  _prev: CampaignActionResult,
  formData: FormData
): Promise<CampaignActionResult> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Unauthorized' }

  const raw = Object.fromEntries(formData.entries()) as Record<string, string>
  const parsed = deliverableSchema.safeParse({
    ...raw,
    campaign_influencer_id: raw.campaign_influencer_id || null,
    description:            raw.description || null,
    requirements:           raw.requirements || null,
  })
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('deliverables').insert({
    campaign_id:           campaignId,
    campaign_influencer_id: parsed.data.campaign_influencer_id ?? null,
    type:                  parsed.data.type as DeliverableTypeDb,
    platform:              parsed.data.platform as PlatformTypeDb,
    status:                'not_started' as DeliverableStatusDb,
    due_date:              parsed.data.due_date,
    description:           parsed.data.description ?? null,
    requirements:          parsed.data.requirements ?? null,
    created_by:            profile.id,
    updated_by:            profile.id,
  } as never)

  if (error) return { error: error.message }

  revalidatePath(`/campaigns/${campaignId}`)
  return { success: true }
}

export async function updateDeliverableStatus(
  deliverableId: string,
  campaignId: string,
  status: string
): Promise<CampaignActionResult> {
  const profile = await getCurrentProfile()
  if (!profile) return { error: 'Unauthorized' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('deliverables')
    .update({ status: status as DeliverableStatusDb, updated_by: profile.id })
    .eq('id', deliverableId)
    .is('deleted_at', null)

  if (error) return { error: error.message }

  revalidatePath(`/campaigns/${campaignId}`)
  return { success: true }
}
