import { fromEgp, toEgp } from "@/lib/commercial/fx-aggregation";
import { rollupLineClientCommercial } from "@/lib/assignments/client-billing-commercial";
import { formatMarginPercent } from "@/lib/domains/billing/types";

export type CampaignLineCommercialFxInput = {
  revenue?: number | null;
  cost?: number | null;
  revenue_before_vat?: number | null;
  cost_before_vat?: number | null;
  usage_rights_amount?: number | null;
  usage_rights_cost?: number | null;
  agency_fee_percent?: number | null;
  agency_fee_amount?: number | null;
  currency_code?: string | null;
  cost_received?: number | null;
  cost_received_currency?: string | null;
};

/**
 * Resolve the currency a line's client revenue / AF commercial is expressed in.
 * Entry currencies on lines are independent of the campaign invoice/display CCY.
 */
export function resolveLineRevenueCurrency(
  line: CampaignLineCommercialFxInput,
  fallbackCurrency: string
): string {
  return (line.currency_code || fallbackCurrency || "EGP").trim().toUpperCase() || "EGP";
}

/**
 * Prefer vendor cost-received currency when present; otherwise line / campaign CCY.
 */
export function resolveLineCostCurrency(
  line: CampaignLineCommercialFxInput,
  fallbackCurrency: string
): string {
  return (
    (line.cost_received_currency || line.currency_code || fallbackCurrency || "EGP")
      .trim()
      .toUpperCase() || "EGP"
  );
}

export function resolveLineCostAmount(line: CampaignLineCommercialFxInput): number {
  if (line.cost_received != null && Number.isFinite(Number(line.cost_received))) {
    return Math.max(0, Number(line.cost_received));
  }
  return Math.max(0, Number(line.cost_before_vat ?? line.cost ?? 0));
}

export type CampaignDisplayFinancials = {
  /** Invoice / view currency (campaign header CCY). */
  currency_code: string;
  /** FX rate for display currency → EGP. */
  display_fx_rate_to_egp: number;
  revenue: number;
  cost: number;
  gp: number;
  margin_percent: number;
  revenue_egp: number;
  cost_egp: number;
  gp_egp: number;
  /** Unconverted numeric rollup (legacy PO consumption base). */
  native_billable_base: number;
  native_cost: number;
};

/**
 * Aggregate line commercials into EGP, then project into the campaign invoice/display CCY.
 * Line entry currencies (cost received, line currency) stay independent of display CCY.
 */
export function aggregateCampaignDisplayFinancials(input: {
  lines: CampaignLineCommercialFxInput[];
  displayCurrency: string;
  /** Map of currency code → rate to EGP. Missing rates treated as identity (1). */
  rateToEgpByCurrency: ReadonlyMap<string, number>;
}): CampaignDisplayFinancials {
  const displayCurrency =
    (input.displayCurrency || "EGP").trim().toUpperCase() || "EGP";
  const displayRate = input.rateToEgpByCurrency.get(displayCurrency) ?? 1;

  let revenueEgp = 0;
  let costEgp = 0;
  let urCostEgp = 0;
  let nativeBillable = 0;
  let nativeCost = 0;

  for (const line of input.lines) {
    const revenueBeforeVat = Number(line.revenue_before_vat ?? line.revenue ?? 0);
    const usageRightsAmount = Number(line.usage_rights_amount ?? 0);
    const usageRightsCost = Number(line.usage_rights_cost ?? 0);
    const agencyFeePercent = Number(line.agency_fee_percent ?? 0);
    const agencyFeeAmount = Number(line.agency_fee_amount ?? 0);
    const costBeforeVat = Number(line.cost_before_vat ?? line.cost ?? 0);
    const commercial = rollupLineClientCommercial({
      revenueBeforeVat,
      usageRightsAmount,
      usageRightsCost,
      agencyFeePercent,
      agencyFeeAmount,
      costBeforeVat,
    });

    const revCcy = resolveLineRevenueCurrency(line, displayCurrency);
    const costCcy = resolveLineCostCurrency(line, displayCurrency);
    const costAmount = resolveLineCostAmount(line);
    const revRate = input.rateToEgpByCurrency.get(revCcy) ?? 1;
    const costRate = input.rateToEgpByCurrency.get(costCcy) ?? 1;

    revenueEgp += toEgp(commercial.billableBase, revRate);
    costEgp += toEgp(costAmount, costRate);
    // UR cost follows client commercial currency (same as revenue / AF).
    urCostEgp += toEgp(usageRightsCost, revRate);
    nativeBillable += commercial.billableBase;
    nativeCost += costBeforeVat;
  }

  revenueEgp = Math.round(revenueEgp * 100) / 100;
  costEgp = Math.round(costEgp * 100) / 100;
  urCostEgp = Math.round(urCostEgp * 100) / 100;
  // Cost KPI = vendor cost only; GP also deducts UR cost (quotation / line rollup semantics).
  const gpEgp = Math.round((revenueEgp - costEgp - urCostEgp) * 100) / 100;

  const revenue = fromEgp(revenueEgp, displayCurrency, displayRate);
  const cost = fromEgp(costEgp, displayCurrency, displayRate);
  const gp = fromEgp(gpEgp, displayCurrency, displayRate);

  return {
    currency_code: displayCurrency,
    display_fx_rate_to_egp: displayRate,
    revenue,
    cost,
    gp,
    margin_percent: formatMarginPercent(revenue, gp),
    revenue_egp: revenueEgp,
    cost_egp: costEgp,
    gp_egp: gpEgp,
    native_billable_base: Math.round(nativeBillable * 100) / 100,
    native_cost: Math.round(nativeCost * 100) / 100,
  };
}
