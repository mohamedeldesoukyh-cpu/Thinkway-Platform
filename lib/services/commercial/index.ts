/**
 * Commercial SSOT public facade.
 * All Quotation ↔ Campaign commercial synchronization must go through
 * CommercialSynchronizationService (see docs/architecture/COMMERCIAL_SSOT_QUOTE_CAMPAIGN.md).
 */

export {
  asCommercialLineId,
  assertOriginPreserved,
  assignmentBelongsToCommercialLine,
  buildRegistryEntry,
  indexAssignmentsByCommercialLineId,
  originCommercialLineId,
} from "./commercial-line-identity";

export {
  createSupabaseAuditWriter,
  writeCommercialSyncAudit,
} from "./commercial-audit";
export type { CommercialAuditEvent } from "./commercial-audit";

export {
  COMMERCIAL_SYNC_CONFIRMATION_REQUIRED,
  commercialSyncConfirmationCopy,
  financeLockConfirmationCopy,
} from "./confirmation-copy";

export {
  applyCampaignMasterSyncIfLinked,
  applyQuotationMasterSyncIfLinked,
} from "./linked-commercial-gate";

export {
  probeCommercialLinkByAssignment,
  probeCommercialLinkByQuotationItem,
} from "./probe-commercial-link";

export { createSupabaseCommercialSyncPorts } from "./supabase-ports";

export {
  ABSOLUTE_MASTER_KEYS,
  RATE_MASTER_KEYS,
  allocateMasterAcrossAssignments,
  assertOnlyMasterChanges,
  diffMasterChanges,
  fromCampaignRow,
  fromQuotationRow,
  getFieldLevel,
  getMasterFieldMap,
  isDerivedFieldKey,
  isMasterFieldKey,
  isOperationalFieldKey,
  listDerivedFields,
  listMasterFields,
  listOperationalFields,
  masterFieldLabel,
  resolveDerivedRecalcPlan,
  toCampaignColumns,
  toQuotationColumns,
  valuesEqual,
} from "./field-registry";

export {
  Campaign,
  formatFinanceLockReasons,
  isCampaignFinanceLocked,
} from "@/lib/finance/campaign-finance-lock";

export {
  CommercialSynchronizationService,
  createCommercialSynchronizationService,
  financeLockStub,
  pickRateMasterChanges,
} from "./commercial-synchronization-service";

export {
  CommercialRevisionService,
  buildRevisionLinesFromProposals,
  createCommercialRevisionService,
  createInMemoryRevisionPorts,
  createInMemoryRevisionStore,
} from "./commercial-revision-service";

export { createSupabaseRevisionPorts } from "./commercial-revision-supabase-ports";

export type {
  CommercialRevisionLineInput,
  CommercialRevisionRecord,
  CommercialRevisionResult,
  CommercialRevisionStatus,
  CommercialVersionHistoryEntry,
  CreateCommercialRevisionInput,
} from "./commercial-revision-types";

export type { CommercialRevisionPorts } from "./commercial-revision-ports";

export type {
  ApplyMasterChangeInput,
  ApplyMasterChangeResult,
  CommercialAuditEntry,
  CommercialDerivedFieldKey,
  CommercialDocumentSide,
  CommercialFieldLevel,
  CommercialLineId,
  CommercialLineRegistryEntry,
  CommercialMasterFieldKey,
  CommercialOperationalFieldKey,
  CommercialSyncLinkProbe,
  CommercialSyncPorts,
  CommercialSyncResultStatus,
  CommercialSyncSource,
  FinanceLockResult,
  MasterCommercialValues,
  MasterFieldChange,
} from "./types";
