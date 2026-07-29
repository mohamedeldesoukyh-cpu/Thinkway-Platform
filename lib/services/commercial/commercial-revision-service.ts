/**
 * Commercial Revision workflow — Phase 4.
 * Only path to change Master commercials after Finance Lock.
 *
 * Spec: docs/architecture/COMMERCIAL_SSOT_QUOTE_CAMPAIGN.md §8
 */

import type { CommercialRevisionPorts } from "./commercial-revision-ports";
import type {
  CommercialRevisionLineInput,
  CommercialRevisionRecord,
  CommercialRevisionResult,
  CommercialVersionHistoryEntry,
  CreateCommercialRevisionInput,
} from "./commercial-revision-types";
import { createCommercialSynchronizationService } from "./commercial-synchronization-service";
import { assertOnlyMasterChanges, diffMasterChanges } from "./field-registry";
import type { CommercialSyncPorts, MasterCommercialValues } from "./types";

export type { CommercialRevisionPorts } from "./commercial-revision-ports";

export function createInMemoryRevisionPorts(
  overrides?: Partial<CommercialRevisionPorts> & {
    revisions?: Map<string, CommercialRevisionRecord>;
    snapshots?: CommercialVersionHistoryEntry[];
  }
): CommercialRevisionPorts {
  const revisions = overrides?.revisions ?? new Map<string, CommercialRevisionRecord>();
  const snapshots = overrides?.snapshots ?? [];

  const ports: CommercialRevisionPorts = {
    financeLocked: async () => ({ locked: true, reasons: ["vendor_io"] }),
    lineExists: async () => true,
    canDecide: async () => true,
    loadConcurrencyToken: async () => "token-v1",
    getRevision: async (id) => {
      const rev = revisions.get(id);
      return rev ? structuredClone(rev) : null;
    },
    saveRevision: async (record) => {
      revisions.set(record.id, structuredClone(record));
    },
    listRevisions: async (campaignHeaderId) =>
      [...revisions.values()]
        .filter((r) => r.campaignHeaderId === campaignHeaderId)
        .sort((a, b) => b.revisionNumber - a.revisionNumber)
        .map((r) => structuredClone(r)),
    findPendingRevision: async (campaignHeaderId) => {
      const pending = [...revisions.values()].find(
        (r) =>
          r.campaignHeaderId === campaignHeaderId &&
          r.status === "pending_approval"
      );
      return pending ? structuredClone(pending) : null;
    },
    nextRevisionNumber: async (campaignHeaderId) => {
      let max = 0;
      for (const rev of revisions.values()) {
        if (rev.campaignHeaderId === campaignHeaderId) {
          max = Math.max(max, rev.revisionNumber);
        }
      }
      return max + 1;
    },
    nextCommercialVersion: async (campaignHeaderId) => {
      let max = 0;
      for (const snap of snapshots) {
        if (snap.campaignHeaderId === campaignHeaderId) {
          max = Math.max(max, snap.versionNumber);
        }
      }
      return max > 0 ? max + 1 : 2;
    },
    appendVersionHistory: async (entry) => {
      snapshots.push(structuredClone(entry));
    },
    listVersionHistory: async (campaignHeaderId) =>
      snapshots
        .filter((s) => s.campaignHeaderId === campaignHeaderId)
        .sort((a, b) => b.versionNumber - a.versionNumber)
        .map((s) => structuredClone(s)),
    ...overrides,
  };

  // Keep map/array references when overrides replace methods but tests seed maps.
  ports.getRevision = async (id) => {
    const rev = revisions.get(id);
    return rev ? structuredClone(rev) : null;
  };
  ports.saveRevision = async (record) => {
    revisions.set(record.id, structuredClone(record));
  };
  ports.listRevisions = async (campaignHeaderId) =>
    [...revisions.values()]
      .filter((r) => r.campaignHeaderId === campaignHeaderId)
      .sort((a, b) => b.revisionNumber - a.revisionNumber)
      .map((r) => structuredClone(r));
  ports.findPendingRevision = async (campaignHeaderId) => {
    const pending = [...revisions.values()].find(
      (r) =>
        r.campaignHeaderId === campaignHeaderId &&
        r.status === "pending_approval"
    );
    return pending ? structuredClone(pending) : null;
  };
  ports.nextRevisionNumber = async (campaignHeaderId) => {
    let max = 0;
    for (const rev of revisions.values()) {
      if (rev.campaignHeaderId === campaignHeaderId) {
        max = Math.max(max, rev.revisionNumber);
      }
    }
    return max + 1;
  };
  ports.nextCommercialVersion = async (campaignHeaderId) => {
    let max = 0;
    for (const snap of snapshots) {
      if (snap.campaignHeaderId === campaignHeaderId) {
        max = Math.max(max, snap.versionNumber);
      }
    }
    return max > 0 ? max + 1 : 2;
  };
  ports.appendVersionHistory = async (entry) => {
    snapshots.push(structuredClone(entry));
  };
  ports.listVersionHistory = async (campaignHeaderId) =>
    snapshots
      .filter((s) => s.campaignHeaderId === campaignHeaderId)
      .sort((a, b) => b.versionNumber - a.versionNumber)
      .map((s) => structuredClone(s));

  if (overrides?.financeLocked) ports.financeLocked = overrides.financeLocked;
  if (overrides?.lineExists) ports.lineExists = overrides.lineExists;
  if (overrides?.canDecide) ports.canDecide = overrides.canDecide;
  if (overrides?.loadConcurrencyToken) {
    ports.loadConcurrencyToken = overrides.loadConcurrencyToken;
  }

  return ports;
}

