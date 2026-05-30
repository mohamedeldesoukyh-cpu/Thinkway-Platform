import type { ID, Platform, AuditFields } from './common'

export type DeliverableType =
  | 'instagram_post'
  | 'instagram_story'
  | 'instagram_reel'
  | 'instagram_carousel'
  | 'tiktok_video'
  | 'youtube_video'
  | 'youtube_short'
  | 'twitter_post'
  | 'facebook_post'
  | 'facebook_reel'
  | 'linkedin_post'
  | 'blog_post'
  | 'podcast_mention'
  | 'live_stream'
  | 'other'

export type DeliverableStatus =
  | 'not_started'
  | 'in_progress'
  | 'submitted'
  | 'in_review'
  | 'revision_requested'
  | 'approved'
  | 'scheduled'
  | 'published'
  | 'live'
  | 'rejected'
  | 'cancelled'

export interface DeliverableMetrics {
  views?: number
  likes?: number
  comments?: number
  shares?: number
  saves?: number
  reach?: number
  impressions?: number
  engagementRate?: number
  clicks?: number
  conversions?: number
  watchTime?: number
  peakViewers?: number
  lastFetchedAt?: string
}

export interface DeliverableRevision {
  id: ID
  round: number
  submittedAt: string
  contentUrl?: string
  notes?: string
  reviewerId?: ID
  reviewerName?: string
  feedback?: string
  reviewedAt?: string
  status: 'pending' | 'approved' | 'rejected' | 'revision_requested'
}

export interface Deliverable extends AuditFields {
  id: ID
  campaignId: ID
  campaignName: string
  influencerId: ID
  influencerName: string
  type: DeliverableType
  platform: Platform
  status: DeliverableStatus
  dueDate: string
  submittedAt?: string
  approvedAt?: string
  scheduledAt?: string
  publishedAt?: string
  publishedUrl?: string
  contentUrl?: string
  description?: string
  caption?: string
  hashtags: string[]
  mentions: string[]
  requirements?: string
  metrics?: DeliverableMetrics
  revisions: DeliverableRevision[]
  currentRevision: number
  isUsageRightsGranted: boolean
  usageRightsExpiry?: string
  notes?: string
  assignedReviewerId?: ID
}
