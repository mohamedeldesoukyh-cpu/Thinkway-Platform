import type { SupabaseClient } from "@supabase/supabase-js";

import { syncQuotationChangeToShortlist } from "@/lib/commercial-sync/engine";
import { resolveRateToEgp } from "@/lib/commercial/fx-server";
import { normalizeCommercialLine, computeQuotationTotals } from "@/lib/commercial/quotation-engine";
import type { CommercialInputMode, Database } from "@/types/database";

import type { QuotationDeliverable } from "@/lib/domains/commercial/quotation-types";

import {
  fetchQuotationItemEgpTotals,
  updateQuotationHeaderRecord,
} from "./repositories/quotation-repository";

export async function recomputeQuotationTotals(
  supabase: SupabaseClient<Database>,
  quotationId: string
) {
  const { data } = await fetchQuotationItemEgpTotals(supabase, quotationId);

  const totals = computeQuotationTotals(
    (data ?? []).map((r) => ({
      cost_egp: Number((r as { cost_egp: number }).cost_egp ?? 0),
      revenue_egp: Number((r as { revenue_egp: number }).revenue_egp ?? 0),
      gp_value_egp: Number((r as { gp_value_egp: number }).gp_value_egp ?? 0),
      af_value_egp: Number((r as { af_value_egp: number }).af_value_egp ?? 0),
    }))
  );

  await updateQuotationHeaderRecord(supabase, quotationId, {
    total_cost_egp: totals.totalCostEgp,
    total_revenue_egp: totals.totalRevenueEgp,
    total_gp_value_egp: totals.totalGpValueEgp,
    total_gp_pct: totals.totalGpPct,
    total_af_egp: totals.totalAfValueEgp,
    total_agency_margin_egp: totals.totalAgencyMarginEgp,
  });

  return totals;
}

export async function updateQuotationItemCommercials(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: {
    item_id: string;
    quotation_id: string;
    mode: CommercialInputMode;
    cost: number | null;
    cost_currency: string;
    gp_pct?: number | null;
    revenue?: number | null;
    gp_value?: number | null;
    af_pct?: number | null;
    deliverables?: QuotationDeliverable[];
  }
) {
  const rate = await resolveRateToEgp(supabase, input.cost_currency);
  const line = normalizeCommercialLine({
    mode: input.mode,
    cost: input.cost,
    costCurrency: input.cost_currency,
    gpPct: input.gp_pct,
    revenue: input.revenue,
    gpValue: input.gp_value,
    afPct: input.af_pct,
    fxRateToEgp: rate,
  });

  const patch: Record<string, unknown> = {
    commercial_input_mode: line.commercial_input_mode,
    cost: line.cost,
    cost_currency: line.cost_currency,
    revenue: line.revenue,
    gp_pct: line.gp_pct,
    gp_value: line.gp_value,
    af_pct: line.af_pct,
    af_value: line.af_value,
    fx_rate_to_egp: line.fx_rate_to_egp,
    cost_egp: line.cost_egp,
    revenue_egp: line.revenue_egp,
    gp_value_egp: line.gp_value_egp,
    af_value_egp: line.af_value_egp,
  };
  if (input.deliverables) patch.deliverables = input.deliverables;

  const { error } = await supabase
    .from("quotation_items")
    .update(patch as never)
    .eq("id", input.item_id);
  if (error) return { ok: false as const, message: error.message };

  const totals = await recomputeQuotationTotals(supabase, input.quotation_id);
  await syncQuotationChangeToShortlist(supabase, {
    quotationId: input.quotation_id,
    actorId: userId,
    quotationItemId: input.item_id,
    event: input.deliverables ? "deliverables" : "commercial",
  });

  return {
    ok: true as const,
    totals,
    fx_rate_to_egp: line.fx_rate_to_egp,
  };
}

export async function removeQuotationItemWithSync(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: { item_id: string; quotation_id: string }
) {
  await syncQuotationChangeToShortlist(supabase, {
    quotationId: input.quotation_id,
    actorId: userId,
    quotationItemId: input.item_id,
    event: "remove",
  });

  const { error } = await supabase
    .from("quotation_items")
    .delete()
    .eq("id", input.item_id);
  if (error) return { ok: false as const, message: error.message };

  await recomputeQuotationTotals(supabase, input.quotation_id);
  return { ok: true as const };
}