/** @deprecated alias */
export const createInMemoryRevisionStore = createInMemoryRevisionPorts;

export class CommercialRevisionService {
  constructor(
    private readonly ports: CommercialRevisionPorts,
    private readonly syncPorts: CommercialSyncPorts
  ) {}

  async createRevision(
    input: CreateCommercialRevisionInput
  ): Promise<CommercialRevisionResult<CommercialRevisionRecord>> {
    const reason = input.reason?.trim();
    if (!reason) {
      return { ok: false, code: "VALIDATION", message: "Reason is required" };
    }
    if (!input.lines.length) {
      return {
        ok: false,
        code: "VALIDATION",
        message: "At least one Commercial Line change is required",
      };
    }

    const lock = await this.ports.financeLocked(input.campaignHeaderId);
    if (!lock.locked) {
      return {
        ok: false,
        code: "FINANCE_NOT_LOCKED",
        message:
          "Commercial Revision is only required after Finance Lock. Use direct synchronized editing while unlocked.",
      };
    }

    const lines: CommercialRevisionLineInput[] = [];
    for (const line of input.lines) {
      const exists = await this.ports.lineExists(line.commercialLineId);
      if (!exists) {
        return {
          ok: false,
          code: "LINE_MISSING",
          message: `Commercial Line ${line.commercialLineId} no longer exists`,
        };
      }
      const masterCheck = assertOnlyMasterChanges(line.newValues);
      if (!masterCheck.ok) {
        return {
          ok: false,
          code: "VALIDATION",
          message: `Non-master fields rejected: ${masterCheck.rejectedFields.join(", ")}`,
        };
      }
      const { dirty, fieldChanges } = diffMasterChanges(
        line.oldValues,
        line.newValues
      );
      if (Object.keys(dirty).length === 0) {
        return {
          ok: false,
          code: "VALIDATION",
          message: `No dirty Master changes for Commercial Line ${line.commercialLineId}`,
        };
      }
      lines.push({
        ...line,
        newValues: dirty,
        changedFields: fieldChanges.map((c) => c.field),
        fieldChanges,
      });
    }

    const revisionNumber = await this.ports.nextRevisionNumber(
      input.campaignHeaderId
    );
    const id = cryptoRandomId();
    const now = new Date().toISOString();
    const record: CommercialRevisionRecord = {
      id,
      campaignHeaderId: input.campaignHeaderId,
      quotationId: input.quotationId,
      revisionNumber,
      commercialVersionNumber: null,
      status: "draft",
      reason,
      comments: input.comments?.trim() || null,
      createdBy: input.actorId,
      createdAt: now,
      submittedAt: null,
      approvedBy: null,
      approvedAt: null,
      rejectedBy: null,
      rejectedAt: null,
      decisionNotes: null,
      appliedAt: null,
      concurrencyTokens: { ...(input.concurrencyTokens ?? {}) },
      lines,
    };
    await this.ports.saveRevision(record);
    return { ok: true, data: structuredClone(record) };
  }

