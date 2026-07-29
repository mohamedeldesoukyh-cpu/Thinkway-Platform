/**
 * In-memory CommercialSyncPorts for unit tests (Phase 1).
 */

import { buildRegistryEntry } from "./commercial-line-identity";
import { financeLockStub } from "./commercial-synchronization-service";
import type {
  CommercialAuditEntry,
  CommercialLineRegistryEntry,
  CommercialSyncPorts,
  FinanceLockResult,
  MasterCommercialValues,
} from "./types";

export type InMemoryCommercialStore = {
  quotationItems: Map<
    string,
    { quotationId: string; values: MasterCommercialValues }
  >;
  assignments: Map<
    string,
    {
      campaignHeaderId: string;
      sourceQuotationItemId: string | null;
      values: MasterCommercialValues;
    }
  >;
  audits: CommercialAuditEntry[];
  quotationRecalc: string[];
  campaignRecalc: string[];
  financeLock: FinanceLockResult;
};

export function createInMemoryCommercialStore(): InMemoryCommercialStore {
  return {
    quotationItems: new Map(),
    assignments: new Map(),
    audits: [],
    quotationRecalc: [],
    campaignRecalc: [],
    financeLock: { locked: false, reasons: [] },
  };
}

export function seedQuotationItem(
  store: InMemoryCommercialStore,
  input: {
    quotationItemId: string;
    quotationId: string;
    values?: MasterCommercialValues;
  }
) {
  store.quotationItems.set(input.quotationItemId, {
    quotationId: input.quotationId,
    values: { ...(input.values ?? {}) },
  });
}

export function seedAssignment(
  store: InMemoryCommercialStore,
  input: {
    assignmentId: string;
    campaignHeaderId: string;
    sourceQuotationItemId: string | null;
    values?: MasterCommercialValues;
  }
) {
  store.assignments.set(input.assignmentId, {
    campaignHeaderId: input.campaignHeaderId,
    sourceQuotationItemId: input.sourceQuotationItemId,
    values: { ...(input.values ?? {}) },
  });
}

export function createInMemoryCommercialSyncPorts(
  store: InMemoryCommercialStore
): CommercialSyncPorts {
  const resolveFromItem = (
    quotationItemId: string
  ): CommercialLineRegistryEntry | null => {
    const item = store.quotationItems.get(quotationItemId);
    if (!item) return null;
    const assignments = [...store.assignments.entries()]
      .filter(([, a]) => a.sourceQuotationItemId === quotationItemId)
      .map(([id, a]) => ({
        id,
        source_quotation_item_id: a.sourceQuotationItemId,
        campaign_header_id: a.campaignHeaderId,
      }));
    return buildRegistryEntry({
      quotationId: item.quotationId,
      quotationItemId,
      assignments,
    });
  };

  return {
    resolveByCommercialLineId: async (id) => resolveFromItem(id),
    resolveByQuotationItemId: async (id) => resolveFromItem(id),
    resolveByAssignmentId: async (assignmentId) => {
      const assignment = store.assignments.get(assignmentId);
      if (!assignment?.sourceQuotationItemId) return null;
      return resolveFromItem(assignment.sourceQuotationItemId);
    },
    loadQuotationMaster: async (quotationItemId) => {
      const item = store.quotationItems.get(quotationItemId);
      return item ? { ...item.values } : null;
    },
    loadAssignmentMaster: async (assignmentId) => {
      const row = store.assignments.get(assignmentId);
      return row ? { ...row.values } : null;
    },
    writeQuotationMaster: async (quotationItemId, values) => {
      const item = store.quotationItems.get(quotationItemId);
      if (!item) throw new Error(`Unknown quotation item ${quotationItemId}`);
      item.values = { ...item.values, ...values };
    },
    writeAssignmentMaster: async (assignmentId, values) => {
      const row = store.assignments.get(assignmentId);
      if (!row) throw new Error(`Unknown assignment ${assignmentId}`);
      row.values = { ...row.values, ...values };
    },
    recalculateQuotationDerived: async (quotationId) => {
      store.quotationRecalc.push(quotationId);
    },
    recalculateCampaignDerived: async (campaignHeaderId) => {
      store.campaignRecalc.push(campaignHeaderId);
    },
    isFinanceLocked: async (campaignHeaderId) => {
      if (store.financeLock.locked) return store.financeLock;
      return financeLockStub(campaignHeaderId);
    },
    writeAudit: async (entry) => {
      store.audits.push(entry);
    },
  };
}
