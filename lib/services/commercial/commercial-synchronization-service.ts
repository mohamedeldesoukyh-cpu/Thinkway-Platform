/**
 * CommercialSynchronizationService — sole orchestration point for
 * Quotation ↔ Campaign Master commercial synchronization.
 *
 * Spec: docs/architecture/COMMERCIAL_SSOT_QUOTE_CAMPAIGN.md §5–§6
 *
 * Sync is registry-driven: new Master fields require Field Registry updates only.
 * Writes only dirty Master fields; audit is field-level; Derived recalc is dependency-driven.
 */

import type { FinanceLockResult } from "@/lib/finance/campaign-finance-lock";

import {
  allocateMasterAcrossAssignments,
  assertOnlyMasterChanges,
  diffMasterChanges,
  RATE_MASTER_KEYS,
  resolveDerivedRecalcPlan,
} from "./field-registry";
import type {
  ApplyMasterChangeInput,
  ApplyMasterChangeResult,
  CommercialAuditEntry,
  CommercialMasterFieldKey,
  CommercialSyncPorts,
  MasterCommercialValues,
  MasterFieldChange,
} from "./types";

/**
 * @deprecated Phase 3 — use `Campaign.isFinanceLocked` /
 * `isCampaignFinanceLocked` from `@/lib/finance/campaign-finance-lock`.
 */
export async function financeLockStub(
  _campaignHeaderId: string
): Promise<FinanceLockResult> {
  return { locked: false, reasons: [] };
}

export class CommercialSynchronizationService {
  constructor(private readonly ports: CommercialSyncPorts) {}

  /**
   * Apply Master commercial changes from Quotation or Campaign and sync peers
   * by immutable Commercial Line ID.
   *
   * Re-entrancy safe: does not call itself; peers are written through ports only.
   */
  async applyMasterChange(
    input: ApplyMasterChangeInput
  ): Promise<ApplyMasterChangeResult> {
    const occurredAt = new Date().toISOString();

    if (!input.confirmed) {
      await this.audit({
        event: "commercial.sync_not_confirmed",
        actorId: input.actorId,
        commercialLineId: null,
        quotationId: null,
        campaignHeaderId: null,
        assignmentIds: [],
        sourceSide: input.source.side,
        occurredAt,
        result: "not_confirmed",
        oldData: null,
        newData: { changes: input.changes },
      });
      return {
        ok: false,
        code: "NOT_CONFIRMED",
        message:
          "Commercial synchronization requires explicit confirmation before writing both documents",
      };
    }

    const changeKeys = Object.keys(input.changes).filter(
      (k) => input.changes[k as keyof MasterCommercialValues] !== undefined
    );
    if (changeKeys.length === 0) {
      return {
        ok: false,
        code: "EMPTY_CHANGES",
        message: "No Master commercial changes provided",
      };
    }

    const masterCheck = assertOnlyMasterChanges(input.changes);
    if (!masterCheck.ok) {
      await this.audit({
        event: "commercial.sync_rejected",
        actorId: input.actorId,
        commercialLineId: null,
        quotationId: null,
        campaignHeaderId: null,
        assignmentIds: [],
        sourceSide: input.source.side,
        occurredAt,
        result: "rejected",
        oldData: null,
        newData: { changes: input.changes },
        metadata: {
          reason: "non_master_field",
          rejected_fields: masterCheck.rejectedFields,
        },
      });
      return {
        ok: false,
        code: "NON_MASTER_FIELD",
        message:
          "Only Master Commercial Fields may be synchronized; Derived and Operational fields are rejected",
        rejectedFields: masterCheck.rejectedFields,
      };
    }

    const idempotencyKey = input.idempotencyKey?.trim() || null;
    if (idempotencyKey) {
      const prior = await this.ports.getIdempotentResult(idempotencyKey);
      if (prior) {
        return { ...prior, duplicate: true };
      }
      const began = await this.ports.tryBeginIdempotent(idempotencyKey);
      if (!began) {
        return {
          ok: false,
          code: "DUPLICATE_IN_FLIGHT",
          message:
            "A commercial synchronization with this request is already in progress",
        };
      }
    }

    try {
      return await this.executeConfirmedChange(input, occurredAt);
    } finally {
      if (idempotencyKey) {
        await this.ports.endIdempotent(idempotencyKey);
      }
    }
  }

