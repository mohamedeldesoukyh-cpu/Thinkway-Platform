/**
 * Platform Bulk Operations Framework
 *
 * Official shared capability for operational registers:
 * Assignments · Client IO · Vendor IO · Deliverables · Publications ·
 * Performance · Workflow · Finance · Timeline
 *
 * Domain modules must NOT invent independent bulk runners.
 * See docs/architecture/PLATFORM_BULK_OPERATIONS_FRAMEWORK.md
 */

export {
  formatBulkOperationSummary,
  runBulkOperation,
  type BulkItemResult,
  type BulkMutateFn,
  type BulkOperationProgress,
  type BulkOperationSummary,
  type RunBulkOperationInput,
} from "@/components/workspace/bulk-operations/run-bulk-operation";

export {
  reportBulkProgress,
  reportBulkSummary,
} from "@/components/workspace/bulk-operations/bulk-operation-feedback";

export { usePlatformBulkOperation } from "@/components/workspace/bulk-operations/use-platform-bulk-operation";

export {
  appendBulkDeferRevalidate,
  BULK_DEFER_REVALIDATE_FIELD,
  formDataDefersRevalidate,
} from "@/components/workspace/bulk-operations/bulk-defer-revalidate";

export {
  beginBulkRefreshLock,
  endBulkRefreshLock,
  isBulkRefreshLocked,
  subscribeBulkRefreshLock,
} from "@/components/workspace/bulk-operations/bulk-refresh-gate";