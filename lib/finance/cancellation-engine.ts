import type { SupabaseClient } from "@supabase/supabase-js";

import { logFinanceAuditEvent } from "@/lib/finance/audit-log";
import { FINANCE_AUDIT_EVENTS } from "@/lib/finance/audit-events";
import { guardCampaignCancellation } from "@/lib/finance/integrity-guards";
import { isActiveInvoiceForFinancialTotals } from "@/lib/finance/status/invoice-status";
import type { Database } from "@/types/database";
import type { CampaignStatus } from "@/types/database";

export type CampaignCancellationResult =
  | { ok: true; campaign_id: string; vendor_io_count: number }
  | { ok: false; error: string };

export type CampaignCancellationPreview = {
  allowed: boolean;
  reason?: string;
  has_vendor_ios: boolean;
  vendor_io_count: number;
  active_invoice_count: number;
};

export async function previewCampaignCancellation(
  supabase: SupabaseClient<Database>,
  campaignId: string
): Promise<CampaignCancellationPreview> {
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, status, regeneration_status")
    .eq("campaign_header_id", campaignId);

  const activeInvoices = (invoices ?? []).filter((inv) =>
    isActiveInvoiceForFinancialTotals({
      status: String((inv as { status: string }).status),
      regeneration_status: (inv as { regeneration_status?: string }).regeneration_status,
    })
  );

  const guard = guardCampaignCancellation({
    invoices: (invoices ?? []).map((inv) => ({
      status: String((inv as { status: string }).status),
      regeneration_status: (inv as { regeneration_status?: string }).regeneration_status,
    })),
  });

  const { data: vendorIos } = await supabase
    .from("vendor_ios")
    .select("id")
    .eq("campaign_header_id", campaignId);

  const vendorIoCount = vendorIos?.length ?? 0;

  return {
    allowed: guard.allowed,
    reason: guard.allowed ? undefined : guard.reason,
    has_vendor_ios: vendorIoCount > 0,
    vendor_io_count: vendorIoCount,
    active_invoice_count: activeInvoices.length,
  };
}

export async function cancelCampaign(
  supabase: SupabaseClient<Database>,
  input: {
    campaign_id: string;
    actor_id: string;
    reason?: string;
  }
): Promise<CampaignCancellationResult> {
  const preview = await previewCampaignCancellation(supabase, input.campaign_id);
  if (!preview.allowed) {
    return { ok: false, error: preview.reason ?? "Campaign cannot be cancelled." };
  }

  const { data: header, error: headerError } = await supabase
    .from("campaign_headers")
    .select("id, document_number, status")
    .eq("id", input.campaign_id)
    .maybeSingle();

  if (headerError || !header) {
    return { ok: false, error: headerError?.message ?? "Campaign not found." };
  }

  const previousStatus = (header as { status: CampaignStatus }).status;

  const { error: updateError } = await supabase
    .from("campaign_headers")
    .update({ status: "cancelled" } as never)
    .eq("id", input.campaign_id);

  if (updateError) {
    return { ok: false, error: updateError.message };
  }

  const { data: vendorIos } = await supabase
    .from("vendor_ios")
    .select("id, document_number, status")
    .eq("campaign_header_id", input.campaign_id);

  const now = new Date().toISOString();
  for (const vio of vendorIos ?? []) {
    const row = vio as {
      id: string;
      document_number: string;
      status: string;
    };

    await supabase
      .from("vendor_ios")
      .update({
        status: "rejected",
        rejection_reason: input.reason ?? "Campaign cancelled",
      } as never)
      .eq("id", row.id);

    await logFinanceAuditEvent(supabase, {
      event: FINANCE_AUDIT_EVENTS.vendor_io_cancelled,
      entity_type: "vendor_io",
      entity_id: row.id,
      actor_id: input.actor_id,
      old_data: { status: row.status },
      new_data: { status: "rejected", campaign_cancelled: true },
      payload: {
        document_number: row.document_number,
        campaign_id: input.campaign_id,
      },
    });
  }

  const { data: lines } = await supabase
    .from("campaign_lines")
    .select("id")
    .eq("campaign_header_id", input.campaign_id);

  const lineIds = (lines ?? []).map((l) => (l as { id: string }).id);
  if (lineIds.length > 0) {
    await supabase
      .from("campaign_lines")
      .update({ billing_status: "cancelled" } as never)
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
      vendor_io_count: vendorIos?.length ?? 0,
    },
  });

  return {
    ok: true,
    campaign_id: input.campaign_id,
    vendor_io_count: vendorIos?.length ?? 0,
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

  await logFinanceAuditEvent(supabase, {
    event: FINANCE_AUDIT_EVENTS.campaign_reopened,
    entity_type: "campaign_headers",
    entity_id: input.campaign_id,
    actor_id: input.actor_id,
    old_data: { status: current },
    new_data: { status: nextStatus },
    payload: {
      document_number: (header as { document_number: string }).document_number,
      reason: input.reason ?? null,
    },
  });

  return {
    ok: true,
    campaign_id: input.campaign_id,
    vendor_io_count: 0,
  };
}
