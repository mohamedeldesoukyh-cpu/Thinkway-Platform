import { formatLifecycleStateLabel } from "@/lib/document-lifecycle/labels";
import { formatLifecycleReasonLabel, normalizeReasonCode } from "@/lib/document-lifecycle/reason-codes";
import type {
  DocumentLifecycleAction,
  DocumentLifecycleSnapshot,
  DocumentLifecycleState,
  ResolvedDocumentLifecycle,
} from "@/lib/document-lifecycle/types";

export function resolveClientIoLifecycleState(
  snapshot: DocumentLifecycleSnapshot
): DocumentLifecycleState {
  if (snapshot.isSuperseded) return "superseded";

  const status = (snapshot.status ?? "").toLowerCase();
  if (status === "cancelled") return "cancelled";
  if (status === "archived") return "archived";
  if (status === "revision_required") return "revision_required";
  if (status === "approved") return "accepted";
  if (status === "rejected") return "rejected";
  if (status === "under_client_review") return "sent";
  if (status === "sent") return "sent";
  if (status === "generated") return "pending_send";
  return "draft";
}

const MATRIX: Record<DocumentLifecycleState, DocumentLifecycleAction[]> = {
  draft: ["generate", "preview", "edit", "send", "delete"],
  pending_send: ["preview", "edit", "send", "delete"],
  sent: ["view", "download", "resend", "regenerate"],
  delivered_manually: ["view", "download", "regenerate"],
  viewed: ["view", "download", "resend", "regenerate"],
  accepted: ["view", "download"],
  rejected: ["view", "regenerate", "preview_changes", "send_updated_version"],
  revision_required: [
    "view",
    "preview_changes",
    "regenerate",
    "send_updated_version",
  ],
  superseded: ["view", "download"],
  cancelled: ["view", "download"],
  archived: ["view", "download"],
};

export function resolveClientIoLifecycle(
  snapshot: DocumentLifecycleSnapshot
): ResolvedDocumentLifecycle {
  const lifecycleState = resolveClientIoLifecycleState(snapshot);
  const availableActions = [...(MATRIX[lifecycleState] ?? [])];
  const reasonCode = normalizeReasonCode(snapshot.lifecycleReasonCode);

  return {
    documentType: "client_io",
    documentId: snapshot.id,
    lifecycleState,
    persistedStatus: snapshot.status,
    reasonCode,
    reasonDetail: snapshot.lifecycleReasonDetail?.trim() || null,
    availableActions,
    disabledActions: [],
    labels: {
      state: formatLifecycleStateLabel(lifecycleState),
      reason: formatLifecycleReasonLabel(
        reasonCode,
        snapshot.lifecycleReasonDetail
      ),
    },
    bulkSkipReason: null,
    aiHints: {
      outdated: lifecycleState === "revision_required",
      recommendRegenerate: lifecycleState === "revision_required",
      recommendBulkRegenerate: lifecycleState === "revision_required",
      detectionSummary:
        lifecycleState === "revision_required"
          ? formatLifecycleReasonLabel(
              reasonCode,
              snapshot.lifecycleReasonDetail
            )
          : null,
      estimatedImpact: null,
      affectedDocumentTypes: ["client_io"],
    },
  };
}

export function clientIoAllowsAction(
  snapshot: DocumentLifecycleSnapshot,
  action: DocumentLifecycleAction
): boolean {
  return resolveClientIoLifecycle(snapshot).availableActions.includes(action);
}
