/**
 * Enterprise Document Lifecycle Engine
 *
 * Canonical module for document state → available actions, reason codes,
 * business change events, and AI-ready regeneration hints.
 *
 * Docs: docs/architecture/ENTERPRISE_DOCUMENT_LIFECYCLE.md
 */

export * from "@/lib/document-lifecycle/types";
export * from "@/lib/document-lifecycle/reason-codes";
export * from "@/lib/document-lifecycle/labels";
export {
  resolveDocumentLifecycle,
  documentAllowsAction,
} from "@/lib/document-lifecycle/resolve";
export {
  resolveVendorIoLifecycle,
  resolveVendorIoLifecycleState,
  vendorIoAllowsAction,
  vendorIoBulkSkipReason,
  isVendorIoIssued,
} from "@/lib/document-lifecycle/policies/vendor-io";
export {
  resolveClientIoLifecycle,
  clientIoAllowsAction,
} from "@/lib/document-lifecycle/policies/client-io";
export { vendorIoRowToLifecycleSnapshot } from "@/lib/document-lifecycle/adapters/vendor-io";
export {
  emitBusinessChangeEvent,
  planDocumentLifecycleReactions,
  applyDocumentLifecycleReactions,
  type EmitBusinessChangeInput,
  type EmitBusinessChangeResult,
} from "@/lib/document-lifecycle/business-change/emit";

/** Prefer Change Impact Engine for business changes — see `@/lib/change-impact`. */