  private async executeConfirmedChange(
    input: ApplyMasterChangeInput,
    occurredAt: string
  ): Promise<ApplyMasterChangeResult> {
    const registry =
      input.source.side === "quotation"
        ? await this.ports.resolveByQuotationItemId(input.source.quotationItemId)
        : await this.ports.resolveByAssignmentId(input.source.assignmentId);

    if (!registry) {
      return {
        ok: false,
        code: "UNKNOWN_ORIGIN",
        message:
          "Cannot synchronize: Assignment/Quotation line has no Origin Commercial Line ID mapping",
      };
    }

    const revisionBypass = Boolean(input.approvedRevision?.revisionId);
    if (registry.campaignHeaderId && !revisionBypass) {
      const lock = await this.ports.isFinanceLocked(registry.campaignHeaderId);
      if (lock.locked) {
        await this.audit({
          event: "commercial.sync_blocked_finance_lock",
          actorId: input.actorId,
          commercialLineId: registry.commercialLineId,
          quotationId: registry.quotationId,
          campaignHeaderId: registry.campaignHeaderId,
          assignmentIds: registry.assignmentIds,
          sourceSide: input.source.side,
          occurredAt,
          result: "blocked",
          oldData: null,
          newData: { changes: input.changes },
          metadata: { reasons: lock.reasons },
        });
        return {
          ok: false,
          code: "FINANCE_LOCKED",
          message:
            "This Campaign has already entered the finance process. Commercial values cannot be edited directly. Create a Commercial Revision?",
          financeLock: lock,
        };
      }
    }

    const currentToken = await this.ports.loadConcurrencyToken(
      registry.commercialLineId
    );
    if (
      input.expectedConcurrencyToken != null &&
      input.expectedConcurrencyToken !== "" &&
      currentToken != null &&
      input.expectedConcurrencyToken !== currentToken
    ) {
      await this.audit({
        event: "commercial.sync_conflict",
        actorId: input.actorId,
        commercialLineId: registry.commercialLineId,
        quotationId: registry.quotationId,
        campaignHeaderId: registry.campaignHeaderId,
        assignmentIds: registry.assignmentIds,
        sourceSide: input.source.side,
        occurredAt,
        result: "conflict",
        oldData: null,
        newData: { changes: input.changes },
        metadata: {
          expected: input.expectedConcurrencyToken,
          current: currentToken,
        },
      });
      return {
        ok: false,
        code: "CONCURRENCY_CONFLICT",
        message:
          "Commercial values were updated by another user. Refresh and try again.",
      };
    }

    const previousQuote = await this.ports.loadQuotationMaster(
      registry.quotationItemId
    );

    // Baseline for dirty detection: quote masters (canonical Commercial Line).
    // Campaign 1:N may reconstruct agreement totals before diff.
    let proposedAgreement: MasterCommercialValues = {
      ...(previousQuote ?? {}),
      ...input.changes,
    };

    if (
      input.source.side === "campaign" &&
      registry.assignmentIds.length > 1
    ) {
      proposedAgreement = await this.reconstructAgreementFromCampaignEdit({
        registryAssignmentIds: registry.assignmentIds,
        editedAssignmentId: input.source.assignmentId,
        changes: input.changes,
        previousQuote: previousQuote ?? {},
      });
    }

    const { dirty, fieldChanges } = diffMasterChanges(
      previousQuote ?? {},
      // Only consider keys the caller intended to change (+ reconstructed abs totals)
      proposedAgreementForDiff(input.changes, proposedAgreement, previousQuote ?? {})
    );

    if (fieldChanges.length === 0) {
      return {
        ok: true,
        commercialLineId: registry.commercialLineId,
        quotationId: registry.quotationId,
        campaignHeaderId: registry.campaignHeaderId,
        assignmentIds: registry.assignmentIds,
        applied: {},
        fieldChanges: [],
        allocation: "noop",
        concurrencyToken: currentToken,
        recalculated: false,
      };
    }

    const dirtyKeys = fieldChanges.map((c) => c.field);
    const recalcPlan = resolveDerivedRecalcPlan(dirtyKeys);

    try {
      const result = await this.ports.runInTransaction(async () => {
        // Write ONLY dirty Master fields — never rewrite identical peers.
        await this.ports.writeQuotationMaster(registry.quotationItemId, dirty);

        const shares = allocateMasterAcrossAssignments(
          dirty,
          Math.max(1, registry.assignmentIds.length)
        );

        if (registry.assignmentIds.length === 0) {
          // Quote-only.
        } else if (
          input.source.side === "campaign" &&
          registry.assignmentIds.length > 1
        ) {
          const rateOnly = pickRateMasterChanges(dirty);
          for (const assignmentId of registry.assignmentIds) {
            if (assignmentId === input.source.assignmentId) {
              const assignmentDirty = pickKeys(input.changes, dirtyKeys);
              if (Object.keys(assignmentDirty).length > 0) {
                await this.ports.writeAssignmentMaster(
                  assignmentId,
                  assignmentDirty
                );
              }
            } else if (Object.keys(rateOnly).length > 0) {
              await this.ports.writeAssignmentMaster(assignmentId, rateOnly);
            }
          }
        } else {
          for (let i = 0; i < registry.assignmentIds.length; i++) {
            const share = shares[i] ?? dirty;
            if (Object.keys(share).length > 0) {
              await this.ports.writeAssignmentMaster(
                registry.assignmentIds[i],
                share
              );
            }
          }
        }

        let recalculated = false;
        if (recalcPlan.requiresQuotationTotals) {
          await this.ports.recalculateQuotationDerived(registry.quotationId);
          recalculated = true;
        }
        if (
          recalcPlan.requiresCampaignSummary &&
          registry.campaignHeaderId
        ) {
          await this.ports.recalculateCampaignDerived(registry.campaignHeaderId);
          recalculated = true;
        }

        const nextToken = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        await this.ports.storeConcurrencyToken(
          registry.commercialLineId,
          nextToken
        );

        return {
          ok: true as const,
          commercialLineId: registry.commercialLineId,
          quotationId: registry.quotationId,
          campaignHeaderId: registry.campaignHeaderId,
          assignmentIds: registry.assignmentIds,
          applied: dirty,
          fieldChanges,
          allocation:
            registry.assignmentIds.length <= 1
              ? ("single" as const)
              : input.source.side === "campaign"
                ? ("rates_only" as const)
                : ("equal_split" as const),
          concurrencyToken: nextToken,
          recalculated,
        };
      });

      await this.audit({
        event: "commercial.master_synced",
        actorId: input.actorId,
        commercialLineId: registry.commercialLineId,
        quotationId: registry.quotationId,
        campaignHeaderId: registry.campaignHeaderId,
        assignmentIds: registry.assignmentIds,
        sourceSide: input.source.side,
        occurredAt,
        result: "synced",
        oldData: fieldChangesToOldMap(fieldChanges),
        newData: fieldChangesToNewMap(fieldChanges),
        fieldChanges,
        metadata: {
          allocation: result.allocation,
          reason: input.reason ?? null,
          changed_keys: dirtyKeys,
          user_id: input.actorId,
          recalculated: result.recalculated,
          derived_keys: recalcPlan.derivedKeys,
          commercial_revision_id: input.approvedRevision?.revisionId ?? null,
          commercial_revision_number:
            input.approvedRevision?.revisionNumber ?? null,
        },
      });

      if (input.idempotencyKey?.trim()) {
        await this.ports.putIdempotentResult(input.idempotencyKey.trim(), result);
      }

      return result;
    } catch (error) {
      await this.audit({
        event: "commercial.sync_rolled_back",
        actorId: input.actorId,
        commercialLineId: registry.commercialLineId,
        quotationId: registry.quotationId,
        campaignHeaderId: registry.campaignHeaderId,
        assignmentIds: registry.assignmentIds,
        sourceSide: input.source.side,
        occurredAt: new Date().toISOString(),
        result: "rolled_back",
        oldData: fieldChangesToOldMap(fieldChanges),
        newData: fieldChangesToNewMap(fieldChanges),
        fieldChanges,
        metadata: {
          error: error instanceof Error ? error.message : "unknown",
        },
      });
      return {
        ok: false,
        code: "WRITE_FAILED",
        message:
          error instanceof Error
            ? error.message
            : "Failed to synchronize Master commercials",
      };
    }
  }

