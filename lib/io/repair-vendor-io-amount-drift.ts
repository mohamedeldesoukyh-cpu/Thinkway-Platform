import type { SupabaseClient } from "@supabase/supabase-js";

import { hasActiveFinanceOverride } from "@/lib/campaigns/finance-override";
import { devLog } from "@/lib/dev-log";
import {
  findVendorIoAmountDriftForCampaign,
  type VendorIoAmountDriftRow,
} from "@/lib/io/vendor-io-amount-drift";
import { reviseVendorIoBatch } from "@/lib/io/revise-vendor-io-batch";

async function filterDriftSafeForAutoRevision(
  supabase: SupabaseClient,
  driftRows: VendorIoAmountDriftRow[]
): Promise<VendorIoAmountDriftRow[]> {
  if (driftRows.length === 0) return [];

  const lineIds = driftRows.map((r) => r.line_id);
  const { data: lines } = await supabase
    .from("campaign_lines")
    .select("id, invoice_id, finance_override_until")
    .in("id", lineIds);

  const lineById = new Map(
    (lines ?? []).map((row) => {
      const typed = row as {
        id: string;
        invoice_id: string | null;
        finance_override_until: string | null;
      };
      return [typed.id, typed] as const;
    })
  );

  const invoiceIds = [
    ...new Set(
      [...lineById.values()]
        .map((l) => l.invoice_id)
        .filter(Boolean) as string[]
    ),
  ];

  const pendingRegenInvoiceIds = new Set<string>();
  if (invoiceIds.length > 0) {
    const { data: invoices } = await supabase
      .from("invoices")
      .select("id, regeneration_status")
      .in("id", invoiceIds);

    for (const inv of invoices ?? []) {
      const typed = inv as { id: string; regeneration_status: string | null };
      if (typed.regeneration_status === "pending_regeneration") {
        pendingRegenInvoiceIds.add(typed.id);
      }
    }
  }

  return driftRows.filter((drift) => {
    const line = lineById.get(drift.line_id);
    if (!line) return false;
    if (!line.invoice_id) return true;
    if (hasActiveFinanceOverride(line.finance_override_until)) return true;
    return pendingRegenInvoiceIds.has(line.invoice_id);
  });
}

/**
 * Auto-revise Vendor IO when stored amount drifted from line creator cost.
 * Runs on campaign workspace load (same pattern as invoice orphan repair).
 */
export async function repairVendorIoAmountDrift(
  supabase: SupabaseClient,
  campaignHeaderId: string,
  actorUserId: string | null
): Promise<{ revised_line_ids: string[] }> {
  if (!actorUserId) {
    return { revised_line_ids: [] };
  }

  const driftRows = await filterDriftSafeForAutoRevision(
    supabase,
    await findVendorIoAmountDriftForCampaign(supabase, campaignHeaderId)
  );
  if (driftRows.length === 0) {
    return { revised_line_ids: [] };
  }

  const lineIds = [...new Set(driftRows.map((r) => r.line_id))];

  const result = await reviseVendorIoBatch(supabase, {
    campaignId: campaignHeaderId,
    lineIds,
    reason: "Auto-sync creator cost to Vendor IO amount",
    userId: actorUserId,
  });

  if (!result.ok) {
    devLog("[repair-vendor-io-amount] revision failed", {
      campaignHeaderId,
      lineIds,
      error: result.error,
    });
    return { revised_line_ids: [] };
  }

  devLog("[repair-vendor-io-amount] revised drift", {
    campaignHeaderId,
    revised_line_ids: result.revised_line_ids,
    drift: driftRows.map((r) => ({
      line_id: r.line_id,
      cost: r.line_cost_before_vat,
      vio_amount: r.vendor_io_amount,
    })),
  });

  return { revised_line_ids: result.revised_line_ids };
}
