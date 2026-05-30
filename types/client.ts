import type { ID, Currency, Address, AuditFields } from './common'

export type ClientStatus =
  | 'active'
  | 'inactive'
  | 'prospect'
  | 'churned'
  | 'on_hold'

export type ClientTier =
  | 'standard'
  | 'premium'
  | 'enterprise'
  | 'strategic'

export type ClientIndustry =
  | 'fashion'
  | 'beauty'
  | 'lifestyle'
  | 'food_beverage'
  | 'fitness_wellness'
  | 'technology'
  | 'travel'
  | 'automotive'
  | 'finance'
  | 'entertainment'
  | 'healthcare'
  | 'education'
  | 'real_estate'
  | 'gaming'
  | 'sports'
  | 'other'

export interface ClientContact {
  id: ID
  name: string
  email: string
  phone?: string
  role?: string
  isPrimary: boolean
  linkedinUrl?: string
}

export interface Client extends AuditFields {
  id: ID
  name: string
  tradingName?: string
  logo?: string
  industry: ClientIndustry
  website?: string
  description?: string
  tier: ClientTier
  status: ClientStatus
  contacts: ClientContact[]
  address?: Address
  taxId?: string
  currency: Currency
  paymentTermsDays: number
  totalLifetimeValue: number
  activeCampaignCount: number
  totalCampaignCount: number
  accountManagerId?: ID
  notes?: string
  tags: string[]
  onboardedAt?: string
}
