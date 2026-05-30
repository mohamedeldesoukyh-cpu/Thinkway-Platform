import { z } from 'zod'

const VENDOR_STATUSES    = ['active', 'inactive', 'pending_onboarding', 'blacklisted', 'under_review'] as const
const INFLUENCER_TIERS   = ['nano', 'micro', 'mid', 'macro', 'mega'] as const
const PLATFORMS          = ['instagram', 'tiktok', 'youtube', 'x', 'facebook', 'linkedin', 'snapchat', 'pinterest', 'threads'] as const
const CURRENCIES         = ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'QAR', 'KWD'] as const
const PAYMENT_METHODS    = ['bank_transfer', 'paypal', 'stripe', 'wise', 'other'] as const

const paymentDetailsSchema = z.object({
  method:         z.enum(PAYMENT_METHODS),
  account_name:   z.string().nullable().optional(),
  account_number: z.string().nullable().optional(),
  bank_name:      z.string().nullable().optional(),
  swift_code:     z.string().nullable().optional(),
  iban:           z.string().nullable().optional(),
  email:          z.string().email().nullable().optional(),
  currency:       z.enum(CURRENCIES).nullable().optional(),
})

const socialProfileSchema = z.object({
  platform:        z.enum(PLATFORMS),
  handle:          z.string().min(1, 'Handle is required'),
  profile_url:     z.string().url('Invalid URL').nullable().optional(),
  followers:       z.number().int().min(0).default(0),
  following:       z.number().int().min(0).nullable().optional(),
  avg_likes:       z.number().min(0).nullable().optional(),
  avg_comments:    z.number().min(0).nullable().optional(),
  engagement_rate: z.number().min(0).max(100).default(0),
  is_verified:     z.boolean().default(false),
})

export const createVendorSchema = z.object({
  first_name:               z.string().min(1, 'First name is required').max(100),
  last_name:                z.string().min(1, 'Last name is required').max(100),
  display_name:             z.string().max(150).nullable().optional(),
  email:                    z.string().email('Invalid email'),
  phone:                    z.string().nullable().optional(),
  bio:                      z.string().max(2000).nullable().optional(),
  location:                 z.string().max(200).default(''),
  country:                  z.string().max(100).default(''),
  nationality:              z.string().max(100).nullable().optional(),
  primary_language:         z.string().max(10).default('en'),
  languages:                z.array(z.string()).default([]),
  niche:                    z.array(z.string()).default([]),
  content_categories:       z.array(z.string()).default([]),
  tier:                     z.enum(INFLUENCER_TIERS).default('micro'),
  status:                   z.enum(VENDOR_STATUSES).default('pending_onboarding'),
  primary_platform:         z.enum(PLATFORMS).default('instagram'),
  default_rate:             z.number().min(0).default(0),
  default_currency:         z.enum(CURRENCIES).default('USD'),
  tax_id:                   z.string().max(50).nullable().optional(),
  payment_details:          paymentDetailsSchema.nullable().optional(),
  notes:                    z.string().max(5000).nullable().optional(),
  tags:                     z.array(z.string()).default([]),
  agent_name:               z.string().max(100).nullable().optional(),
  agent_email:              z.string().email().nullable().optional(),
  contract_signed_at:       z.string().datetime({ offset: true }).nullable().optional(),
  onboarded_at:             z.string().datetime({ offset: true }).nullable().optional(),
  active_manager_id:        z.string().uuid().nullable().optional(),
  social_profiles:          z.array(socialProfileSchema).default([]),
})

export const updateVendorSchema = createVendorSchema.partial()

export type CreateVendorInput      = z.infer<typeof createVendorSchema>
export type UpdateVendorInput      = z.infer<typeof updateVendorSchema>
export type SocialProfileInput     = z.infer<typeof socialProfileSchema>
export type PaymentDetailsInput    = z.infer<typeof paymentDetailsSchema>