  private async audit(entry: CommercialAuditEntry): Promise<void> {
    await this.ports.writeAudit(entry);
  }

  private async reconstructAgreementFromCampaignEdit(input: {
    registryAssignmentIds: string[];
    editedAssignmentId: string;
    changes: MasterCommercialValues;
    previousQuote: MasterCommercialValues;
  }): Promise<MasterCommercialValues> {
    const next: MasterCommercialValues = {
      ...input.previousQuote,
      ...input.changes,
    };

    for (const absKey of [
      "creator_cost",
      "client_revenue",
      "gp_value_input",
      "usage_rights_amount",
      "usage_rights_cost",
    ] as const) {
      if (input.changes[absKey] === undefined) continue;
      let total = 0;
      let sawNumber = false;
      for (const assignmentId of input.registryAssignmentIds) {
        const row =
          assignmentId === input.editedAssignmentId
            ? {
                ...((await this.ports.loadAssignmentMaster(assignmentId)) ?? {}),
                ...input.changes,
              }
            : ((await this.ports.loadAssignmentMaster(assignmentId)) ?? {});
        const raw = row[absKey];
        if (typeof raw === "number" && Number.isFinite(raw)) {
          total += raw;
          sawNumber = true;
        }
      }
      if (sawNumber) next[absKey] = Math.round(total * 100) / 100;
    }

    return next;
  }
}

