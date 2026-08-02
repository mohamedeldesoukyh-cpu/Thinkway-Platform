import { formatLifecycleStateLabel } from "@/lib/document-lifecycle/labels";
import { formatLifecycleReasonLabel, normalizeReasonCode } from "@/lib/document-lifecycle/reason-codes";
import type {
  DocumentLifecycleAction,
  DocumentLifecycleAiHints,
  DocumentLifecycleSnapshot,
  DocumentLifecycleState,
  ResolvedDocumentLifecycle,
} from "@/lib/document-lifecycle/types";

function emptyAiHints(
  partial?: Partial<DocumentLifecycleAiHints>
): DocumentLifecycleAiHints {
  return {
    outdated: false,
    recommendRegenerate: false,
    recommendBulkRegenerate: false,
    detectionSummary: null,
    estimatedImpact: null,
    affectedDocumentTypes: ["vendor_io"],
    ...partial,
  };
}

/** Issued = legally/operationally out to the vendor (not a pre-issue draft). */
export function isVendorIoIssued(snapshot: DocumentLifecycleSnapshot): boolean {
  if (snapshot.isSuperseded) return false;
  const status = (snapshot.status ?? "").toLowerCase();
  if (
    status === "sent" ||
    status === "approved" ||
    status === "revision_required" ||
    status === "rejected"
  ) {
    return true;
  }
  if (snapshot.sentAt) return true;
  const delivery = (snapshot.deliveryStatus ?? "").toLowerCase();
  return delivery === "sent" || delivery === "completed";
}

export function resolveVendorIoLifecycleState(
  snapshot: DocumentLifecycleSnapshot
): DocumentLifecycleState {
  if (snapshot.isSuperseded) return "superseded";

  const status = (snapshot.status ?? "").toLowerCase();
  if (status === "cancelled") return "cancelled";
  if (status === "archived") return "archived";
  if (status === "revision_required") return "revision_required";
  if (status === "approved") return "accepted";
  if (status === "rejected") return "rejected";

  if (
    snapshot.deliveryMethod === "manual" &&
    (snapshot.deliveryStatus === "completed" || status === "sent")
  ) {
    return "delivered_manually";
  }

  if (status === "sent") {
    if (snapshot.viewedAt) return "viewed";
    return "sent";
  }

  if (status === "generated") return "pending_send";
  if (status === "draft") return "draft";

  // Fallback for unexpected persisted values
  if (snapshot.sentAt) return "sent";
  return "draft";
}

const MATRIX: Record<DocumentLifecycleState, DocumentLifecycleAction[]> = {
  draft: ["generate", "preview", "edit", "send", "mark_delivered_manually", "delete"],
  pending_send: [
    "preview",
    "edit",
    "send",
    "mark_delivered_manually",
    "delete",
  ],
  sent: [
    "view",
    "download",
    "resend",
    "mark_accepted",
    "upload_signed",
    "change_payment_terms",
  ],
  delivered_manually: [
    "view",
    "download",
    "mark_accepted",
    "upload_signed",
    "change_payment_terms",
  ],
  viewed: [
    "view",
    "download",
    "resend",
    "mark_accepted",
    "upload_signed",
    "change_payment_terms",
  ],
  accepted: ["view", "download", "upload_signed"],
  rejected: ["view", "regenerate", "preview_changes", "send_updated_version"],
  revision_required: [
    "view",
    "preview_changes",
    "regenerate",
    "send_updated_version",
    "mark_delivered_manually",
  ],
  superseded: ["view", "download"],
  cancelled: ["view", "download"],
  archived: ["view", "download"],
};

function bulkSkipFor(
  state: DocumentLifecycleState,
  action: DocumentLifecycleAction
): string | null {
  const available = MATRIX[state] ?? [];
  if (available.includes(action)) return null;
  if (state === "accepted" && action === "mark_accepted") {
    return "Already accepted.";
  }
  if (
    (state === "sent" ||
      state === "delivered_manually" ||
      state === "viewed" ||
      state === "accepted") &&
    (action === "send" || action === "mark_delivered_manually")
  ) {
    return "Already sent or delivered.";
  }
  if (state === "cancelled") return "Document cancelled.";
  if (state === "superseded") return "Document superseded.";
  if (state === "revision_required" && action === "mark_accepted") {
    return "Revision required — regenerate before acceptance.";
  }
  if (state === "revision_required" && action === "send") {
    return "Revision required — regenerate, then send updated version.";
  }
  return `Action not valid for ${formatLifecycleStateLabel(state)}.`;
}

export function resolveVendorIoLifecycle(
  snapshot: DocumentLifecycleSnapshot
): ResolvedDocumentLifecycle {
  const lifecycleState = resolveVendorIoLifecycleState(snapshot);
  const availableActions = [...(MATRIX[lifecycleState] ?? [])];
  const allActions = Object.values(MATRIX).flat();
  const uniqueAll = [...new Set(allActions)];
  const disabledActions = uniqueAll.filter((a) => !availableActions.includes(a));

  const reasonCode = normalizeReasonCode(snapshot.lifecycleReasonCode);
  const reasonDetail =
    snapshot.lifecycleReasonDetail?.trim() ||
    formatLifecycleReasonLabel(reasonCode) ||
    null;

  const outdated = lifecycleState === "revision_required";

  return {
    documentType: "vendor_io",
    documentId: snapshot.id,
    lifecycleState,
    persistedStatus: snapshot.status,
    reasonCode,
    reasonDetail,
    availableActions,
    disabledActions,
    labels: {
      state: formatLifecycleStateLabel(lifecycleState),
      reason: outdated
        ? formatLifecycleReasonLabel(reasonCode, snapshot.lifecycleReasonDetail)
        : formatLifecycleReasonLabel(reasonCode, snapshot.lifecycleReasonDetail),
    },
    bulkSkipReason: null,
    aiHints: emptyAiHints({
      outdated,
      recommendRegenerate: outdated,
      recommendBulkRegenerate: outdated,
      detectionSummary: outdated
        ? reasonDetail ?? "Underlying business data changed after issuance."
        : null,
      estimatedImpact: null,
      affectedDocumentTypes: outdated
        ? ["vendor_io", "client_io"]
        : ["vendor_io"],
    }),
  };
}

export function vendorIoAllowsAction(
  snapshot: DocumentLifecycleSnapshot,
  action: DocumentLifecycleAction
): boolean {
  return resolveVendorIoLifecycle(snapshot).availableActions.includes(action);
}

export function vendorIoBulkSkipReason(
  snapshot: DocumentLifecycleSnapshot,
  action: DocumentLifecycleAction
): string | null {
  const resolved = resolveVendorIoLifecycle(snapshot);
  return bulkSkipFor(resolved.lifecycleState, action);
}
