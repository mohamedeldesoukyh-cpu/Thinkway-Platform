export const CLIENT_REVIEW_SOURCES = ["studio", "shortlist", "quotation"] as const;
export type ClientReviewSource = (typeof CLIENT_REVIEW_SOURCES)[number];

export const CLIENT_WORKSPACE_SECTIONS = [
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

export const CLIENT_REVIEW_COOKIE = "tw_client_review";

export const CLIENT_WORKSPACE_SECTION_LABEL: Record<ClientWorkspaceSectionId, string> = {
  overview: "Overview",
  strategy: "Strategy",
  creators: "Creators",
  content: "Content",
  commercial: "Commercial",
  quotation: "Quotation",
  timeline: "Timeline",
  feedback: "Feedback",
  approval: "Approval",
};

export const CLIENT_STATUS_LABEL: Record<ClientReviewStatus, string> = {
  awaiting_review: "Awaiting your review",
  changes_requested: "Changes requested",
  approved: "Approved",
  rejected: "Rejected",
  superseded: "Updated version available",
  revoked: "Link revoked",
};

export const CLIENT_CREATOR_STATUS_LABEL: Record<ClientCreatorSelectionState, string> = {
  in_review: "In Review",
  accepted: "Accepted",
  rejected: "Rejected",
};
