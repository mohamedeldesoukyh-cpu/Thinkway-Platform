import { resolveClientIoLifecycle } from "@/lib/document-lifecycle/policies/client-io";
import { resolveVendorIoLifecycle } from "@/lib/document-lifecycle/policies/vendor-io";
import { formatLifecycleStateLabel } from "@/lib/document-lifecycle/labels";
import type {
  DocumentLifecycleAction,
  DocumentLifecycleSnapshot,
  EnterpriseDocumentType,
  ResolvedDocumentLifecycle,
} from "@/lib/document-lifecycle/types";

/**
 * Single entry point for UI + bulk: document state → available actions.
 * Future document types plug in here — never hard-code button visibility in registers.
 */
export function resolveDocumentLifecycle(
  snapshot: DocumentLifecycleSnapshot
): ResolvedDocumentLifecycle {
  switch (snapshot.documentType) {
    case "vendor_io":
      return resolveVendorIoLifecycle(snapshot);
    case "client_io":
      return resolveClientIoLifecycle(snapshot);
    default:
      return stubLifecycle(snapshot);
  }
}

export function documentAllowsAction(
  snapshot: DocumentLifecycleSnapshot,
  action: DocumentLifecycleAction
): boolean {
  return resolveDocumentLifecycle(snapshot).availableActions.includes(action);
}

/** Stub policies for future enterprise documents — AI-ready extension points. */
function stubLifecycle(
  snapshot: DocumentLifecycleSnapshot
): ResolvedDocumentLifecycle {
  const type = snapshot.documentType as EnterpriseDocumentType;
  const superseded = Boolean(snapshot.isSuperseded);
  const status = (snapshot.status ?? "draft").toLowerCase();
  const lifecycleState = superseded
    ? "superseded"
    : status === "cancelled"
      ? "cancelled"
      : status === "revision_required"
        ? "revision_required"
        : status === "approved" || status === "accepted" || status === "paid"
          ? "accepted"
          : status === "sent"
            ? "sent"
            : "draft";

  const availableActions: DocumentLifecycleAction[] =
    lifecycleState === "revision_required"
      ? ["view", "regenerate", "preview_changes"]
      : lifecycleState === "superseded" || lifecycleState === "cancelled"
        ? ["view", "download"]
        : ["view", "edit", "send"];

  return {
    documentType: type,
    documentId: snapshot.id,
    lifecycleState,
    persistedStatus: snapshot.status,
    reasonCode: null,
    reasonDetail: null,
    availableActions,
    disabledActions: [],
    labels: {
      state: formatLifecycleStateLabel(lifecycleState),
      reason: null,
    },
    bulkSkipReason: null,
    aiHints: {
      outdated: lifecycleState === "revision_required",
      recommendRegenerate: lifecycleState === "revision_required",
      recommendBulkRegenerate: false,
      detectionSummary: null,
      estimatedImpact: null,
      affectedDocumentTypes: [type],
    },
  };
}
