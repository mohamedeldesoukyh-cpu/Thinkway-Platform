/**
 * Enterprise Document Lifecycle Engine — shared types.
 * Business State (campaign/stage) is NEVER conflated with Document State.
 */

/** Platform document kinds that share one lifecycle philosophy. */
export type EnterpriseDocumentType =
  | "vendor_io"
  | "client_io"
  | "quotation"
  | "purchase_order"
  | "invoice"
  | "contract"
  | "agreement"
  | "deliverable"
  | "report"
  | "approval_document";

/**
 * Presentation lifecycle state shown in headers / registers.
 * Persisted status may be a subset; delivery + superseded flags refine this view.
 */
export type DocumentLifecycleState =
  | "draft"
  | "pending_send"
  | "sent"
  | "delivered_manually"
  | "viewed"
  | "accepted"
  | "rejected"
  | "revision_required"
  | "superseded"
  | "cancelled"
  | "archived";

/** Canonical actions the UI / bulk runner may offer — never hard-coded in buttons. */
export type DocumentLifecycleAction =
  | "generate"
  | "preview"
  | "edit"
  | "send"
  | "resend"
  | "mark_delivered_manually"
  | "mark_accepted"
  | "upload_signed"
  | "change_payment_terms"
  | "regenerate"
  | "preview_changes"
  | "send_updated_version"
  | "view"
  | "download"
  | "delete"
  | "cancel"
  | "archive";

export type DocumentLifecycleReasonCode =
  | "creator_price_changed"
  | "deliverables_changed"
  | "payment_terms_changed"
  | "campaign_budget_changed"
  | "creator_removed"
  | "creator_replaced"
  | "campaign_cancelled"
  | "manual_revision"
  | "commercial_correction"
  | "document_superseded"
  | "document_cancelled"
  | "resent"
  | "accepted"
  | "rejected"
  | "generated"
  | "sent"
  | "delivered_manually"
  | "other";

export type DocumentLifecycleSnapshot = {
  documentType: EnterpriseDocumentType;
  id: string;
  /** Persisted workflow status string from the document table. */
  status: string;
  isSuperseded?: boolean;
  deliveryMethod?: string | null;
  deliveryStatus?: string | null;
  sentAt?: string | null;
  approvedAt?: string | null;
  viewedAt?: string | null;
  attachmentUrl?: string | null;
  lifecycleReasonCode?: string | null;
  lifecycleReasonDetail?: string | null;
  /** Optional commercial context for AI-ready recommendations. */
  amount?: number | null;
  currencyCode?: string | null;
};

export type ResolvedDocumentLifecycle = {
  documentType: EnterpriseDocumentType;
  documentId: string;
  /** Presentation state for headers. */
  lifecycleState: DocumentLifecycleState;
  /** Persisted status (may differ from presentation, e.g. delivered_manually). */
  persistedStatus: string;
  reasonCode: DocumentLifecycleReasonCode | null;
  reasonDetail: string | null;
  availableActions: DocumentLifecycleAction[];
  /** Actions that exist in the matrix but are disabled for this snapshot. */
  disabledActions: DocumentLifecycleAction[];
  labels: {
    state: string;
    reason: string | null;
  };
  /** Bulk runner: skip mutating actions with this reason when invalid. */
  bulkSkipReason: string | null;
  /** AI-ready (not executed): structured hints for future automation. */
  aiHints: DocumentLifecycleAiHints;
};

export type DocumentLifecycleAiHints = {
  outdated: boolean;
  recommendRegenerate: boolean;
  recommendBulkRegenerate: boolean;
  detectionSummary: string | null;
  estimatedImpact: {
    amountDelta: number | null;
    currencyCode: string | null;
    note: string | null;
  } | null;
  affectedDocumentTypes: EnterpriseDocumentType[];
};

export type BusinessChangeEventType =
  | "creator_price_updated"
  | "deliverables_changed"
  | "payment_terms_changed"
  | "campaign_budget_changed"
  | "creator_removed"
  | "creator_replaced"
  | "campaign_cancelled"
  | "manual_mark_revision_required";

export type PlannedDocumentReaction = {
  documentType: EnterpriseDocumentType;
  documentId: string;
  fromStatus: string | null;
  toStatus: string;
  reasonCode: DocumentLifecycleReasonCode;
  reasonDetail: string;
  recommendedActions: DocumentLifecycleAction[];
  aiContext?: Record<string, unknown>;
};
