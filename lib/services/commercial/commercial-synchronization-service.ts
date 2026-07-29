/**
 * CommercialSynchronizationService — sole orchestration point for
 * Quotation ↔ Campaign Master commercial synchronization.
 *
 * Spec: docs/architecture/COMMERCIAL_SSOT_QUOTE_CAMPAIGN.md §5–§6
 *
 * Sync is registry-driven: new Master fields require Field Registry updates only.
 */

import {
  allocateMasterAcrossAssignments,
  assertOnlyMasterChanges,
  RATE_MASTER_KEYS,
} from "./field-registry";
import type {
  ApplyMasterChangeInput,
  ApplyMasterChangeResult,
  CommercialAuditEntry,
  CommercialSyncPorts,
  FinanceLockResult,
  MasterCommercialValues,
} from "./types";

/** Phase 1–2 stub — always unlocked. Phase 3 replaces via ports.isFinanceLocked. */
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
      return await this.executeConfirmedChange(input, occurredAt, changeKeys);
    } finally {
      if (idempotencyKey) {
        await this.ports.endIdempotent(idempotencyKey);
      }
    }
  }

  private async executeConfirmedChange(
    input: ApplyMasterChangeInput,
    occurredAt: string,
    changeKeys: string[]
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

    if (registry.campaignHeaderId) {
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
    const agreement: MasterCommercialValues = {
      ...(previousQuote ?? {}),
      ...input.changes,
    };

    let quotationAgreement = agreement;
    if (
      input.source.side === "campaign" &&
      registry.assignmentIds.length > 1
    ) {
      quotationAgreement = await this.reconstructAgreementFromCampaignEdit({
        registryAssignmentIds: registry.assignmentIds,
        editedAssignmentId: input.source.assignmentId,
        changes: input.changes,
        previousQuote: previousQuote ?? {},
      });
    }

    try {
      const result = await this.ports.runInTransaction(async () => {
        await this.ports.writeQuotationMaster(
          registry.quotationItemId,
          quotationAgreement
        );

        const shares = allocateMasterAcrossAssignments(
          quotationAgreement,
          Math.max(1, registry.assignmentIds.length)
        );

        if (registry.assignmentIds.length === 0) {
          // Quote-only (no Assignments yet).
        } else if (
          input.source.side === "campaign" &&
          registry.assignmentIds.length > 1
        ) {
          for (const assignmentId of registry.assignmentIds) {
            if (assignmentId === input.source.assignmentId) {
              const current =
                (await this.ports.loadAssignmentMaster(assignmentId)) ?? {};
              await this.ports.writeAssignmentMaster(assignmentId, {
                ...current,
                ...input.changes,
              });
            } else {
              const current =
                (await this.ports.loadAssignmentMaster(assignmentId)) ?? {};
              const rateOnly = pickRateMasterChanges(input.changes);
              if (Object.keys(rateOnly).length > 0) {
                await this.ports.writeAssignmentMaster(assignmentId, {
                  ...current,
                  ...rateOnly,
                });
              }
            }
          }
        } else {
          for (let i = 0; i < registry.assignmentIds.length; i++) {
            await this.ports.writeAssignmentMaster(
              registry.assignmentIds[i],
              shares[i] ?? quotationAgreement
            );
          }
        }

        await this.ports.recalculateQuotationDerived(registry.quotationId);
        if (registry.campaignHeaderId) {
          await this.ports.recalculateCampaignDerived(registry.campaignHeaderId);
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
          applied: quotationAgreement,
          allocation:
            registry.assignmentIds.length <= 1
              ? ("single" as const)
              : input.source.side === "campaign"
                ? ("rates_only" as const)
                : ("equal_split" as const),
          concurrencyToken: nextToken,
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
        oldData: (previousQuote as Record<string, unknown>) ?? null,
        newData: quotationAgreement as Record<string, unknown>,
        metadata: {
          allocation: result.allocation,
          reason: input.reason ?? null,
          changed_keys: changeKeys,
          user_id: input.actorId,
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
        oldData: (previousQuote as Record<string, unknown>) ?? null,
        newData: { changes: input.changes },
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

export function createCommercialSynchronizationService(
  ports: CommercialSyncPorts
): CommercialSynchronizationService {
  return new CommercialSynchronizationService(ports);
}
