import type { CampaignStatus } from "@/types/database";

export const CAMPAIGNS_PAGE_SIZE = 10;

export const CAMPAIGN_STATUS_OPTIONS: {
  value: CampaignStatus;
  label: string;
}[] = [
  { value: "draft", label: "Draft" },
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

export const PLATFORM_OPTIONS = [
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "snapchat", label: "Snapchat" },
  { value: "twitter", label: "X (Twitter)" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "facebook", label: "Facebook" },
  { value: "multi", label: "Multi-platform" },
  { value: "other", label: "Other" },
] as const;

export const METADATA_PLATFORM_KEY = "platform";

/** Campaign flight / CIO Target Market — independent of legal-entity country. */
export const METADATA_TARGET_MARKET_KEY = "target_market";

/** Per-Assignment usage period (CIO commercial notes; independent of billing terms). */
export const METADATA_USAGE_PERIOD_KEY = "usage_period";

export const WORKFLOW_STAGE_OPTIONS = [
  { value: "planning", label: "Planning" },
  { value: "negotiation", label: "Negotiation" },
  { value: "live", label: "Live" },
  { value: "completed", label: "Completed" },
  { value: "invoicing", label: "Invoicing" },
  { value: "closed", label: "Closed" },
] as const;

export const DELIVERABLE_TYPE_OPTIONS = [
  { value: "instagram_post", label: "Instagram post" },
  { value: "instagram_reel", label: "Instagram reel" },
  { value: "instagram_story", label: "Instagram story" },
  { value: "instagram_live", label: "Instagram live" },
  { value: "tiktok_video", label: "TikTok video" },
  { value: "tiktok_story", label: "TikTok story" },
  { value: "tiktok_live", label: "TikTok live" },
  { value: "snapchat_story", label: "Snapchat story" },
  { value: "snapchat_spotlight", label: "Snapchat Spotlight" },
  { value: "youtube_video", label: "YouTube integration" },
  { value: "youtube_short", label: "YouTube short" },
  { value: "youtube_dedicated", label: "YouTube dedicated" },
  { value: "other", label: "Other" },
] as const;

export const DELIVERABLE_DISPLAY_STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "posted", label: "Posted" },
] as const;

/** @deprecated Legacy vendor negotiation — use assignment_status on campaign lines. */
export const CAMPAIGN_VENDOR_STATUS_OPTIONS = [
  { value: "invited", label: "Invited" },
  { value: "negotiating", label: "Negotiating" },
  { value: "confirmed", label: "Confirmed" },
  { value: "declined", label: "Declined" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export { labelForBillingStatus } from "@/lib/domains/billing/constants";

export const LINE_BILLING_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  approved: "Approved",
  moved_to_billing: "Moved to billing",
  invoiced: "Invoiced",
  partially_paid: "Partially paid",
  paid: "Paid",
  closed: "Closed",
};

export const LINE_PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  partial: "Partial",
  paid: "Paid",
};

export const ASSIGNMENT_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "assigned", label: "Assigned" },
  { value: "awaiting_content", label: "Awaiting content" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
  { value: "scheduled", label: "Scheduled" },
  { value: "posted", label: "Posted" },
  { value: "verified", label: "Verified" },
  { value: "invoiced", label: "Invoiced" },
  { value: "paid", label: "Paid" },
  { value: "closed", label: "Closed" },
] as const;

export const ASSIGNMENT_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  ASSIGNMENT_STATUS_OPTIONS.map((o) => [o.value, o.label])
);

export const VENDOR_PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: "Unpaid",
  pending: "Pending payout",
  paid: "Paid out",
  cancelled: "Cancelled",
};

export {
  CAMPAIGNS_LIST_PATH,
  campaignDetailPath,
  campaignDetailPathWithTab,
  clientDetailPath,
  vendorDetailPath,
  groupDetailPath,
} from "@/lib/routing/entity-paths";
