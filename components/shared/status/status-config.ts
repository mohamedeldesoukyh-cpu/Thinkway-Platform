/**
 * Central semantic tone mappings for all domain status badges.
 * Uses semantic design tokens only: success, warning, destructive, foreground, muted-foreground.
 */

export type SemanticStatusTone =
  | "neutral"
  | "success"
  | "warning"
  | "destructive"
  | "foreground";

/** @deprecated Use SemanticStatusTone. Kept for lib/ui/status-tone compatibility. */
export type LegacyStatusTone =
  | SemanticStatusTone
  | "info"
  | "accent"
  | "danger";

export const CLIENT_STATUS_TONE = {
  prospect: "foreground",
  active: "success",
  inactive: "neutral",
  archived: "neutral",
} as const satisfies Record<string, SemanticStatusTone>;

export const ONBOARDING_STATUS_TONE = {
  draft: "neutral",
  legal_pending: "warning",
  finance_pending: "foreground",
  ready: "success",
  active: "success",
} as const satisfies Record<string, SemanticStatusTone>;

export const CAMPAIGN_STATUS_TONE = {
  draft: "neutral",
  planning: "foreground",
  active: "success",
  paused: "warning",
  completed: "foreground",
  cancelled: "destructive",
} as const satisfies Record<string, SemanticStatusTone>;

export const VENDOR_STATUS_TONE = {
  prospect: "foreground",
  active: "success",
  inactive: "neutral",
  blacklisted: "destructive",
  archived: "neutral",
} as const satisfies Record<string, SemanticStatusTone>;

export const CAMPAIGN_ASSIGNMENT_STATUS_TONE = {
  draft: "neutral",
  assigned: "foreground",
  awaiting_content: "warning",
  submitted: "foreground",
  approved: "success",
  scheduled: "foreground",
  posted: "foreground",
  verified: "success",
  invoiced: "warning",
  paid: "success",
  closed: "neutral",
} as const satisfies Record<string, SemanticStatusTone>;

export const OPERATIONAL_STATUS_TONE = {
  draft: "neutral",
  io_generated: "foreground",
  io_revised: "warning",
  locked: "success",
  moved_to_billing: "foreground",
  partially_invoiced: "success",
  invoiced: "success",
  reopened: "warning",
  closed: "neutral",
} as const satisfies Record<string, SemanticStatusTone>;

export const LINE_BILLING_HIERARCHY_TONE = {
  draft: "neutral",
  approved: "foreground",
  moved_to_billing: "foreground",
  partially_invoiced: "warning",
  invoiced: "success",
  partially_paid: "warning",
  paid: "success",
  closed: "neutral",
} as const satisfies Record<string, SemanticStatusTone>;

export const LINE_BILLING_TABLE_TONE = {
  draft: "neutral",
  approved: "foreground",
  moved_to_billing: "warning",
  partially_invoiced: "foreground",
  invoiced: "success",
  partially_paid: "warning",
  paid: "success",
  closed: "neutral",
} as const satisfies Record<string, SemanticStatusTone>;

export const DELIVERABLE_BILLING_HIERARCHY_TONE = {
  draft: "neutral",
  ready_to_invoice: "foreground",
  partially_invoiced: "warning",
  invoiced: "success",
  partially_collected: "warning",
  collected: "success",
  disputed: "destructive",
  cancelled: "neutral",
} as const satisfies Record<string, SemanticStatusTone>;

export const DELIVERABLE_BILLING_TABLE_TONE = {
  draft: "neutral",
  ready_to_invoice: "warning",
  partially_invoiced: "foreground",
  invoiced: "foreground",
  partially_collected: "warning",
  collected: "success",
  disputed: "destructive",
  cancelled: "neutral",
} as const satisfies Record<string, SemanticStatusTone>;

export const COLLECTION_STATUS_TONE = {
  pending: "neutral",
  partial: "warning",
  collected: "success",
  overdue: "destructive",
  written_off: "neutral",
} as const satisfies Record<string, SemanticStatusTone>;

export const IO_STATUS_TONE = {
  draft: "neutral",
  generated: "foreground",
  sent: "foreground",
  approved: "success",
  rejected: "destructive",
  cancelled: "destructive",
} as const satisfies Record<string, SemanticStatusTone>;

export const INVOICE_STATUS_TONE = {
  draft: "neutral",
  sent: "foreground",
  partial: "warning",
  paid: "success",
  overdue: "destructive",
  void: "destructive",
} as const satisfies Record<string, SemanticStatusTone>;

export const ADJUSTMENT_STATUS_TONE = {
  draft: "neutral",
  approved: "foreground",
  posted: "success",
  cancelled: "destructive",
  void: "destructive",
  pending_repost: "warning",
} as const satisfies Record<string, SemanticStatusTone>;

