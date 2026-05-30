import type { ID, Currency, AuditFields } from './common'

export type CampaignStatus =
  | 'draft'
  | 'planning'
  | 'active'
  | 'paused'
  | 'completed'
  | 'cancelled'

export type CampaignType =
  | 'awareness'
  | 'conversion'
  | 'engagement'
  | 'product_launch'
  | 'ugc'
  | 'brand_ambassador'
  | 'affiliate'
  | 'event'

export type CampaignInfluencerStatus =
  | 'invited'
  | 'confirmed'
  | 'active'
  | 'completed'
  | 'declined'
  | 'removed'

export interface CampaignKPIs {
  targetReach?: number
  targetImpressions?: number
  targetEngagements?: number
  targetClicks?: number
  targetConversions?: number
}

export interface CampaignInfluencer {
  influencerId: ID
  influencerName: string
  agreedRate: number
  currency: Currency
  status: CampaignInfluencerStatus
  deliverableCount: number
  completedDeliverables: number
  confirmedAt?: string
  managerId?: ID
}

export interface Campaign extends AuditFields {
  id: ID
  name: string
  description?: string
  clientId: ID
  clientName: string
  type: CampaignType
  status: CampaignStatus
  startDate: string
  endDate: string
  budget: number
  currency: Currency
  spent: number
  briefUrl?: string
  hashtags: string[]
  mentions: string[]
  goals?: string
  kpis: CampaignKPIs
  influencers: CampaignInfluencer[]
  deliverableCount: number
  completedDeliverableCount: number
  pendingApprovalCount: number
  managerId?: ID
  tags: string[]
}
