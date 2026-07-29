/**
 * In-memory CommercialSyncPorts for unit / regression tests.
 */

import { buildRegistryEntry } from "./commercial-line-identity";
import { financeLockStub } from "./commercial-synchronization-service";
import type {
  ApplyMasterChangeResult,
  CommercialAuditEntry,
  CommercialLineId,
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
  concurrencyTokens: Map<CommercialLineId, string>;
  idempotentResults: Map<
    string,
    Extract<ApplyMasterChangeResult, { ok: true }>
  >;
  idempotentInFlight: Set<string>;
  /** When set, writeAssignmentMaster throws after N successful writes in a txn. */
  failAssignmentWriteAfter?: number;
  assignmentWritesInTxn: number;
};

export function createInMemoryCommercialStore(): InMemoryCommercialStore {
  return {
    quotationItems: new Map(),
    assignments: new Map(),
    audits: [],
    quotationRecalc: [],
    campaignRecalc: [],
    financeLock: { locked: false, reasons: [] },
    concurrencyTokens: new Map(),
    idempotentResults: new Map(),
    idempotentInFlight: new Set(),
    assignmentWritesInTxn: 0,
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

  const cloneStore = () => ({
    quotationItems: new Map(
      [...store.quotationItems.entries()].map(([k, v]) => [
        k,
        { quotationId: v.quotationId, values: { ...v.values } },
      ])
    ),
    assignments: new Map(
      [...store.assignments.entries()].map(([k, v]) => [
        k,
        {
          campaignHeaderId: v.campaignHeaderId,
          sourceQuotationItemId: v.sourceQuotationItemId,
          values: { ...v.values },
        },
      ])
    ),
    quotationRecalc: [...store.quotationRecalc],
    campaignRecalc: [...store.campaignRecalc],
    concurrencyTokens: new Map(store.concurrencyTokens),
  });

  const restore = (snap: ReturnType<typeof cloneStore>) => {
    store.quotationItems = snap.quotationItems;
    store.assignments = snap.assignments;
    store.quotationRecalc = snap.quotationRecalc;
    store.campaignRecalc = snap.campaignRecalc;
    store.concurrencyTokens = snap.concurrencyTokens;
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
      store.assignmentWritesInTxn += 1;
      if (
        store.failAssignmentWriteAfter != null &&
        store.assignmentWritesInTxn > store.failAssignmentWriteAfter
      ) {
        throw new Error("Simulated assignment write failure");
      }
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
    runInTransaction: async (work) => {
      const snap = cloneStore();
      store.assignmentWritesInTxn = 0;
      try {
        return await work();
      } catch (error) {
        restore(snap);
        throw error;
      }
    },
    loadConcurrencyToken: async (commercialLineId) =>
      store.concurrencyTokens.get(commercialLineId) ?? null,
    storeConcurrencyToken: async (commercialLineId, token) => {
      store.concurrencyTokens.set(commercialLineId, token);
    },
    getIdempotentResult: async (key) => store.idempotentResults.get(key) ?? null,
    putIdempotentResult: async (key, result) => {
      store.idempotentResults.set(key, result);
    },
    tryBeginIdempotent: async (key) => {
      if (store.idempotentInFlight.has(key)) return false;
      store.idempotentInFlight.add(key);
      return true;
    },
    endIdempotent: async (key) => {
      store.idempotentInFlight.delete(key);
    },
  };
}
