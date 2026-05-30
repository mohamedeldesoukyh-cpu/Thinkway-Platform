import type { ID, Currency, Platform, AuditFields } from './common'

export type InfluencerTier =
  | 'nano'    // 1K – 10K followers
  | 'micro'   // 10K – 100K
  | 'mid'     // 100K – 500K
  | 'macro'   // 500K – 1M
  | 'mega'    // 1M+

export type InfluencerStatus =
  | 'active'
  | 'inactive'
  | 'pending_onboarding'
  | 'blacklisted'
  | 'under_review'

export interface SocialProfile {
  platform: Platform
  handle: string
  profileUrl?: string
  followers: number
  following?: number
  avgLikes?: number
  avgComments?: number
  engagementRate: number
  isVerified: boolean
}

export interface InfluencerPaymentDetails {
  method: 'bank_transfer' | 'paypal' | 'stripe' | 'wise' | 'other'
  accountName?: string
  accountNumber?: string
  bankName?: string
  swiftCode?: string
  iban?: string
  email?: string
  currency?: Currency
}

export interface Influencer extends AuditFields {
  id: ID
  firstName: string
  lastName: string
  displayName?: string
  email: string
  phone?: string
  avatar?: string
  bio?: string
  location: string
  country: string
  nationality?: string
  primaryLanguage: string
  languages: string[]
  niche: string[]
  contentCategories: string[]
  tier: InfluencerTier
  status: InfluencerStatus
  socialProfiles: SocialProfile[]
  totalFollowers: number
  primaryPlatform: Platform
  averageEngagementRate: number
  defaultRate: number
  currency: Currency
  taxId?: string
  paymentDetails?: InfluencerPaymentDetails
  notes?: string
  tags: string[]
  agentName?: string
  agentEmail?: string
  contractSignedAt?: string
  onboardedAt?: string
  lastCampaignAt?: string
  totalCampaigns: number
  activeManagerId?: ID
}
