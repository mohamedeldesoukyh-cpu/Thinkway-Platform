/**
 * CommercialSynchronizationService — sole orchestration point for
 * Quotation ↔ Campaign Master commercial synchronization.
 *
 * Spec: docs/architecture/COMMERCIAL_SSOT_QUOTE_CAMPAIGN.md §5–§6
 *
 * Phase 1: foundation (registry, identity, audit, sync by CML ID).
 * Phase 2: UI confirmation + wire into editors.
 * Phase 3: real Campaign.isFinanceLocked() implementation.
 * Phase 4: Commercial Revision path.
 */

import {
  allocateMasterAcrossAssignments,
  assertOnlyMasterChanges,
} from "./field-registry";
import type {
  ApplyMasterChangeInput,
  ApplyMasterChangeResult,
  CommercialSyncPorts,
  FinanceLockResult,
  MasterCommercialValues,
} from "./types";

/** Phase 1 stub — always unlocked. Phase 3 replaces via ports.isFinanceLocked. */
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
   */
  async applyMasterChange(
    input: ApplyMasterChangeInput
  ): Promise<ApplyMasterChangeResult> {
    if (!input.confirmed) {
      await this.ports.writeAudit({
        event: "commercial.sync_not_confirmed",
        actorId: input.actorId,
        commercialLineId: null,
        quotationId: null,
        campaignHeaderId: null,
        assignmentIds: [],
        sourceSide: input.source.side,
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
      await this.ports.writeAudit({
        event: "commercial.sync_rejected",
        actorId: input.actorId,
        commercialLineId: null,
        quotationId: null,
        campaignHeaderId: null,
        assignmentIds: [],
        sourceSide: input.source.side,
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
        await this.ports.writeAudit({
          event: "commercial.sync_blocked_finance_lock",
          actorId: input.actorId,
          commercialLineId: registry.commercialLineId,
          quotationId: registry.quotationId,
          campaignHeaderId: registry.campaignHeaderId,
          assignmentIds: registry.assignmentIds,
          sourceSide: input.source.side,
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

    const previousQuote = await this.ports.loadQuotationMaster(
      registry.quotationItemId
    );
    const agreement: MasterCommercialValues = {
      ...(previousQuote ?? {}),
      ...input.changes,
    };

    // When editing from Campaign with 1:N, absolute amounts on the edited
    // Assignment are treated as that Assignment's share; reconstruct agreement
    // totals for the Quotation Commercial Line.
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
      await this.ports.writeQuotationMaster(
        registry.quotationItemId,
        quotationAgreement
      );

      const allocation =
        registry.assignmentIds.length <= 1
          ? "single"
          : "equal_split";

      const shares = allocateMasterAcrossAssignments(
        quotationAgreement,
        Math.max(1, registry.assignmentIds.length)
      );

      if (registry.assignmentIds.length === 0) {
        // Quotation exists without Assignments yet — quote-only write + audit.
      } else if (input.source.side === "campaign" && registry.assignmentIds.length > 1) {
        // Preserve sibling shares; only patch the edited Assignment + rates on all.
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
            const rateOnly: MasterCommercialValues = {};
            for (const [key, value] of Object.entries(input.changes)) {
              if (
                key === "cost_currency" ||
                key === "exchange_rate" ||
                key === "agency_fee_percent" ||
                key === "commercial_input_mode" ||
                key === "gp_pct_input" ||
                key === "revenue_vat_percent" ||
                key === "cost_vat_percent" ||
                key === "revenue_vat_exempt" ||
                key === "cost_vat_exempt"
              ) {
                rateOnly[key as keyof MasterCommercialValues] = value as never;
              }
            }
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

      await this.ports.writeAudit({
        event: "commercial.master_synced",
        actorId: input.actorId,
        commercialLineId: registry.commercialLineId,
        quotationId: registry.quotationId,
        campaignHeaderId: registry.campaignHeaderId,
        assignmentIds: registry.assignmentIds,
        sourceSide: input.source.side,
        oldData: (previousQuote as Record<string, unknown>) ?? null,
        newData: quotationAgreement as Record<string, unknown>,
        metadata: {
          allocation,
          reason: input.reason ?? null,
          changed_keys: changeKeys,
        },
      });

      return {
        ok: true,
        commercialLineId: registry.commercialLineId,
        quotationId: registry.quotationId,
        campaignHeaderId: registry.campaignHeaderId,
        assignmentIds: registry.assignmentIds,
        applied: quotationAgreement,
        allocation:
          registry.assignmentIds.length <= 1
            ? "single"
            : input.source.side === "campaign"
              ? "rates_only"
              : "equal_split",
      };
    } catch (error) {
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

  private async reconstructAgreementFromCampaignEdit(input: {
    registryAssignmentIds: string[];
    editedAssignmentId: string;
    changes: MasterCommercialValues;
    previousQuote: MasterCommercialValues;
  }): Promise<MasterCommercialValues> {
    const next: MasterCommercialValues = { ...input.previousQuote, ...input.changes };

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
            : (await this.ports.loadAssignmentMaster(assignmentId)) ?? {};
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

/** Convenience factory. */
export function createCommercialSynchronizationService(
  ports: CommercialSyncPorts
): CommercialSynchronizationService {
  return new CommercialSynchronizationService(ports);
}
