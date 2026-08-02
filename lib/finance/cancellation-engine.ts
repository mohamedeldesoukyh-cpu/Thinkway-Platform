import type { SupabaseClient } from "@supabase/supabase-js";

import { logFinanceAuditEvent } from "@/lib/finance/audit-log";
import { FINANCE_AUDIT_EVENTS } from "@/lib/finance/audit-events";
import { guardCampaignCancellation } from "@/lib/finance/integrity-guards";
import { voidInvoice } from "@/lib/finance/invoice-lifecycle";
import {
  isFinancialPeriodLocked,
  periodLockBlockReason,
  resolveFinancialPeriodLockForDate,
} from "@/lib/finance/period-lock";
import { isActiveInvoiceForFinancialTotals } from "@/lib/finance/status/invoice-status";
import { syncCampaignHeaderStatus } from "@/lib/campaigns/sync-campaign-header-status";
import type { Database } from "@/types/database";
import type { CampaignStatus } from "@/types/database";

export type CampaignCancellationResult =
  | {
      ok: true;
      campaign_id: string;
      vendor_io_count: number;
      invoice_count: number;
      client_io_count: number;
    }
  | { ok: false; error: string };

export type CampaignCancellationPreview = {
  allowed: boolean;
  reason?: string;
  has_vendor_ios: boolean;
  vendor_io_count: number;
  active_invoice_count: number;
  client_io_count: number;
  period_locked: boolean;
  period_label?: string;
};

