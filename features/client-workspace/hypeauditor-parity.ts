export type HypeAuditorParityRow = {
  capability: string;
  thinkway: string;
  ssot: string;
  status: "shipped" | "partial" | "not_copied";
};

export const HYPEAUDITOR_MEDIA_PLAN_PARITY: HypeAuditorParityRow[] = [
  {
    capability: "Campaign summary",
    thinkway: "Estimated reach, engagements, CPE, CPM, EMV, creator count, activity mix from frozen snapshot",
    ssot: "Campaign Forecast Engine + quotation/client revenue + snapshot deliverables",
    status: "shipped",
  },
  {
    capability: "Creator cards",
    thinkway: "Portrait, platform, identity, location, followers, ER, category, audience, match, deliverables, investment, status, why recommended",
    ssot: "source_snapshot + unified creator metrics + commercial revenue",
    status: "shipped",
  },
  {
    capability: "Creator detail",
    thinkway: "Profile, audience, performance, content, fit, category, match, deliverables, commercial, comments",
    ssot: "source_snapshot freeze-on-read via ECI consume-only + stored publications",
    status: "shipped",
  },
  {
    capability: "Audience",
    thinkway: "Age, gender, location, interests when verified in ECI/unified data; otherwise Not available",
    ssot: "loadCreatorIntelligenceBundle audience layer",
    status: "shipped",
  },
  {
    capability: "Performance",
    thinkway: "Average likes/comments/views, ER, estimated reach with client-safe explanations",
    ssot: "Unified creator metrics + ECI performance + Campaign Forecast per creator when frozen",
    status: "shipped",
  },
  {
    capability: "Content feed",
    thinkway: "Stored post thumbnails with likes/comments/views/ER; Content data unavailable when none",
    ssot: "influencer_platform_accounts.recent_publications already stored",
    status: "shipped",
  },
  {
    capability: "Deliverables",
    thinkway: "Proposed deliverable mix or Deliverables to be confirmed",
    ssot: "Shortlist/quotation/studio selected deliverables in source_snapshot",
    status: "shipped",
  },
  {
    capability: "Commercial",
    thinkway: "Client-facing creator investment only",
    ssot: "Quotation/shortlist/studio quoted revenue — never cost, GP, margin",
    status: "shipped",
  },
  {
    capability: "Creator selection",
    thinkway: "Accept / Reject / In Review, multi-select, select all, clear, selected investment",
    ssot: "campaign_client_reviews.selection_state + shortlist item_status",
    status: "shipped",
  },
  {
    capability: "Filters",
    thinkway: "All / Recommended / Accepted / In Review / Rejected plus platform, category, tier, location when data supports",
    ssot: "source_snapshot creator fields",
    status: "shipped",
  },
  {
    capability: "Comments",
    thinkway: "Creator comments, reject reason, per-creator change request",
    ssot: "campaign_client_review_comments",
    status: "shipped",
  },
  {
    capability: "Approval",
    thinkway: "Per-creator accept/reject plus campaign approve / reject / request changes",
    ssot: "campaign_client_reviews status + selection_state",
    status: "shipped",
  },
  {
    capability: "Versioning",
    thinkway: "Frozen source_snapshot; freeze-on-read only for missing briefs on open reviews",
    ssot: "campaign_client_reviews.source_snapshot",
    status: "shipped",
  },
  {
    capability: "Responsive experience",
    thinkway: "Dense 12-column media-plan on desktop; stacked cards and full-screen creator profile on mobile",
    ssot: "Client Workspace UI",
    status: "shipped",
  },
  {
    capability: "Content Plan",
    thinkway: "Influencer-first content rows from snapshot; empty state is Content direction to be confirmed",
    ssot: "source_snapshot.content + campaign brief",
    status: "shipped",
  },
  {
    capability: "Overview",
    thinkway: "Campaign at a glance, forecast, activity mix, strategic pillars, creator mix from actual roster",
    ssot: "Campaign Facts + Campaign Forecast + source_snapshot",
    status: "shipped",
  },
  {
    capability: "Feedback collaboration",
    thinkway: "Threaded change requests by campaign/creator/content/commercial with open/resolved status",
    ssot: "campaign_client_review_comments",
    status: "shipped",
  },
  {
    capability: "HypeAuditor AQS",
    thinkway: "Not implemented — Thinkway does not copy proprietary authenticity scoring",
    ssot: "n/a",
    status: "not_copied",
  },
  {
    capability: "Bot / authenticity pie",
    thinkway: "Not implemented",
    ssot: "n/a",
    status: "not_copied",
  },
  {
    capability: "ROI",
    thinkway: "Not implemented — requires reliable cost data; client sees investment only",
    ssot: "n/a",
    status: "not_copied",
  },
];
