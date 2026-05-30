import { z } from 'zod'

const CLIENT_TIERS    = ['standard', 'premium', 'enterprise', 'strategic'] as const
const CLIENT_STATUSES = ['active', 'inactive', 'prospect', 'churned', 'on_hold'] as const
const CURRENCIES      = ['USD', 'EUR', 'GBP', 'AED', 'SAR', 'QAR', 'KWD'] as const

const addressSchema = z.object({
  line1:       z.string().min(1),
  line2:       z.string().optional(),
  city:        z.string().min(1),
  state:       z.string().optional(),
  postalCode:  z.string().optional(),
  country:     z.string().min(1),
})

const contactSchema = z.object({
  name:         z.string().min(1, 'Contact name is required'),
  email:        z.string().email('Invalid email'),
  phone:        z.string().nullable().optional(),
  role:         z.string().nullable().optional(),
  is_primary:   z.boolean().default(false),
  linkedin_url: z.string().url('Invalid URL').nullable().optional(),
})

export const createClientSchema = z.object({
  name:               z.string().min(1, 'Client name is required').max(200),
  trading_name:       z.string().max(200).nullable().optional(),
  industry:           z.string().min(1, 'Industry is required'),
  tier:               z.enum(CLIENT_TIERS).default('standard'),
  status:             z.enum(CLIENT_STATUSES).default('prospect'),
  parent_group:       z.string().nullable().optional(),
  website:            z.string().url('Invalid website URL').nullable().optional(),
  description:        z.string().max(2000).nullable().optional(),
  tax_id:             z.string().max(50).nullable().optional(),
  currency:           z.enum(CURRENCIES).default('USD'),
  payment_terms_days: z.number().int().min(0).max(365).default(30),
  account_manager_id: z.string().uuid().nullable().optional(),
  notes:              z.string().max(5000).nullable().optional(),
  tags:               z.array(z.string()).default([]),
  address:            addressSchema.nullable().optional(),
  onboarded_at:       z.string().datetime({ offset: true }).nullable().optional(),
  contacts:           z.array(contactSchema).default([]),
})

export const updateClientSchema = createClientSchema.partial()

export type CreateClientInput = z.infer<typeof createClientSchema>
export type UpdateClientInput = z.infer<typeof updateClientSchema>
export type ClientContactInput = z.infer<typeof contactSchema>
