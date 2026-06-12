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

export type ClientIoGenerationSignals = {
  status?: string | null;
  sent_at?: string | null;
  attachment_url?: string | null;
  terms_html?: string | null;
  document_generated_at?: string | null;
  generated_html_url?: string | null;
};

/** Client IO counts as generated once sent, approved, or a branded document exists. */
export function isClientIoGenerated(row: ClientIoGenerationSignals | null): boolean {
  if (!row) {
    return false;
  }

  if (row.document_generated_at || row.generated_html_url) {
    return true;
  }

  const status = row.status?.toLowerCase() ?? "";
  if (status === "generated" || status === "sent" || status === "approved") {
    return true;
  }

  if (row.sent_at) {
    return true;
  }

  if (row.attachment_url?.trim()) {
    return true;
  }

  return false;
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

function isMissingColumnError(message: string, column: string): boolean {
  return message.toLowerCase().includes(column.toLowerCase()) && message.toLowerCase().includes("does not exist");
}

/** Count active vendor IO rows; falls back when is_superseded column is not migrated yet. */
export async function countGeneratedVendorIos(
  supabase: SupabaseClient,
  campaignHeaderId: string
): Promise<number> {
  const activeOnly = await supabase
    .from("vendor_ios")
    .select("id", { count: "exact", head: true })
    .eq("campaign_header_id", campaignHeaderId)
    .eq("is_superseded", false);

  if (!activeOnly.error) {
    return activeOnly.count ?? 0;
  }

  if (!isMissingColumnError(activeOnly.error.message, "is_superseded")) {
    throw new Error(activeOnly.error.message);
  }

  const allRows = await supabase
    .from("vendor_ios")
    .select("id", { count: "exact", head: true })
    .eq("campaign_header_id", campaignHeaderId);

  if (allRows.error) {
    throw new Error(allRows.error.message);
  }

  return allRows.count ?? 0;
}

export async function loadCampaignHeaderStatusSignals(
  supabase: SupabaseClient,
  campaignHeaderId: string
): Promise<CampaignHeaderStatusSignals> {
  const [clientIoResult, vendorIoCount, billingResult] = await Promise.all([
    supabase
      .from("client_ios")
      .select("status, sent_at, attachment_url, terms_html")
      .eq("campaign_header_id", campaignHeaderId)
      .maybeSingle(),
    countGeneratedVendorIos(supabase, campaignHeaderId),
    loadCampaignOperationalBilling(supabase, campaignHeaderId),
  ]);

  if (clientIoResult.error) {
    throw new Error(clientIoResult.error.message);
  }
  if (billingResult.error) {
    throw new Error(billingResult.error);
  }

  return {
    hasGeneratedClientIo: isClientIoGenerated(
      clientIoResult.data as ClientIoGenerationSignals | null
    ),
    hasGeneratedVendorIo: isVendorIoGenerated(vendorIoCount),
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
