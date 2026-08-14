/** Shared campaign / billing / performance domain types. */

import type {
  AssignmentPricingMode,
  CommercialDeliverableRow,
} from "@/lib/domains/commercial/types";
import type { CampaignMetricsSyncHealth } from "@/lib/performance/metrics-collector/types";

export type CampaignLineBillingStatus =
  | "draft"
  | "approved"
  | "moved_to_billing"
  | "partially_invoiced"
  | "invoiced"
  | "partially_paid"
  | "paid"
  | "closed";

export type AssignmentDeliverableBillingStatus =
  | "draft"
  | "ready_to_invoice"
  | "partially_invoiced"
  | "invoiced"
  | "partially_collected"
  | "collected"
  | "disputed"
  | "cancelled";

export type CollectionStatus =
  | "pending"
  | "partial"
  | "collected"
  | "overdue"
  | "written_off";

export type VendorPaymentStatus = "unpaid" | "pending" | "paid" | "cancelled";

export type FinancialApprovalStage =
  | "campaign_manager"
  | "finance"
  | "cfo_admin";

export type WorkflowStage =
  | "planning"
  | "negotiation"
  | "live"
  | "completed"
  | "invoicing"
  | "closed";

export type CampaignLineAssignmentStatus =
  | "draft"
  | "assigned"
  | "awaiting_content"
  | "submitted"
  | "approved"
  | "scheduled"
  | "posted"
  | "verified"
  | "invoiced"
  | "paid"
  | "closed";

export type LinePaymentStatus = "pending" | "partial" | "paid";

export type CampaignLineOperationalStatus =
  | "draft"
  | "io_generated"
  | "io_revised"
  | "locked"
  | "moved_to_billing"
  | "partially_invoiced"
  | "invoiced"
  | "reopened"
  | "closed";

export type DeliverableCollectionStatus =
  | "pending"
  | "partial"
  | "collected"
  | null;

export type LinePlatformSelection = {
  account_id: string;
  platform: string;
  handle: string;
  profile_url: string | null;
  follower_count: number | null;
  engagement_rate: number | null;
  audience_country: string | null;
  deliverables: string[];
};

export type LineInfluencerAssignment = {
  influencer_id: string;
  influencer_name: string;
  influencer_document_number: string;
  platforms: LinePlatformSelection[];
  title_user_edited?: boolean;
  /** Defaults to package for legacy assignments. */
  pricing_mode?: AssignmentPricingMode;
  commercial_rows?: CommercialDeliverableRow[];
};

export type CampaignPublicationRow = {
  id: string;
  campaign_header_id: string;
  campaign_line_id: string | null;
  assignment_deliverable_id: string | null;
  assignment_post_schedule_id: string | null;
  influencer_id: string | null;
  influencer_name: string | null;
  influencer_handle: string | null;
  influencer_profile_url: string | null;
  creator_profile_image_url: string | null;
  influencer_avatar_url: string | null;
  social_profile_picture_url: string | null;
  apify_author_avatar_url: string | null;
  creator_avatar_url: string | null;
  platform: string;
  publication_type: string;
  publication_type_label: string;
  platform_label: string;
  content_url: string | null;
  publication_date: string | null;
  status: string;
  assignee_id: string | null;
  assignee_name: string | null;
  caption: string | null;
  hashtags: string | null;
  mentions: string | null;
  hashtag_count: number | null;
  mention_count: number | null;
  thumbnail_url: string | null;
  screenshot_url: string | null;
  screenshot_captured_at: string | null;
  screenshot_source: string | null;
  notes: string | null;
  auto_detected: boolean;
  created_at: string;
  updated_at: string | null;
  last_synced_at: string | null;
  sync_status: string | null;
  sync_source: string | null;
  metrics_refresh_status: string | null;
  metrics_refresh_attempted_at: string | null;
  metrics_collection_source: string | null;
  metrics_provider: string | null;
  metrics_confidence: number | null;
  stored_engagements: number | null;
  impressions: number | null;
  impressions_source: string | null;
  actual_impressions: number | null;
  forecast_impressions: number | null;
  forecast_impressions_formula: string | null;
  reach: number | null;
  reach_source: string | null;
  actual_reach: number | null;
  forecast_reach: number | null;
  views: number | null;
  unique_views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  clicks: number | null;
  plays: number | null;
  watch_time_seconds: number | null;
  average_watch_time_seconds: number | null;
  completion_rate: number | null;
  engagement_rate: number | null;
  engagement_rate_method: string | null;
  platform_follower_count: number | null;
  view_rate: number | null;
  cpm: number | null;
  cpv: number | null;
  cpe: number | null;
  cpc: number | null;
  sentiment_score: number | null;
  brand_safety_score: number | null;
  authenticity_score: number | null;
  cost: number | null;
  currency: string | null;
  total_engagements: number;
  /**
   * Agreed = publication platform is on the creator's assignment.
   * Added value = extra platform beyond the assignment. Recomputed from live assignments.
   */
  value_scope?: "agreed" | "added_value";
};

export type CampaignPerformanceSummary = {
  total_publications: number;
  /** Publications whose platform is on the creator's assignment. */
  agreed_publications: number;
  /** Publications on platforms not included in the assignment. */
  added_value_publications: number;
  total_reach: number;
  total_actual_reach: number;
  total_forecast_reach: number;
  total_manual_reach: number;
  total_impressions: number;
  total_actual_impressions: number;
  total_forecast_impressions: number;
  total_manual_impressions: number;
  total_views: number;
  total_engagements: number;
  average_engagement_rate: number | null;
  average_cpm: number | null;
  average_cpv: number | null;
  top_creator_name: string | null;
  top_creator_engagements: number;
  currency: string;
};

export type CampaignPerformanceCharts = {
  performance_over_time: Array<{
    date: string;
    views: number;
    engagements: number;
    reach: number;
  }>;
  platform_split: Array<{
    platform: string;
    label: string;
    count: number;
    engagements: number;
  }>;
  content_type_split: Array<{ type: string; label: string; count: number }>;
  top_creators_by_engagement: Array<{
    name: string;
    engagements: number;
    views: number;
  }>;
  reach_by_creator: Array<{ name: string; reach: number }>;
  views_by_publication: Array<{ id: string; label: string; views: number }>;
  engagement_distribution: Array<{ bucket: string; count: number }>;
};

export type CampaignPerformanceBundle = {
  publications: CampaignPublicationRow[];
  summary: CampaignPerformanceSummary;
  charts: CampaignPerformanceCharts;
  sync_health: CampaignMetricsSyncHealth;
  load_error: string | null;
  schema_warnings: string[];
};

export type PublicationMetricSyncLogRow = {
  id: string;
  created_at: string;
  provider: string | null;
  status: string;
  metrics_refresh_status: string | null;
  message: string | null;
  duration_ms: number | null;
  metrics_snapshot: Record<string, number | null> | null;
  triggered_by: string | null;
  previous_er: number | null;
  new_er: number | null;
  previous_method: string | null;
  new_method: string | null;
  response_summary: Record<string, unknown> | null;
};
