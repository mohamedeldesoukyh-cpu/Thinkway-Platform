import type { ID, AuditFields } from './common'
import type { DeliverableType } from './deliverable'

export type ApprovalStatus =
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'revision_requested'
  | 'expired'

export type ApprovalPriority = 'low' | 'medium' | 'high' | 'urgent'

export interface ApprovalComment {
  id: ID
  authorId: ID
  authorName: string
  authorAvatar?: string
  content: string
  isInternal: boolean
  attachments?: string[]
  createdAt: string
  updatedAt: string
  isEdited: boolean
}

export interface Approval extends AuditFields {
  id: ID
  deliverableId: ID
  deliverableType: DeliverableType
  revisionRound: number
  influencerId: ID
  influencerName: string
  campaignId: ID
  campaignName: string
  clientId: ID
  clientName: string
  status: ApprovalStatus
  priority: ApprovalPriority
  deadline?: string
  assignedReviewerId?: ID
  assignedReviewerName?: string
  submittedAt: string
  reviewedAt?: string
  reviewerId?: ID
  reviewerName?: string
  contentUrl?: string
  caption?: string
  comments: ApprovalComment[]
  internalNotes?: string
  requiresClientApproval: boolean
  clientApprovedAt?: string
  clientReviewerId?: ID
}
