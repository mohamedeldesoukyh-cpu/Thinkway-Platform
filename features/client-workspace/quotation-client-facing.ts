import { fromEgp, toEgp } from "@/lib/commercial/fx-aggregation";

import { isPricedClientInvestment } from "./selection-flow";

export type ClientFacingQuotationPrice = {
  amount: number | undefined;
  currency: string;
  originalAmount?: number;
  originalCurrency?: string;
};

/**
 * Convert a quotation line's client revenue into the quotation header currency
 * using the existing commercial FX engine (`toEgp` / `fromEgp`).
 * Line `revenue` is stored in `cost_currency`; `revenue_egp` is the snapshotted EGP amount.
 */
export function convertLineRevenueToQuotationCurrency(input: {
  revenue: number;
  revenueEgp?: number;
  lineFxRateToEgp: number;
  quotationCurrency: string;
  quotationFxRateToEgp: number;
}): number {
  const egp =
    input.revenueEgp != null && Number.isFinite(input.revenueEgp) && input.revenueEgp > 0
      ? input.revenueEgp
      : toEgp(input.revenue, input.lineFxRateToEgp);
  return fromEgp(egp, input.quotationCurrency, input.quotationFxRateToEgp);
}

export function clientFacingQuotationPrice(input: {
  revenue: number | null | undefined;
  revenueEgp?: number | null;
  costCurrency?: string | null;
  lineFxRateToEgp?: number | null;
  quotationCurrency: string;
  quotationFxRateToEgp: number;
}): ClientFacingQuotationPrice {
  const quote = (input.quotationCurrency || "EGP").toUpperCase();
  if (!isPricedClientInvestment(input.revenue)) {
    return { amount: undefined, currency: quote };
  }
  const original = (input.costCurrency || quote).toUpperCase();
  const amount = convertLineRevenueToQuotationCurrency({
    revenue: input.revenue!,
    revenueEgp: input.revenueEgp ?? undefined,
    lineFxRateToEgp: input.lineFxRateToEgp ?? 1,
    quotationCurrency: quote,
    quotationFxRateToEgp: input.quotationFxRateToEgp,
  });
  if (original === quote) {
    return { amount, currency: quote };
  }
  return {
    amount,
    currency: quote,
    originalAmount: input.revenue!,
    originalCurrency: original,
  };
}

export function originalInvestmentForDisplay(
  creator: {
    originalInvestmentAmount?: number;
    originalInvestmentCurrency?: string;
  },
  quotationCurrency: string
): { amount: number; currency: string } | null {
  if (
    creator.originalInvestmentAmount == null ||
    !Number.isFinite(creator.originalInvestmentAmount) ||
    !creator.originalInvestmentCurrency?.trim()
  ) {
    return null;
  }
  if (creator.originalInvestmentCurrency.toUpperCase() === (quotationCurrency || "").toUpperCase()) {
    return null;
  }
  return { amount: creator.originalInvestmentAmount, currency: creator.originalInvestmentCurrency };
}