/** Rate/flag masters only — driven by Field Registry, not hard-coded sync branches. */
export function pickRateMasterChanges(
  changes: MasterCommercialValues
): MasterCommercialValues {
  const out: MasterCommercialValues = {};
  for (const [key, value] of Object.entries(changes) as [
    keyof MasterCommercialValues,
    MasterCommercialValues[keyof MasterCommercialValues],
  ][]) {
    if (value === undefined) continue;
    if (RATE_MASTER_KEYS.has(key)) out[key] = value;
  }
  return out;
}

function pickKeys(
  source: MasterCommercialValues,
  keys: CommercialMasterFieldKey[]
): MasterCommercialValues {
  const out: MasterCommercialValues = {};
  for (const key of keys) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

/**
 * Diff baseline: caller-provided changes, plus reconstructed absolute totals
 * when they differ from the previous quote agreement.
 */
function proposedAgreementForDiff(
  callerChanges: MasterCommercialValues,
  proposedAgreement: MasterCommercialValues,
  previous: MasterCommercialValues
): MasterCommercialValues {
  const proposed: MasterCommercialValues = { ...callerChanges };
  for (const key of Object.keys(proposedAgreement) as CommercialMasterFieldKey[]) {
    if (callerChanges[key] !== undefined) continue;
    // Include reconstructed abs totals that moved vs previous
    if (
      key === "creator_cost" ||
      key === "client_revenue" ||
      key === "gp_value_input" ||
      key === "usage_rights_amount" ||
      key === "usage_rights_cost"
    ) {
      if (proposedAgreement[key] !== previous[key]) {
        proposed[key] = proposedAgreement[key];
      }
    }
  }
  return proposed;
}

function fieldChangesToOldMap(
  changes: MasterFieldChange[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const c of changes) out[c.field] = c.oldValue ?? null;
  return out;
}

function fieldChangesToNewMap(
  changes: MasterFieldChange[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const c of changes) out[c.field] = c.newValue ?? null;
  return out;
}

export function createCommercialSynchronizationService(
  ports: CommercialSyncPorts
): CommercialSynchronizationService {
  return new CommercialSynchronizationService(ports);
}
