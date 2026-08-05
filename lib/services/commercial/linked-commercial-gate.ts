/**
 * Phase 2 gate: when a Commercial Line is linked across Quotation ↔ Campaign,
 * Master edits require confirmation and go through CommercialSynchronizationService.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import {
  Campaign,
  type FinanceLockResult,
} from "@/lib/finance/campaign-finance-lock";

import {
  COMMERCIAL_SYNC_CONFIRMATION_REQUIRED,
  commercialSyncConfirmationCopy,
  financeLockConfirmationCopy,
} from "./confirmation-copy";
import { createCommercialSynchronizationService } from "./commercial-synchronization-service";
import {
  diffMasterChanges,
  fromCampaignRow,
  fromQuotationRow,
} from "./field-registry";
import {
  probeCommercialLinkByAssignment,
  probeCommercialLinkByQuotationItem,
} from "./probe-commercial-link";
import { createSupabaseCommercialSyncPorts } from "./supabase-ports";
import type {
  CommercialSyncLinkProbe,
  MasterCommercialValues,
} from "./types";

type Supabase = SupabaseClient<Database>;

export type CommercialSyncGateOptions = {
  confirmCommercialSync?: boolean;
  idempotencyKey?: string | null;
  expectedConcurrencyToken?: string | null;
  reason?: string | null;
};

export type CommercialSyncGateDenied = {
  ok: false;
  code: string;
  message: string;
  financeLock?: FinanceLockResult;
  commercialSync?: CommercialSyncLinkProbe & {
    confirmationTitle: string;
    confirmationDescription: string;
  };
};

export type CommercialSyncGateApplied = {
  ok: true;
  synced: true;
  probe: CommercialSyncLinkProbe;
  concurrencyToken: string | null;
};

export type CommercialSyncGateSkipped = {
  ok: true;
  synced: false;
  reason: "not_linked" | "no_dirty_masters";
};

const QUOTATION_MASTER_SELECT =
  "cost, revenue, cost_currency, fx_rate_to_egp, af_pct, commercial_input_mode, gp_pct, gp_value";

const CAMPAIGN_MASTER_SELECT =
  "cost, revenue, cost_before_vat, revenue_before_vat, currency_code, fx_rate, agency_fee_percent, pricing_mode, markup_margin, profit, usage_rights_amount, usage_rights_cost, revenue_vat_percent, cost_vat_percent, revenue_vat_exempt, cost_vat_exempt";

async function quotationHasDirtyMasterChanges(
  supabase: Supabase,
  quotationItemId: string,
  changes: MasterCommercialValues
): Promise<boolean> {
  const { data } = await supabase
    .from("quotation_items")
    .select(QUOTATION_MASTER_SELECT)
    .eq("id", quotationItemId)
    .maybeSingle();
  if (!data) return Object.keys(changes).length > 0;
  const { fieldChanges } = diffMasterChanges(
    fromQuotationRow(data as Record<string, unknown>),
    changes
  );
  return fieldChanges.length > 0;
}

async function assignmentHasDirtyMasterChanges(
  supabase: Supabase,
  assignmentId: string,
  changes: MasterCommercialValues
): Promise<boolean> {
  const { data } = await supabase
    .from("campaign_lines")
    .select(CAMPAIGN_MASTER_SELECT)
    .eq("id", assignmentId)
    .maybeSingle();
  if (!data) return Object.keys(changes).length > 0;
  const { fieldChanges } = diffMasterChanges(
    fromCampaignRow(data as Record<string, unknown>),
    changes
  );
  return fieldChanges.length > 0;
}

export async function applyQuotationMasterSyncIfLinked(
  supabase: Supabase,
  input: {
    actorId: string;
    quotationItemId: string;
    changes: MasterCommercialValues;
    options?: CommercialSyncGateOptions;
  }
): Promise<
  CommercialSyncGateDenied | CommercialSyncGateApplied | CommercialSyncGateSkipped
> {
  const probe = await probeCommercialLinkByQuotationItem(
    supabase,
    input.quotationItemId
  );
  if (!probe.linked) {
    return { ok: true, synced: false, reason: "not_linked" };
  }

  // Document dates / notes / identical re-saves are not Master commercial edits.
  // Skip lock + sync confirmation when nothing Master actually changed.
  const dirty = await quotationHasDirtyMasterChanges(
    supabase,
    input.quotationItemId,
    input.changes
  );
  if (!dirty) {
    return {
      ok: true,
      synced: true,
      probe,
      concurrencyToken: probe.concurrencyToken,
    };
  }

  if (probe.campaignHeaderId) {
    const lock = await Campaign.isFinanceLocked(
      supabase,
      probe.campaignHeaderId
    );
    if (lock.locked) {
      const copy = financeLockConfirmationCopy();
      return {
        ok: false,
        code: "FINANCE_LOCKED",
        message: copy.description,
        financeLock: lock,
        commercialSync: {
          ...probe,
          confirmationTitle: copy.title,
          confirmationDescription: copy.description,
        },
      };
    }
  }

  if (!input.options?.confirmCommercialSync) {
    const copy = commercialSyncConfirmationCopy({
      side: "quotation",
      quotationSerial: probe.quotationSerial,
      campaignDocumentNumber: probe.campaignDocumentNumber,
    });
    return {
      ok: false,
      code: COMMERCIAL_SYNC_CONFIRMATION_REQUIRED,
      message: copy.description,
      commercialSync: {
        ...probe,
        confirmationTitle: copy.title,
        confirmationDescription: copy.description,
      },
    };
  }

  const svc = createCommercialSynchronizationService(
    createSupabaseCommercialSyncPorts(supabase)
  );
  const result = await svc.applyMasterChange({
    actorId: input.actorId,
    confirmed: true,
    source: { side: "quotation", quotationItemId: input.quotationItemId },
    changes: input.changes,
    idempotencyKey: input.options.idempotencyKey,
    expectedConcurrencyToken:
      input.options.expectedConcurrencyToken ?? probe.concurrencyToken,
    reason: input.options.reason,
  });

  if (!result.ok) {
    return { ok: false, code: result.code, message: result.message };
  }

  return {
    ok: true,
    synced: true,
    probe,
    concurrencyToken: result.concurrencyToken,
  };
}

export async function applyCampaignMasterSyncIfLinked(
  supabase: Supabase,
  input: {
    actorId: string;
    assignmentId: string;
    changes: MasterCommercialValues;
    options?: CommercialSyncGateOptions;
  }
): Promise<
  CommercialSyncGateDenied | CommercialSyncGateApplied | CommercialSyncGateSkipped
> {
  const probe = await probeCommercialLinkByAssignment(
    supabase,
    input.assignmentId
  );

  // Platform finance lock applies to the Campaign even when Origin is missing.
  const campaignHeaderId =
    probe.campaignHeaderId ??
    (
      await supabase
        .from("campaign_lines")
        .select("campaign_header_id")
        .eq("id", input.assignmentId)
        .maybeSingle()
    ).data?.campaign_header_id;

  if (!probe.linked) {
    // Still respect campaign finance lock for unlinked assignment Master edits.
    if (campaignHeaderId) {
      const dirtyUnlinked = await assignmentHasDirtyMasterChanges(
        supabase,
        input.assignmentId,
        input.changes
      );
      if (!dirtyUnlinked) {
        return { ok: true, synced: false, reason: "no_dirty_masters" };
      }
      const lock = await Campaign.isFinanceLocked(supabase, campaignHeaderId);
      if (lock.locked) {
        const copy = financeLockConfirmationCopy();
        return {
          ok: false,
          code: "FINANCE_LOCKED",
          message: copy.description,
          financeLock: lock,
          commercialSync: {
            ...probe,
            campaignHeaderId,
            confirmationTitle: copy.title,
            confirmationDescription: copy.description,
          },
        };
      }
    }
    return { ok: true, synced: false, reason: "not_linked" };
  }

  const dirty = await assignmentHasDirtyMasterChanges(
    supabase,
    input.assignmentId,
    input.changes
  );
  if (!dirty) {
    return {
      ok: true,
      synced: true,
      probe,
      concurrencyToken: probe.concurrencyToken,
    };
  }

  if (campaignHeaderId) {
    const lock = await Campaign.isFinanceLocked(supabase, campaignHeaderId);
    if (lock.locked) {
      const copy = financeLockConfirmationCopy();
      return {
        ok: false,
        code: "FINANCE_LOCKED",
        message: copy.description,
        financeLock: lock,
        commercialSync: {
          ...probe,
          campaignHeaderId,
          confirmationTitle: copy.title,
          confirmationDescription: copy.description,
        },
      };
    }
  }

  if (!input.options?.confirmCommercialSync) {
    const copy = commercialSyncConfirmationCopy({
      side: "campaign",
      quotationSerial: probe.quotationSerial,
      campaignDocumentNumber: probe.campaignDocumentNumber,
    });
    return {
      ok: false,
      code: COMMERCIAL_SYNC_CONFIRMATION_REQUIRED,
      message: copy.description,
      commercialSync: {
        ...probe,
        confirmationTitle: copy.title,
        confirmationDescription: copy.description,
      },
    };
  }

  const svc = createCommercialSynchronizationService(
    createSupabaseCommercialSyncPorts(supabase)
  );
  const result = await svc.applyMasterChange({
    actorId: input.actorId,
    confirmed: true,
    source: { side: "campaign", assignmentId: input.assignmentId },
    changes: input.changes,
    idempotencyKey: input.options.idempotencyKey,
    expectedConcurrencyToken:
      input.options.expectedConcurrencyToken ?? probe.concurrencyToken,
    reason: input.options.reason,
  });

  if (!result.ok) {
    return { ok: false, code: result.code, message: result.message };
  }

  return {
    ok: true,
    synced: true,
    probe,
    concurrencyToken: result.concurrencyToken,
  };
}
