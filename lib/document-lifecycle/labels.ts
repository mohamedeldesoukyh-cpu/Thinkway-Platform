import type { DocumentLifecycleState } from "@/lib/document-lifecycle/types";

const STATE_LABELS: Record<DocumentLifecycleState, string> = {
  draft: "Draft",
  pending_send: "Pending Send",
  sent: "Sent",
  delivered_manually: "Delivered Manually",
  viewed: "Viewed",
  accepted: "Accepted",
  rejected: "Rejected",
  revision_required: "Revision Required",
  superseded: "Superseded",
  cancelled: "Cancelled",
  archived: "Archived",
};

export function formatLifecycleStateLabel(state: DocumentLifecycleState): string {
  return STATE_LABELS[state] ?? state;
}
