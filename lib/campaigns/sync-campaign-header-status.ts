import type { SupabaseClient } from "@supabase/supabase-js";

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

export type CampaignLineBillingSnapshot = {
  billing_status: string;
  invoice_id: string | null;
  revenue: number;
};

const INCOMPLETE_LINE_BILLING = new Set([
  "draft",
  "approved",
  "moved_to_billing",
  "partially_invoiced",
  "partially_paid",
  "partially_collected",
]);

const TERMINAL_INVOICED_LINE_BILLING = new Set(["invoiced", "paid", "closed"]);

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

/** Fast line-level completion check for header status (avoids full operational billing tree). */
export function isCampaignFullyInvoicedFromLines(
  lines: CampaignLineBillingSnapshot[]
): boolean {
  const active = lines.filter((line) => line.billing_status !== "cancelled");
  if (active.length === 0) {
    return false;
  }

  let invoicedTotal = 0;

  for (const line of active) {
    if (
      INCOMPLETE_LINE_BILLING.has(line.billing_status) ||
      !TERMINAL_INVOICED_LINE_BILLING.has(line.billing_status)
    ) {
      return false;
    }

    if (line.invoice_id || line.revenue > 0) {
      invoicedTotal += line.revenue;
    }
  }

  return invoicedTotal > 0;
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
  return (
    message.toLowerCase().includes(column.toLowerCase()) &&
    message.toLowerCase().includes("does not exist")
  );
}

/** Count active vendor IO rows; falls back when is_superseded column is not migrated yet. */
export async function countGeneratedVendorIos(
  supabase: SupabaseClient,
  campaignHeaderId: string
): Promise<number> {
  const counts = await loadVendorIoCountsByCampaign(supabase, [campaignHeaderId]);
  return counts.get(campaignHeaderId) ?? 0;
}

export async function loadVendorIoCountsByCampaign(
  supabase: SupabaseClient,
  campaignHeaderIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (campaignHeaderIds.length === 0) {
    return counts;
  }

  const withSuperseded = await supabase
    .from("vendor_ios")
    .select("campaign_header_id, is_superseded")
    .in("campaign_header_id", campaignHeaderIds);

  if (withSuperseded.error && isMissingColumnError(withSuperseded.error.message, "is_superseded")) {
    const fallback = await supabase
      .from("vendor_ios")
      .select("campaign_header_id")
      .in("campaign_header_id", campaignHeaderIds);

    if (fallback.error) {
      throw new Error(fallback.error.message);
    }

    for (const row of fallback.data ?? []) {
      const campaignId = (row as { campaign_header_id: string }).campaign_header_id;
      counts.set(campaignId, (counts.get(campaignId) ?? 0) + 1);
    }

    return counts;
  }

  if (withSuperseded.error) {
    throw new Error(withSuperseded.error.message);
  }

  for (const row of withSuperseded.data ?? []) {
    const typed = row as { campaign_header_id: string; is_superseded?: boolean | null };
    if (typed.is_superseded) {
      continue;
    }
    counts.set(typed.campaign_header_id, (counts.get(typed.campaign_header_id) ?? 0) + 1);
  }

  return counts;
}

async function loadCampaignLineBillingSnapshots(
  supabase: SupabaseClient,
  campaignHeaderId: string
): Promise<CampaignLineBillingSnapshot[]> {
  const { data, error } = await supabase
    .from("campaign_lines")
    .select("billing_status, invoice_id, revenue")
    .eq("campaign_header_id", campaignHeaderId);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const typed = row as {
      billing_status: string | null;
      invoice_id: string | null;
      revenue: number | null;
    };
    return {
      billing_status: typed.billing_status ?? "draft",
      invoice_id: typed.invoice_id ?? null,
      revenue: Number(typed.revenue ?? 0),
    };
  });
}

export async function loadCampaignHeaderStatusSignals(
  supabase: SupabaseClient,
  campaignHeaderId: string,
  lineSnapshots?: CampaignLineBillingSnapshot[]
): Promise<CampaignHeaderStatusSignals> {
  const [clientIoResult, vendorIoCount, lines] = await Promise.all([
    supabase
      .from("client_ios")
      .select("status, sent_at, attachment_url, terms_html")
      .eq("campaign_header_id", campaignHeaderId)
      .maybeSingle(),
    countGeneratedVendorIos(supabase, campaignHeaderId),
    lineSnapshots
      ? Promise.resolve(lineSnapshots)
      : loadCampaignLineBillingSnapshots(supabase, campaignHeaderId),
  ]);

  if (clientIoResult.error) {
    throw new Error(clientIoResult.error.message);
  }

  return {
    hasGeneratedClientIo: isClientIoGenerated(
      clientIoResult.data as ClientIoGenerationSignals | null
    ),
    hasGeneratedVendorIo: isVendorIoGenerated(vendorIoCount),
    fullyInvoiced: isCampaignFullyInvoicedFromLines(lines),
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
  campaignHeaderId: string,
  options?: { lineSnapshots?: CampaignLineBillingSnapshot[] }
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

  const signals = await loadCampaignHeaderStatusSignals(
    supabase,
    campaignHeaderId,
    options?.lineSnapshots
  );
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

type CampaignListStatusRow = {
  id: string;
  status: CampaignStatus;
  lines?: Array<{
    billing_status?: string | null;
    invoice_id?: string | null;
    revenue?: number | null;
  }>;
};

/** Batch status sync for campaigns list — 3 queries total instead of per-campaign billing trees. */
export async function syncCampaignHeaderStatusesForList(
  supabase: SupabaseClient,
  campaigns: CampaignListStatusRow[]
): Promise<void> {
  const eligible = campaigns.filter((campaign) =>
    shouldAutoSyncCampaignHeaderStatus(campaign.status)
  );
  const campaignIds = eligible.map((campaign) => campaign.id);
  if (campaignIds.length === 0) {
    return;
  }

  const [clientIosResult, vendorCounts] = await Promise.all([
    supabase
      .from("client_ios")
      .select("campaign_header_id, status, sent_at, attachment_url")
      .in("campaign_header_id", campaignIds),
    loadVendorIoCountsByCampaign(supabase, campaignIds),
  ]);

  if (clientIosResult.error) {
    throw new Error(clientIosResult.error.message);
  }

  const clientIoByCampaign = new Map(
    (clientIosResult.data ?? []).map((row) => {
      const typed = row as ClientIoGenerationSignals & { campaign_header_id: string };
      return [typed.campaign_header_id, typed] as const;
    })
  );

  const updates: Array<PromiseLike<unknown>> = [];

  for (const campaign of eligible) {
    const lineSnapshots: CampaignLineBillingSnapshot[] = (campaign.lines ?? []).map((line) => ({
      billing_status: line.billing_status ?? "draft",
      invoice_id: line.invoice_id ?? null,
      revenue: Number(line.revenue ?? 0),
    }));

    const signals: CampaignHeaderStatusSignals = {
      hasGeneratedClientIo: isClientIoGenerated(clientIoByCampaign.get(campaign.id) ?? null),
      hasGeneratedVendorIo: isVendorIoGenerated(vendorCounts.get(campaign.id) ?? 0),
      fullyInvoiced: isCampaignFullyInvoicedFromLines(lineSnapshots),
    };

    const nextStatus = deriveCampaignHeaderStatus(signals);
    if (nextStatus === campaign.status) {
      continue;
    }

    campaign.status = nextStatus;
    updates.push(
      supabase
        .from("campaign_headers")
        .update({ status: nextStatus } as never)
        .eq("id", campaign.id)
    );
  }

  if (updates.length > 0) {
    await Promise.all(updates);
  }
}