export const POSTING_BATCH_STATUS_TONE = {
  draft: "neutral",
  posted: "success",
  reversed: "warning",
  failed: "destructive",
} as const satisfies Record<string, SemanticStatusTone>;

export const USER_STATUS_TONE = {
  invited: "foreground",
  active: "success",
  disabled: "destructive",
} as const satisfies Record<string, SemanticStatusTone>;

export const PORTAL_STATUS_TONE = {
  pending: "warning",
  invited: "warning",
  sent: "foreground",
  submitted: "foreground",
  invoiced: "foreground",
  approved: "success",
  paid: "success",
  active: "success",
  rejected: "destructive",
  draft: "neutral",
  "partially paid": "warning",
} as const satisfies Record<string, SemanticStatusTone>;

export const IMPORT_STATUS_TONE = {
  uploaded: "neutral",
  queued: "foreground",
  processing: "warning",
  completed: "success",
  failed: "destructive",
} as const satisfies Record<string, SemanticStatusTone>;

export const PLATFORM_SYNC_STATUS_TONE = {
  synced: "success",
  partial: "warning",
  manual: "neutral",
  failed: "destructive",
  pending: "warning",
  pending_api: "foreground",
} as const satisfies Record<string, SemanticStatusTone>;

export const CREATOR_ENRICHMENT_STATUS_TONE = {
  never: "neutral",
  queued: "foreground",
  running: "foreground",
  enriched: "success",
  partial: "warning",
  failed: "destructive",
  skipped: "neutral",
} as const satisfies Record<string, SemanticStatusTone>;

export const QUOTATION_STATUS_TONE = {
  draft: "neutral",
  under_review: "warning",
  approved: "success",
  sent: "foreground",
  accepted: "success",
  rejected: "destructive",
  cancelled: "destructive",
  archived: "neutral",
} as const satisfies Record<string, SemanticStatusTone>;

export const SHORTLIST_STATUS_TONE = {
  draft: "neutral",
  under_review: "warning",
  approved: "success",
  cancelled: "destructive",
  archived: "neutral",
} as const satisfies Record<string, SemanticStatusTone>;

export const SHORTLIST_ITEM_STATUS_TONE = {
  draft: "neutral",
  under_review: "warning",
  approved: "success",
  rejected: "destructive",
  moved_to_campaign: "foreground",
  cancelled: "neutral",
} as const satisfies Record<string, SemanticStatusTone>;

export const SHORTLIST_ASSIGNMENT_STATUS_TONE = {
  suggested: "foreground",
  invited: "warning",
  approved: "success",
  contracted: "success",
  published: "foreground",
  rejected: "destructive",
  removed: "neutral",
} as const satisfies Record<string, SemanticStatusTone>;

export const METRICS_REFRESH_STATUS_TONE = {
  completed: "success",
  partial: "warning",
  manual_required: "warning",
  failed: "destructive",
  collecting: "foreground",
  queued: "foreground",
} as const satisfies Record<string, SemanticStatusTone>;

export const STATUS_TONE_MAPS = {
  client: CLIENT_STATUS_TONE,
  onboarding: ONBOARDING_STATUS_TONE,
  campaign: CAMPAIGN_STATUS_TONE,
  vendor: VENDOR_STATUS_TONE,
  campaignAssignment: CAMPAIGN_ASSIGNMENT_STATUS_TONE,
  operational: OPERATIONAL_STATUS_TONE,
  lineBillingHierarchy: LINE_BILLING_HIERARCHY_TONE,
  lineBillingTable: LINE_BILLING_TABLE_TONE,
  deliverableBillingHierarchy: DELIVERABLE_BILLING_HIERARCHY_TONE,
  deliverableBillingTable: DELIVERABLE_BILLING_TABLE_TONE,
  collection: COLLECTION_STATUS_TONE,
  io: IO_STATUS_TONE,
  invoice: INVOICE_STATUS_TONE,
  adjustment: ADJUSTMENT_STATUS_TONE,
  postingBatch: POSTING_BATCH_STATUS_TONE,
  user: USER_STATUS_TONE,
  portal: PORTAL_STATUS_TONE,
  import: IMPORT_STATUS_TONE,
  platformSync: PLATFORM_SYNC_STATUS_TONE,
  creatorEnrichment: CREATOR_ENRICHMENT_STATUS_TONE,
  quotation: QUOTATION_STATUS_TONE,
  shortlist: SHORTLIST_STATUS_TONE,
  shortlistItem: SHORTLIST_ITEM_STATUS_TONE,
  shortlistAssignment: SHORTLIST_ASSIGNMENT_STATUS_TONE,
  metricsRefresh: METRICS_REFRESH_STATUS_TONE,
} as const;

export type StatusToneDomain = keyof typeof STATUS_TONE_MAPS;