  async submitRevision(
    revisionId: string,
    actorId: string
  ): Promise<CommercialRevisionResult<CommercialRevisionRecord>> {
    const rev = await this.ports.getRevision(revisionId);
    if (!rev) return { ok: false, code: "NOT_FOUND", message: "Revision not found" };
    if (rev.status !== "draft") {
      return {
        ok: false,
        code: "INVALID_STATUS",
        message: `Cannot submit revision in status ${rev.status}`,
      };
    }

    const pending = await this.ports.findPendingRevision(rev.campaignHeaderId);
    if (pending && pending.id !== rev.id) {
      return {
        ok: false,
        code: "PENDING_EXISTS",
        message:
          "Another Commercial Revision is already pending approval for this Campaign",
      };
    }

    rev.status = "pending_approval";
    rev.submittedAt = new Date().toISOString();
    void actorId;
    await this.ports.saveRevision(rev);
    return { ok: true, data: structuredClone(rev) };
  }

  async rejectRevision(
    revisionId: string,
    actorId: string,
    decisionNotes?: string | null
  ): Promise<CommercialRevisionResult<CommercialRevisionRecord>> {
    const rev = await this.ports.getRevision(revisionId);
    if (!rev) return { ok: false, code: "NOT_FOUND", message: "Revision not found" };
    if (rev.status !== "pending_approval") {
      return {
        ok: false,
        code: "INVALID_STATUS",
        message: `Cannot reject revision in status ${rev.status}`,
      };
    }
    if (!(await this.ports.canDecide(actorId))) {
      return {
        ok: false,
        code: "PERMISSION",
        message: "Missing approval decide permission",
      };
    }
    rev.status = "rejected";
    rev.rejectedBy = actorId;
    rev.rejectedAt = new Date().toISOString();
    rev.decisionNotes = decisionNotes?.trim() || null;
    await this.ports.saveRevision(rev);
    return { ok: true, data: structuredClone(rev) };
  }

  async cancelRevision(
    revisionId: string,
    _actorId: string
  ): Promise<CommercialRevisionResult<CommercialRevisionRecord>> {
    const rev = await this.ports.getRevision(revisionId);
    if (!rev) return { ok: false, code: "NOT_FOUND", message: "Revision not found" };
    if (rev.status !== "draft" && rev.status !== "pending_approval") {
      return {
        ok: false,
        code: "INVALID_STATUS",
        message: `Cannot cancel revision in status ${rev.status}`,
      };
    }
    rev.status = "cancelled";
    await this.ports.saveRevision(rev);
    return { ok: true, data: structuredClone(rev) };
  }

  async approveAndApplyRevision(
    revisionId: string,
    actorId: string,
    decisionNotes?: string | null
  ): Promise<
    CommercialRevisionResult<{
      revision: CommercialRevisionRecord;
      version: CommercialVersionHistoryEntry;
    }>
  > {
    let rev = await this.ports.getRevision(revisionId);
    if (!rev) return { ok: false, code: "NOT_FOUND", message: "Revision not found" };

    if (rev.status === "draft") {
      const submitted = await this.submitRevision(revisionId, actorId);
      if (!submitted.ok) return submitted;
      rev = submitted.data;
    }

    if (rev.status !== "pending_approval") {
      return {
        ok: false,
        code: "INVALID_STATUS",
        message: `Cannot approve revision in status ${rev.status}`,
      };
    }
    if (!(await this.ports.canDecide(actorId))) {
      return {
        ok: false,
        code: "PERMISSION",
        message: "Missing approval decide permission",
      };
    }

    const lock = await this.ports.financeLocked(rev.campaignHeaderId);
    if (!lock.locked) {
      return {
        ok: false,
        code: "FINANCE_NOT_LOCKED",
        message: "Finance Lock is no longer active; cancel this revision",
      };
    }

    for (const line of rev.lines) {
      if (!(await this.ports.lineExists(line.commercialLineId))) {
        return {
          ok: false,
          code: "LINE_MISSING",
          message: `Commercial Line ${line.commercialLineId} no longer exists`,
        };
      }
      const expected = rev.concurrencyTokens[line.commercialLineId];
      if (expected) {
        const current = await this.ports.loadConcurrencyToken(
          line.commercialLineId
        );
        if (current != null && current !== expected) {
          return {
            ok: false,
            code: "CONCURRENCY_CONFLICT",
            message: `Commercial Line ${line.commercialLineId} changed concurrently`,
          };
        }
      }
    }

    rev.status = "approved";
    rev.approvedBy = actorId;
    rev.approvedAt = new Date().toISOString();
    rev.decisionNotes = decisionNotes?.trim() || null;
    await this.ports.saveRevision(rev);

    const apply = await this.applyRevision(revisionId, actorId);
    if (!apply.ok) {
      const rollback = await this.ports.getRevision(revisionId);
      if (rollback) {
        rollback.status = "pending_approval";
        rollback.approvedBy = null;
        rollback.approvedAt = null;
        await this.ports.saveRevision(rollback);
      }
      return apply;
    }

    return {
      ok: true,
      data: { revision: apply.data.revision, version: apply.data.version },
    };
  }

