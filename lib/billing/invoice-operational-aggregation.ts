import type { SupabaseClient } from "@supabase/supabase-js";

import { isActiveInvoiceForFinancialTotals } from "@/lib/billing/invoice-status";
import { devLog } from "@/lib/dev-log";

export type CampaignInvoiceLineRollup = {
  campaign_header_id: string;
  invoiced_subtotal: number;
  line_count: number;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Sum invoice_line_items.revenue_before_vat per campaign (non-void invoices). */
export async function loadCampaignInvoiceLineRollups(
  supabase: SupabaseClient,
  campaignHeaderIds: string[]
): Promise<Map<string, CampaignInvoiceLineRollup>> {
  const result = new Map<string, CampaignInvoiceLineRollup>();
  if (campaignHeaderIds.length === 0) return result;

  const { data, error } = await supabase
    .from("invoice_line_items")
    .select(
      "campaign_header_id, revenue_before_vat, invoice:invoices!inner(status, regeneration_status)"
    )
    .in("campaign_header_id", campaignHeaderIds);

  if (error) {
    if (process.env.NODE_ENV === "development") {
      devLog("[invoice-aggregation] line item rollup query failed", {
        error: error.message,
        campaignCount: campaignHeaderIds.length,
      });
    }
    return result;
  }

  for (const row of data ?? []) {
    const typed = row as unknown as {
      campaign_header_id: string | null;
      revenue_before_vat: number;
      invoice: { status: string; regeneration_status: string | null } | null;
    };
    if (!typed.campaign_header_id) continue;
    if (
      !typed.invoice ||
      !isActiveInvoiceForFinancialTotals({
        status: typed.invoice.status,
        regeneration_status: typed.invoice.regeneration_status,
      })
    ) {
      continue;
    }

    const amount = roundMoney(Number(typed.revenue_before_vat ?? 0));
    const existing = result.get(typed.campaign_header_id) ?? {
      campaign_header_id: typed.campaign_header_id,
      invoiced_subtotal: 0,
      line_count: 0,
    };
    existing.invoiced_subtotal = roundMoney(existing.invoiced_subtotal + amount);
    existing.line_count += 1;
    result.set(typed.campaign_header_id, existing);
  }

  if (process.env.NODE_ENV === "development") {
    devLog("[invoice-aggregation] campaign line rollups", {
      campaignCount: campaignHeaderIds.length,
      withLines: result.size,
    });
  }

  return result;
}

export function reconcileCampaignRollupWithInvoiceLines(input: {
  achieved_revenue: number;
  already_invoiced: number;
  remaining_to_invoice: number;
  unachieved_revenue: number;
  total_campaign_amount: number;
  invoice_line_invoiced: number;
}): {
  already_invoiced: number;
  remaining_to_invoice: number;
} {
  const operationalInvoiced = roundMoney(input.already_invoiced);
  const lineInvoiced = roundMoney(input.invoice_line_invoiced);
  const already_invoiced =
    lineInvoiced > 0 ? lineInvoiced : operationalInvoiced;
  const remaining_to_invoice = roundMoney(
    Math.max(0, input.total_campaign_amount - already_invoiced)
  );

  if (process.env.NODE_ENV === "development" && lineInvoiced !== operationalInvoiced) {
    devLog("[billing-sync] reconciled invoiced totals from active invoice_line_items", {
      operationalInvoiced,
      lineInvoiced,
      already_invoiced,
      remaining_to_invoice,
      total_campaign_amount: input.total_campaign_amount,
    });
  }

  return { already_invoiced, remaining_to_invoice };
}
