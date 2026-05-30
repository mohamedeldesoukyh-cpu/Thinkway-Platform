import { z } from 'zod'

const CAMPAIGN_TYPES    = ['fixed', 'hard_roi', 'performance'] as const
const CAMPAIGN_STATUSES = ['draft', 'planning', 'active', 'paused', 'completed', 'cancelled'] as const
const CURRENCIES        = ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'QAR', 'KWD'] as const
const CI_STATUSES       = ['invited', 'confirmed', 'active', 'completed', 'declined', 'removed'] as const

export const createCampaignSchema = z.object({
  name:                z.string().min(1, 'Campaign name is required').max(200),
  description:         z.string().max(5000).nullable().optional(),
  client_id:           z.string().uuid('Invalid client'),
  campaign_type:       z.enum(CAMPAIGN_TYPES).default('fixed'),
  status:              z.enum(CAMPAIGN_STATUSES).default('draft'),
  lifecycle_stage:     z.number().int().min(1).max(15).default(1),
  start_date:          z.string().min(1, 'Start date is required'),
  end_date:            z.string().min(1, 'End date is required'),
  budget_amount:       z.number().min(0).default(0),
  budget_currency:     z.enum(CURRENCIES).default('USD'),
  target_reach:        z.number().int().min(0).nullable().optional(),
  target_impressions:  z.number().int().min(0).nullable().optional(),
  target_engagements:  z.number().int().min(0).nullable().optional(),
  target_clicks:       z.number().int().min(0).nullable().optional(),
  target_conversions:  z.number().int().min(0).nullable().optional(),
  brief_url:           z.string().url('Invalid URL').nullable().optional(),
  hashtags:            z.array(z.string()).default([]),
  mentions:            z.array(z.string()).default([]),
  goals:               z.string().max(2000).nullable().optional(),
  manager_id:          z.string().uuid().nullable().optional(),
  team:                z.string().nullable().optional(),
  tags:                z.array(z.string()).default([]),
}).refine(
  (d) => !d.end_date || !d.start_date || d.end_date >= d.start_date,
  { message: 'End date must be on or after start date', path: ['end_date'] }
)

export const updateCampaignSchema = createCampaignSchema.partial().omit({ client_id: true })

export const addCampaignInfluencerSchema = z.object({
  vendor_id:   z.string().uuid('Invalid vendor'),
  agreed_rate: z.number().min(0).default(0),
  currency:    z.enum(CURRENCIES).default('USD'),
  manager_id:  z.string().uuid().nullable().optional(),
})

export const updateCampaignInfluencerSchema = z.object({
  status:      z.enum(CI_STATUSES).optional(),
  agreed_rate: z.number().min(0).optional(),
  currency:    z.enum(CURRENCIES).optional(),
  manager_id:  z.string().uuid().nullable().optional(),
})

export type CreateCampaignInput           = z.infer<typeof createCampaignSchema>
export type UpdateCampaignInput           = z.infer<typeof updateCampaignSchema>
export type AddCampaignInfluencerInput    = z.infer<typeof addCampaignInfluencerSchema>
export type UpdateCampaignInfluencerInput = z.infer<typeof updateCampaignInfluencerSchema>
