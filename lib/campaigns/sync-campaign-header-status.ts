import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isCampaignBillingEligible,
} from "@/lib/billing/campaign-billing-eligibility";
import { loadCampaignOperationalBilling } from "@/lib/billing/operational-billing-query";
import type { OperationalBillingRow } from "@/lib/billing/operational-billing-rows";
import type { CampaignStatus } from "@/types/database";

export type CampaignHeaderStatusSignals = {
  hasGeneratedClientIo: boolean;
  hasGeneratedVendorIo: boolean;
  fullyInvoiced: boolean;
};

/** Client IO counts as generated once the branded document has been rendered. */
export function isClientIoGenerated(row: {
  document_generated_at: string | null;
} | null): boolean {
  return Boolean(row?.document_generated_at);
}

/** Active (non-superseded) Vendor IO rows represent generated vendor IOs. */
export function isVendorIoGenerated(count: number): boolean {
  return count > 0;
}

/** Matches billing queue: no remaining invoiceable work and invoiced revenue exists. */
export function isCampaignFullyInvoiced(operationalRows: OperationalBillingRow[]): boolean {
  if (operationalRows.length === 0) {
    return false;
  }

  if (isCampaignBillingEligible(operationalRows)) {
    return false;
  }

  const assignments = operationalRows.filter((row) => row.kind === "assignment");
  const totalInvoiced = assignments.reduce(
    (sum, row) => sum + Number(row.invoiced_amount ?? 0),
    0
  );

  return totalInvoiced > 0;
}

export function deriveCampaignHeaderStatus(
  signals: CampaignHeaderStatusSignals
): CampaignStatus {
  const hasAnyGeneratedIo =
    signals.hasGeneratedClientIo || signals.hasGeneratedVendorIo;

  if (!hasAnyGeneratedIo) {
    return "draft";
  }

  if (signals.fullyInvoiced) {
    return "completed";
  }

  return "active";
}

export function shouldAutoSyncCampaignHeaderStatus(
  currentStatus: CampaignStatus
): boolean {
  return currentStatus !== "cancelled";
}

export async function loadCampaignHeaderStatusSignals(
  supabase: SupabaseClient,
  campaignHeaderId: string
): Promise<CampaignHeaderStatusSignals> {
  const [clientIoResult, vendorIoResult, billingResult] = await Promise.all([
    supabase
      .from("client_ios")
      .select("document_generated_at")
      .eq("campaign_header_id", campaignHeaderId)
      .maybeSingle(),
    supabase
      .from("vendor_ios")
      .select("id", { count: "exact", head: true })
      .eq("campaign_header_id", campaignHeaderId)
      .eq("is_superseded", false),
    loadCampaignOperationalBilling(supabase, campaignHeaderId),
  ]);

  if (clientIoResult.error) {
    throw new Error(clientIoResult.error.message);
  }
  if (vendorIoResult.error) {
    throw new Error(vendorIoResult.error.message);
  }
  if (billingResult.error) {
    throw new Error(billingResult.error);
  }

  return {
    hasGeneratedClientIo: isClientIoGenerated(
      clientIoResult.data as { document_generated_at: string | null } | null
    ),
    hasGeneratedVendorIo: isVendorIoGenerated(vendorIoResult.count ?? 0),
    fullyInvoiced: isCampaignFullyInvoiced(billingResult.operational_rows),
  };
}

export type SyncCampaignHeaderStatusResult = {
  updated: boolean;
  status: CampaignStatus;
  previousStatus?: CampaignStatus;
};

/** Recomputes and persists campaign header status from IO + billing signals. */
export async function syncCampaignHeaderStatus(
  supabase: SupabaseClient,
  campaignHeaderId: string
): Promise<SyncCampaignHeaderStatusResult> {
  const { data: header, error: headerError } = await supabase
    .from("campaign_headers")
    .select("status")
    .eq("id", campaignHeaderId)
    .maybeSingle();

  if (headerError) {
    throw new Error(headerError.message);
  }
  if (!header) {
    throw new Error("Campaign header not found.");
  }

  const currentStatus = (header as { status: CampaignStatus }).status;
  if (!shouldAutoSyncCampaignHeaderStatus(currentStatus)) {
    return { updated: false, status: currentStatus, previousStatus: currentStatus };
  }

  const signals = await loadCampaignHeaderStatusSignals(supabase, campaignHeaderId);
  const nextStatus = deriveCampaignHeaderStatus(signals);

  if (nextStatus === currentStatus) {
    return { updated: false, status: currentStatus, previousStatus: currentStatus };
  }

  const { error: updateError } = await supabase
    .from("campaign_headers")
    .update({ status: nextStatus } as never)
    .eq("id", campaignHeaderId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return {
    updated: true,
    status: nextStatus,
    previousStatus: currentStatus,
  };
}
