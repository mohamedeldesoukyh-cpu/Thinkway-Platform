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
  ABSOLUTE_MASTER_KEYS,
  RATE_MASTER_KEYS,
  allocateMasterAcrossAssignments,
  assertOnlyMasterChanges,
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
  toCampaignColumns,
  toQuotationColumns,
} from "./field-registry";

export {
  CommercialSynchronizationService,
  createCommercialSynchronizationService,
  financeLockStub,
} from "./commercial-synchronization-service";

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
  CommercialSyncPorts,
  CommercialSyncSource,
  FinanceLockResult,
  MasterCommercialValues,
} from "./types";
