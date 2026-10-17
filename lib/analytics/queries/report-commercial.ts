import type { SupabaseClient } from "@supabase/supabase-js";
import { aggregateCampaignDisplayFinancials, requireReportingRate, type CampaignLineCommercialFxInput } from "@/lib/campaigns/campaign-display-financials";
import { creatorFxAmount } from "@/lib/commercial/creator-fx";
import { resolveRateToEgp } from "@/lib/commercial/fx-server";
import { resolveClientTaxableBase } from "@/lib/assignments/client-billing-commercial";
import { roundMoney } from "@/lib/analytics/aggregations/round";

const code = (value?: string | null) => (value || "EGP").trim().toUpperCase();

/** All detailed reports normalize independent client/vendor currencies to EGP
 * using the same negotiated FX rules as the campaign workspace. */
export function resolveReportCommercial(line: CampaignLineCommercialFxInput, rates: ReadonlyMap<string, number>, fallbackCurrency = "EGP") {
  const currency = code(line.currency_code || fallbackCurrency);
  const normalized = { ...line, currency_code: currency };
  const totals = aggregateCampaignDisplayFinancials({ lines: [normalized], displayCurrency: "EGP", rateToEgpByCurrency: rates });
  const base = Number(line.revenue_before_vat ?? line.revenue ?? 0);
  const ur = Number(line.usage_rights_amount ?? 0);
  const fee = roundMoney(resolveClientTaxableBase({ revenueBeforeVat: base, usageRightsAmount: ur,
    agencyFeeAmount: line.agency_fee_amount, agencyFeePercent: Number(line.agency_fee_percent ?? 0) }) - base - ur);
  const conversion = { from: currency, to: "EGP", sourceRateToEgp: requireReportingRate(rates, currency), targetRateToEgp: 1, override: line.revenue_fx_override };
  const ur_rev = creatorFxAmount(ur, conversion);
  const agency_fees = creatorFxAmount(fee, conversion);
  return { revenue: roundMoney(totals.revenue - ur_rev - agency_fees), ur_rev, agency_fees,
    cost: roundMoney(totals.revenue - totals.gp), gp: totals.gp };
}

export async function loadReportRates(supabase: SupabaseClient,
  lines: CampaignLineCommercialFxInput[], headers: { currency_code?: string | null }[]) {
  const currencies = new Set(["EGP", ...headers.map(h => code(h.currency_code))]);
  for (const line of lines) {
    currencies.add(code(line.currency_code));
    currencies.add(code(line.cost_received_currency || line.currency_code));
  }
  return new Map(await Promise.all([...currencies].map(async currency =>
    [currency, await resolveRateToEgp(supabase, currency)] as const)));
}