  async applyRevision(
    revisionId: string,
    actorId: string
  ): Promise<
    CommercialRevisionResult<{
      revision: CommercialRevisionRecord;
      version: CommercialVersionHistoryEntry;
    }>
  > {
    const rev = await this.ports.getRevision(revisionId);
    if (!rev) return { ok: false, code: "NOT_FOUND", message: "Revision not found" };
    if (rev.status !== "approved") {
      return {
        ok: false,
        code: "INVALID_STATUS",
        message: "Only approved revisions may be applied",
      };
    }

    const sync = createCommercialSynchronizationService(this.syncPorts);
    const allFieldChanges = [];

    try {
      for (const line of rev.lines) {
        const result = await sync.applyMasterChange({
          actorId,
          confirmed: true,
          source: {
            side: "quotation",
            quotationItemId: line.commercialLineId,
          },
          changes: line.newValues,
          reason: rev.reason,
          expectedConcurrencyToken:
            rev.concurrencyTokens[line.commercialLineId] ?? null,
          approvedRevision: {
            revisionId: rev.id,
            revisionNumber: rev.revisionNumber,
          },
          idempotencyKey: `commercial-revision:${rev.id}:${line.commercialLineId}`,
        });
        if (!result.ok) {
          return {
            ok: false,
            code: "APPLY_FAILED",
            message: result.message,
          };
        }
        allFieldChanges.push(...result.fieldChanges);
      }
    } catch (error) {
      return {
        ok: false,
        code: "APPLY_FAILED",
        message:
          error instanceof Error ? error.message : "Failed to apply revision",
      };
    }

    const versionNumber = await this.ports.nextCommercialVersion(
      rev.campaignHeaderId
    );
    rev.commercialVersionNumber = versionNumber;
    rev.status = "applied";
    rev.appliedAt = new Date().toISOString();
    await this.ports.saveRevision(rev);

    const version: CommercialVersionHistoryEntry = {
      versionNumber,
      revisionNumber: rev.revisionNumber,
      revisionId: rev.id,
      campaignHeaderId: rev.campaignHeaderId,
      createdBy: rev.createdBy,
      approvedBy: rev.approvedBy,
      date: rev.appliedAt,
      reason: rev.reason,
      fieldChangeSummary: allFieldChanges,
      snapshotId: `snap-${rev.campaignHeaderId}-v${versionNumber}`,
    };
    await this.ports.appendVersionHistory(version);

    return {
      ok: true,
      data: { revision: structuredClone(rev), version },
    };
  }

  async listRevisions(
    campaignHeaderId: string
  ): Promise<CommercialRevisionRecord[]> {
    return this.ports.listRevisions(campaignHeaderId);
  }

  async getRevision(
    revisionId: string
  ): Promise<CommercialRevisionRecord | null> {
    return this.ports.getRevision(revisionId);
  }

  async listVersionHistory(
    campaignHeaderId: string
  ): Promise<CommercialVersionHistoryEntry[]> {
    return this.ports.listVersionHistory(campaignHeaderId);
  }
}

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `rev-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function buildRevisionLinesFromProposals(
  proposals: Array<{
    commercialLineId: string;
    assignmentIds?: string[];
    current: MasterCommercialValues;
    proposed: MasterCommercialValues;
  }>
): CommercialRevisionLineInput[] {
  return proposals.map((p) => {
    const { dirty, fieldChanges } = diffMasterChanges(p.current, p.proposed);
    return {
      commercialLineId: p.commercialLineId,
      assignmentIds: p.assignmentIds ?? [],
      oldValues: p.current,
      newValues: dirty,
      changedFields: fieldChanges.map((c) => c.field),
      fieldChanges,
    };
  });
}

export function createCommercialRevisionService(
  ports: CommercialRevisionPorts,
  syncPorts: CommercialSyncPorts
): CommercialRevisionService {
  return new CommercialRevisionService(ports, syncPorts);
}
