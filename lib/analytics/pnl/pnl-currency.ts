import { roundMoney } from "@/lib/analytics/aggregations/round";
import { DEFAULT_PLATFORM_CURRENCY } from "@/lib/master-data/default-currency";

import type { PnlLineFact } from "@/lib/analytics/pnl/pnl-report-types";

export const PNL_DEFAULT_DISPLAY_CURRENCY = DEFAULT_PLATFORM_CURRENCY;

export const PNL_FALLBACK_DISPLAY_CURRENCIES = [
  "EGP",
  "USD",
  "EUR",
  "GBP",
  "AED",
  "SAR",
] as const;

export function normalizePnlDisplayCurrency(
  value: string | undefined,
  available: string[]
): string {
  const normalized = (value ?? PNL_DEFAULT_DISPLAY_CURRENCY).trim().toUpperCase();
  if (available.includes(normalized)) {
    return normalized;
  }
  if (available.includes(PNL_DEFAULT_DISPLAY_CURRENCY)) {
    return PNL_DEFAULT_DISPLAY_CURRENCY;
  }
  return available[0] ?? PNL_DEFAULT_DISPLAY_CURRENCY;
}

export async function convertPnlFactsToDisplayCurrency(
  facts: PnlLineFact[],
  displayCurrency: string,
  resolveRate: (fromCurrency: string, toCurrency: string) => Promise<number>
): Promise<PnlLineFact[]> {
  const target = displayCurrency.toUpperCase();
  const sources = [
    ...new Set(facts.map((fact) => (fact.currency_code ?? "USD").trim().toUpperCase())),
  ];

  const rateBySource = new Map<string, number>();
  await Promise.all(
    sources.map(async (source) => {
      if (source === target) {
        rateBySource.set(source, 1);
        return;
      }
      const rate = await resolveRate(source, target);
      rateBySource.set(source, rate);
    })
  );

  return facts.map((fact) => {
    const source = (fact.currency_code ?? "USD").trim().toUpperCase();
    const rate = rateBySource.get(source) ?? 1;
    return {
      ...fact,
      revenue: roundMoney(fact.revenue * rate),
      ur_rev: roundMoney(fact.ur_rev * rate),
      agency_fees: roundMoney(fact.agency_fees * rate),
      cost: roundMoney(fact.cost * rate),
      gp: roundMoney(fact.gp * rate),
      vr_refund: roundMoney(fact.vr_refund * rate),
      gp_after_vr: roundMoney(fact.gp_after_vr * rate),
      currency_code: target,
    };
  });
}
