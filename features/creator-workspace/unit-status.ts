import { isEphemeralStoryDeliverableType } from "@/lib/campaigns/deliverable-taxonomy";

/**
 * Creator-facing presentation only. The four operational layers stay authoritative:
 * documentation receipt, client decision, post schedule, publication.
 */
export const CREATOR_UNIT_STATUSES = [
  "to_do",
  "uploaded",
  "under_review",
  "changes_requested",
  "approved",
  "scheduled",
  "published",
] as const;

export type CreatorUnitStatus = (typeof CREATOR_UNIT_STATUSES)[number];

export const CREATOR_UNIT_STATUS_LABEL: Record<CreatorUnitStatus, string> = {
  to_do: "Needs submission",
  uploaded: "Submitted",
  under_review: "Under review",
  changes_requested: "Changes requested",
  approved: "Approved",
  scheduled: "Scheduled",
  published: "Published",
};

export type CreatorUnitStatusInput = {
  received: boolean;
  releasedToClient: boolean;
  clientDecision: "approved" | "changes_requested" | null;
  postStatus: string | null;
  hasPublicationUrl: boolean;
  publicationStatus: string | null;
};

const SCHEDULED_POST_STATUSES = new Set([
  "scheduled",
  "live",
  "published",
  "completed",
]);

export function projectCreatorUnitStatus(
  input: CreatorUnitStatusInput
): CreatorUnitStatus {
  const publicationStatus = (input.publicationStatus ?? "").trim().toLowerCase();
  if (input.hasPublicationUrl || publicationStatus === "published") {
    return "published";
  }

  const postStatus = (input.postStatus ?? "").trim().toLowerCase();
  if (SCHEDULED_POST_STATUSES.has(postStatus)) {
    return "scheduled";
  }

  const decision = input.releasedToClient ? input.clientDecision : null;
  if (decision === "changes_requested") return "changes_requested";
  if (decision === "approved") return "approved";
  if (input.received && input.releasedToClient && !decision) return "under_review";
  if (input.received) return "uploaded";
  return "to_do";
}

export function unitExpectsPublicationUrl(
  deliverableType: string | null | undefined
): boolean {
  return !isEphemeralStoryDeliverableType(deliverableType);
}

export function creatorUploadPrompt(
  deliverableTypeLabel: string | null | undefined
): string {
  const label = (deliverableTypeLabel ?? "content").trim() || "content";
  return `Upload your ${label}`;
}

export function isCreatorUnitOverdue(
  dueDate: string | null | undefined,
  status: CreatorUnitStatus
): boolean {
  if (!dueDate) return false;
  if (status === "published" || status === "approved" || status === "scheduled") {
    return false;
  }
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}

export function unitNeedsPublicationLink(input: {
  status: string;
  expectsPublicationUrl?: boolean;
  publicationUrl?: string | null;
}): boolean {
  if (!input.expectsPublicationUrl) return false;
  if (input.publicationUrl?.trim()) return false;
  return input.status === "approved" || input.status === "scheduled";
}

export function creatorFacingStatusLabel(input: {
  status: CreatorUnitStatus;
  dueDate?: string | null;
  expectsPublicationUrl?: boolean;
  publicationUrl?: string | null;
}): string {
  if (isCreatorUnitOverdue(input.dueDate, input.status)) return "Overdue";
  if (
    input.status === "approved" &&
    input.expectsPublicationUrl &&
    !input.publicationUrl?.trim()
  ) {
    return "Ready to publish";
  }
  if (input.status === "published") return "Published";
  return CREATOR_UNIT_STATUS_LABEL[input.status];
}
