export const CLIENT_REVIEW_SOURCES = ["studio", "shortlist", "quotation"] as const;
export type ClientReviewSource = (typeof CLIENT_REVIEW_SOURCES)[number];

export const CLIENT_WORKSPACE_SECTIONS = [
  "shortlist",
  "overview",
  "strategy",
  "creators",
  "content",
  "commercial",
  "quotation",
  "timeline",
  "feedback",
  "approval",
] as const;

export type ClientWorkspaceSectionId = (typeof CLIENT_WORKSPACE_SECTIONS)[number];

/** Primary nav: Shortlist → Your Selection → Commercial → Campaign → Overview (summary, not a journey stage). */
export const CLIENT_WORKSPACE_JOURNEY_SECTIONS = [
  "shortlist",
  "creators",
  "commercial",
  "approval",
  "overview",
] as const satisfies readonly ClientWorkspaceSectionId[];

export const CLIENT_REVIEW_STATUSES = [
  "awaiting_review",
  "changes_requested",
  "approved",
  "rejected",
  "superseded",
  "revoked",
] as const;

export type ClientReviewStatus = (typeof CLIENT_REVIEW_STATUSES)[number];

export const CLIENT_CREATOR_SELECTION_STATES = [
  "in_review",
  "accepted",
  "rejected",
] as const;

export type ClientCreatorSelectionState = (typeof CLIENT_CREATOR_SELECTION_STATES)[number];

export const CLIENT_COMMENT_TARGETS = ["campaign", "creator", "content", "commercial"] as const;
export type ClientCommentTargetType = (typeof CLIENT_COMMENT_TARGETS)[number];

export const CLIENT_CHANGE_AREAS = ["creator", "content", "commercial", "campaign"] as const;
export type ClientChangeArea = (typeof CLIENT_CHANGE_AREAS)[number];

export const CLIENT_CHANGE_AREA_LABEL: Record<ClientChangeArea, string> = {
  creator: "Creators",
  content: "Content",
  commercial: "Commercial",
  campaign: "Campaign",
};

export const CLIENT_SHORTLIST_STAGES = [
  "not_sent",
  "sent",
  "viewed",
  "changes_requested",
  "approved",
] as const;
export type ClientShortlistStage = (typeof CLIENT_SHORTLIST_STAGES)[number];

export const CLIENT_QUOTATION_STAGES = [
  "draft",
  "sent_for_approval",
  "viewed",
  "changes_requested",
  "updated",
  "approved",
  "rejected",
  "superseded",
] as const;
export type ClientQuotationStage = (typeof CLIENT_QUOTATION_STAGES)[number];

export type ClientReviewDecisionStage = "shortlist" | "quotation";

export const CLIENT_REVIEW_COOKIE = "tw_client_review";

export const CLIENT_REVIEW_LINK_MISSING_MESSAGE = "Generate the Client Workspace link first.";

export const CLIENT_WORKSPACE_SECTION_LABEL: Record<ClientWorkspaceSectionId, string> = {
  shortlist: "Shortlist",
  overview: "Overview",
  strategy: "Strategy",
  creators: "Your Selection",
  content: "Content Plan",
  commercial: "Commercial",
  quotation: "Quotation",
  timeline: "Timeline",
  feedback: "Feedback",
  approval: "Campaign",
};

export const CLIENT_STATUS_LABEL: Record<ClientReviewStatus, string> = {
  awaiting_review: "Awaiting your review",
  changes_requested: "Changes requested",
  approved: "Approved",
  rejected: "Rejected",
  superseded: "Updated version available",
  revoked: "Link revoked",
};

export const CLIENT_PROPOSAL_STATUS_LABEL: Record<ClientReviewStatus, string> = {
  awaiting_review: "In Review",
  changes_requested: "Changes requested",
  approved: "Approved",
  rejected: "Rejected",
  superseded: "Updated",
  revoked: "Revoked",
};

export const CLIENT_CREATOR_STATUS_LABEL: Record<ClientCreatorSelectionState, string> = {
  in_review: "Not selected",
  accepted: "Selected",
  rejected: "Not selected",
};
