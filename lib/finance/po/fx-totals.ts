import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveOperationalPo } from "./operational-budget";
import type { PoStatus } from "./status";

export type CampaignPoFxTotals = {
  campaign_header_id: string;
  po_amount: number;
  po_consumed: number;
  po_rate: number | null;
};

export async function getCampaignPoFxTotals(supabase: SupabaseClient, ids: string[]) {
  const totals = new Map<string, CampaignPoFxTotals>();
  for (let offset = 0; offset < ids.length; offset += 200) {
    const { data, error } = await supabase.from("campaign_fx_po_totals")
      .select("campaign_header_id,po_amount,po_consumed,po_rate")
      .in("campaign_header_id", ids.slice(offset, offset + 200));
    if (error) throw new Error(`Cannot calculate PO currency totals: ${error.message}`);
    for (const row of data ?? []) totals.set(row.campaign_header_id, {
      campaign_header_id: row.campaign_header_id,
      po_amount: Number(row.po_amount), po_consumed: Number(row.po_consumed),
      po_rate: row.po_rate == null ? null : Number(row.po_rate),
    });
  }
  return totals;
}

export function resolveFxPoSummary(totals: CampaignPoFxTotals, header: {
  po_status: PoStatus; po_expiry_date: string | null;
}) {
  return resolveOperationalPo({
    po_amount_campaign_currency: totals.po_amount,
    po_consumed_amount: totals.po_consumed,
    legacy_budget: totals.po_amount, legacy_consumed: totals.po_consumed,
    po_status: header.po_status, po_expiry_date: header.po_expiry_date,
  });
}
