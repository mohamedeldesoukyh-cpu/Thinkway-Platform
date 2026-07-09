import type {
  CampaignShortlistAssignmentStatus,
  ShortlistStatus,
  ShortlistVisibilityV2,
} from "@/types/database";

export const SHORTLIST_STATUSES: ShortlistStatus[] = [
  "draft",
  "under_review",
  "approved",
  "cancelled",
  "archived",
];

export const SHORTLIST_STATUS_LABELS: Record<ShortlistStatus, string> = {
  draft: "Draft",
  under_review: "Under Review",
  approved: "Approved",
  cancelled: "Cancelled",
  archived: "Archived",
};

export const SHORTLIST_VISIBILITIES: ShortlistVisibilityV2[] = [
  "private",
  "team",
  "client_shared",
];

export const SHORTLIST_VISIBILITY_LABELS: Record<ShortlistVisibilityV2, string> = {
  private: "Private",
  team: "Team",
  client_shared: "Client Shared",
};

/**
 * Visibilities a user can pick in the UI today. "client_shared" is supported in
 * schema/enums (spec §4, §12 client-portal-ready) but intentionally not selectable
 * until the client portal ships.
 */
export const SELECTABLE_SHORTLIST_VISIBILITIES: ShortlistVisibilityV2[] = [
  "private",
  "team",
];

export const ASSIGNMENT_STATUS_LABELS: Record<
  CampaignShortlistAssignmentStatus,
  string
> = {
  suggested: "Suggested",
  invited: "Invited",
  approved: "Approved",
  contracted: "Contracted",
  published: "Published",
  rejected: "Rejected",
  removed: "Removed",
};

export const SHORTLIST_ITEM_STATUSES = [
  "draft",
  "under_review",
  "approved",
  "rejected",
  "moved_to_campaign",
  "cancelled",
] as const;

export const SHORTLIST_ITEM_STATUS_LABELS: Record<
  (typeof SHORTLIST_ITEM_STATUSES)[number],
  string
> = {
  draft: "Draft",
  under_review: "Under Review",
  approved: "Approved",
  rejected: "Rejected",
  moved_to_campaign: "Moved To Campaign",
  cancelled: "Cancelled",
};

/** Shortlist creator table — tracks creators sent to a linked quotation. */
export const SHORTLIST_QUOTED_COLUMN_LABEL = "Quoted";

/** Permission slugs powering shortlist authorization (spec §16). */
export const SHORTLIST_PERMISSIONS = {
  /** Discovery User — create/edit own drafts, add creators. */
  write: "discovery.write",
  /** Read team / client-shared shortlists. */
  read: "discovery.read",
  /** Team Leader / Admin — approve, reject, manage any shortlist. */
  admin: "discovery.admin",
} as const;

export function shortlistDetailPath(shortlistId: string): string {
  return `/discovery/shortlists/${shortlistId}`;
}

export function shortlistPreviewPath(
  shortlistId: string,
  options?: { template?: "summary" | "detailed"; itemIds?: string[] }
): string {
  const params = new URLSearchParams();
  if (options?.template === "detailed") {
    params.set("template", "detailed");
  }
  if (options?.itemIds?.length) {
    params.set("items", options.itemIds.join(","));
  }
  const query = params.toString();
  return `/discovery/shortlists/${shortlistId}/preview${query ? `?${query}` : ""}`;
}