function resolveCampaignPeriodDate(header: {
  start_date: string | null;
  created_at?: string | null;
}): string {
  if (header.start_date) return header.start_date;
  if (header.created_at) return header.created_at.slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

async function loadCampaignCancellationContext(
  supabase: SupabaseClient<Database>,
  campaignId: string
) {
  const [{ data: header, error: headerError }, { data: invoices }, { data: vendorIos }, { data: clientIos }] =
    await Promise.all([
      supabase
        .from("campaign_headers")
        .select("id, document_number, status, start_date, created_at")
        .eq("id", campaignId)
        .maybeSingle(),
      supabase
        .from("invoices")
        .select("id, status, regeneration_status, amount_paid, document_number")
        .eq("campaign_header_id", campaignId),
      supabase.from("vendor_ios").select("id").eq("campaign_header_id", campaignId),
      supabase.from("client_ios").select("id").eq("campaign_header_id", campaignId),
    ]);

  if (headerError) throw new Error(headerError.message);

  const periodDate = header ? resolveCampaignPeriodDate(header as { start_date: string | null; created_at?: string | null }) : null;
  const periodLock = periodDate
    ? await resolveFinancialPeriodLockForDate(supabase, periodDate)
    : null;

  return {
    header,
    invoices: invoices ?? [],
    vendorIos: vendorIos ?? [],
    clientIos: clientIos ?? [],
    periodLock,
  };
}

export async function previewCampaignCancellation(
  supabase: SupabaseClient<Database>,
  campaignId: string
): Promise<CampaignCancellationPreview> {
  const { header, invoices, vendorIos, clientIos, periodLock } =
    await loadCampaignCancellationContext(supabase, campaignId);

  if (!header) {
    return {
      allowed: false,
      reason: "Campaign not found.",
      has_vendor_ios: false,
      vendor_io_count: 0,
      active_invoice_count: 0,
      client_io_count: 0,
      period_locked: false,
    };
  }

  const activeInvoices = invoices.filter((inv) =>
    isActiveInvoiceForFinancialTotals({
      status: String((inv as { status: string }).status),
      regeneration_status: (inv as { regeneration_status?: string }).regeneration_status,
    })
  );

  const guard = guardCampaignCancellation({
    period_lock: periodLock,
    invoices: invoices.map((inv) => ({
      status: String((inv as { status: string }).status),
      regeneration_status: (inv as { regeneration_status?: string }).regeneration_status,
      amount_paid: Number((inv as { amount_paid?: number }).amount_paid ?? 0),
    })),
  });

  const periodLocked = periodLock ? isFinancialPeriodLocked(periodLock.status) : false;
  const periodLabel = periodLock
    ? `${periodLock.year}-${String(periodLock.month).padStart(2, "0")}`
    : undefined;

  return {
    allowed: guard.allowed,
    reason: guard.allowed
      ? undefined
      : guard.reason ??
        (periodLock && periodLocked
          ? periodLockBlockReason(periodLock)
          : "Campaign cannot be cancelled."),
    has_vendor_ios: vendorIos.length > 0,
    vendor_io_count: vendorIos.length,
    active_invoice_count: activeInvoices.length,
    client_io_count: clientIos.length,
    period_locked: periodLocked,
    period_label: periodLabel,
  };
}

async function cancelCampaignInvoices(
  supabase: SupabaseClient<Database>,
  input: {
    campaign_id: string;
    actor_id: string;
    reason?: string;
    invoices: Array<{
      id: string;
      status: string;
      regeneration_status?: string | null;
    }>;
  }
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  let count = 0;

  for (const invoice of input.invoices) {
    if (invoice.status === "void") continue;
    if (
      !isActiveInvoiceForFinancialTotals({
        status: invoice.status,
        regeneration_status: invoice.regeneration_status,
      })
    ) {
      continue;
    }

    const voidResult = await voidInvoice(supabase, {
      invoice_id: invoice.id,
      actor_id: input.actor_id,
      reason: input.reason ?? "Campaign cancelled",
    });

    if (!voidResult.ok) {
      return { ok: false, error: voidResult.error ?? "Failed to cancel invoice." };
    }

    await logFinanceAuditEvent(supabase, {
      event: FINANCE_AUDIT_EVENTS.invoice_cancelled,
      entity_type: "invoice",
      entity_id: invoice.id,
      actor_id: input.actor_id,
      old_data: { status: invoice.status },
      new_data: { status: "void", campaign_cancelled: true },
      payload: {
        campaign_id: input.campaign_id,
        reason: input.reason ?? null,
      },
    });

    count += 1;
  }

  return { ok: true, count };
}

export async function cancelCampaign(
  supabase: SupabaseClient<Database>,
  input: {
    campaign_id: string;
    actor_id: string;
    reason?: string;
  }
): Promise<CampaignCancellationResult> {
  const context = await loadCampaignCancellationContext(supabase, input.campaign_id);
  const { header, invoices, vendorIos, clientIos, periodLock } = context;

  if (!header) {
    return { ok: false, error: "Campaign not found." };
  }

  const guard = guardCampaignCancellation({
    period_lock: periodLock,
    invoices: invoices.map((inv) => ({
      status: String((inv as { status: string }).status),
      regeneration_status: (inv as { regeneration_status?: string }).regeneration_status,
      amount_paid: Number((inv as { amount_paid?: number }).amount_paid ?? 0),
    })),
  });

  if (!guard.allowed) {
    return { ok: false, error: guard.reason ?? "Campaign cannot be cancelled." };
  }

  const previousStatus = (header as { status: CampaignStatus }).status;

  const invoiceResult = await cancelCampaignInvoices(supabase, {
    campaign_id: input.campaign_id,
    actor_id: input.actor_id,
    reason: input.reason,
    invoices: invoices.map((inv) => ({
      id: String((inv as { id: string }).id),
      status: String((inv as { status: string }).status),
      regeneration_status: (inv as { regeneration_status?: string | null }).regeneration_status,
    })),
  });

  if (!invoiceResult.ok) {
    return { ok: false, error: invoiceResult.error };
  }

  const { error: updateError } = await supabase
    .from("campaign_headers")
    .update({ status: "cancelled" } as never)
    .eq("id", input.campaign_id);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  const { data: vendorIoRows } = await supabase
    .from("vendor_ios")
    .select("id, document_number, status")
    .eq("campaign_header_id", input.campaign_id);

  // Document Lifecycle: cancel outstanding Vendor/Client IOs only.
  // Accepted documents remain Accepted (legal history). Campaign Business State is separate.
  const { emitBusinessChangeEvent } = await import(
    "@/lib/document-lifecycle/business-change/emit"
  );
  const lifecycleResult = await emitBusinessChangeEvent(supabase, {
    eventType: "campaign_cancelled",
    reasonCode: "campaign_cancelled",
    reasonDetail: input.reason ?? "Campaign cancelled",
    campaignHeaderId: input.campaign_id,
    actorId: input.actor_id,
    payload: { campaign_cancelled: true },
  });

  if (!lifecycleResult.ok) {
    return { ok: false, error: lifecycleResult.error };
  }

  const cancelledVendorCount = lifecycleResult.reactions.filter(
    (r) => r.documentType === "vendor_io"
  ).length;
  const cancelledClientCount = lifecycleResult.reactions.filter(
    (r) => r.documentType === "client_io"
  ).length;

  for (const reaction of lifecycleResult.reactions) {
    if (reaction.documentType === "vendor_io") {
      const row = (vendorIoRows ?? []).find(
        (v) => (v as { id: string }).id === reaction.documentId
      ) as { id: string; document_number?: string } | undefined;
      await logFinanceAuditEvent(supabase, {
        event: FINANCE_AUDIT_EVENTS.vendor_io_cancelled,
        entity_type: "vendor_io",
        entity_id: reaction.documentId,
        actor_id: input.actor_id,
        old_data: { status: reaction.fromStatus },
        new_data: { status: "cancelled", campaign_cancelled: true },
        payload: {
          document_number: row?.document_number ?? null,
          campaign_id: input.campaign_id,
          reason_code: reaction.reasonCode,
        },
      });
      continue;
    }

    if (reaction.documentType === "client_io") {
      await logFinanceAuditEvent(supabase, {
        event: FINANCE_AUDIT_EVENTS.client_io_cancelled,
        entity_type: "client_io",
        entity_id: reaction.documentId,
        actor_id: input.actor_id,
        old_data: { status: reaction.fromStatus },
        new_data: { status: "cancelled", campaign_cancelled: true },
        payload: {
          document_number: null,
          campaign_id: input.campaign_id,
          reason_code: reaction.reasonCode,
        },
      });
    }
  }

  const { data: lines } = await supabase
    .from("campaign_lines")
    .select("id")
    .eq("campaign_header_id", input.campaign_id);

  const lineIds = (lines ?? []).map((l) => (l as { id: string }).id);
  if (lineIds.length > 0) {
    await supabase
      .from("campaign_lines")
      .update({ status: "cancelled", billing_status: "cancelled" } as never)
      .in("id", lineIds);
  }

  await logFinanceAuditEvent(supabase, {
    event: FINANCE_AUDIT_EVENTS.campaign_cancelled,
    entity_type: "campaign_headers",
    entity_id: input.campaign_id,
    actor_id: input.actor_id,
    old_data: { status: previousStatus },
    new_data: { status: "cancelled" },
    payload: {
      document_number: (header as { document_number: string }).document_number,
      reason: input.reason ?? null,
      vendor_io_count: cancelledVendorCount,
      client_io_count: cancelledClientCount,
      invoice_count: invoiceResult.count,
    },
  });

  return {
    ok: true,
    campaign_id: input.campaign_id,
    vendor_io_count: cancelledVendorCount,
    invoice_count: invoiceResult.count,
    client_io_count: cancelledClientCount,
  };
}

export async function reopenCampaign(
  supabase: SupabaseClient<Database>,
  input: {
    campaign_id: string;
    actor_id: string;
    target_status?: CampaignStatus;
    reason?: string;
  }
): Promise<CampaignCancellationResult> {
  const { data: header, error: headerError } = await supabase
    .from("campaign_headers")
    .select("id, document_number, status")
    .eq("id", input.campaign_id)
    .maybeSingle();

  if (headerError || !header) {
    return { ok: false, error: headerError?.message ?? "Campaign not found." };
  }

  const current = (header as { status: CampaignStatus }).status;
  if (current !== "cancelled") {
    return { ok: false, error: "Only cancelled campaigns can be reopened." };
  }

  const nextStatus = input.target_status ?? "active";

  const { error: updateError } = await supabase
    .from("campaign_headers")
    .update({ status: nextStatus } as never)
    .eq("id", input.campaign_id);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  await syncCampaignHeaderStatus(supabase, input.campaign_id);

  const { data: syncedHeader } = await supabase
    .from("campaign_headers")
    .select("status")
    .eq("id", input.campaign_id)
    .maybeSingle();

  const resolvedStatus =
    (syncedHeader as { status: CampaignStatus } | null)?.status ?? nextStatus;

  await logFinanceAuditEvent(supabase, {
    event: FINANCE_AUDIT_EVENTS.campaign_reopened,
    entity_type: "campaign_headers",
    entity_id: input.campaign_id,
    actor_id: input.actor_id,
    old_data: { status: current },
    new_data: { status: resolvedStatus },
    payload: {
      document_number: (header as { document_number: string }).document_number,
      reason: input.reason ?? null,
    },
  });

  return {
    ok: true,
    campaign_id: input.campaign_id,
    vendor_io_count: 0,
    invoice_count: 0,
    client_io_count: 0,
  };
}
