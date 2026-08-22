import { fromEgp, toEgp } from "@/lib/commercial/fx-aggregation";
import { computeAgencyFee } from "@/lib/commercial/commercial-engine";

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

export function convertClientFacingAmount(input: {
  amount: number | null | undefined;
  amountEgp?: number | null;
  costCurrency?: string | null;
  lineFxRateToEgp?: number | null;
  quotationCurrency: string;
  quotationFxRateToEgp: number;
}): number {
  const value = Number(input.amount);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return convertLineRevenueToQuotationCurrency({
    revenue: value,
    revenueEgp: input.amountEgp ?? undefined,
    lineFxRateToEgp: input.lineFxRateToEgp ?? 1,
    quotationCurrency: (input.quotationCurrency || "EGP").toUpperCase(),
    quotationFxRateToEgp: input.quotationFxRateToEgp,
  });
}

export function clientFacingAgencyFeeFromLine(input: {
  afValue: number | null | undefined;
  afValueEgp?: number | null;
  afPct?: number | null;
  convertedRevenue: number;
  costCurrency?: string | null;
  lineFxRateToEgp?: number | null;
  quotationCurrency: string;
  quotationFxRateToEgp: number;
}): number {
  const stored = convertClientFacingAmount({
    amount: input.afValue,
    amountEgp: input.afValueEgp,
    costCurrency: input.costCurrency,
    lineFxRateToEgp: input.lineFxRateToEgp,
    quotationCurrency: input.quotationCurrency,
    quotationFxRateToEgp: input.quotationFxRateToEgp,
  });
  if (stored > 0) return stored;
  if (input.convertedRevenue > 0 && Number(input.afPct) > 0) {
    return computeAgencyFee({ revenue: input.convertedRevenue, afPct: input.afPct }).afValue;
  }
  return 0;
}

export type ClientFacingCreatorCardAmounts = {
  investmentAmount?: number | null;
  agencyFeeAmount?: number | null;
  usageRightsAmount?: number | null;
  originalInvestmentAmount?: number;
  originalInvestmentCurrency?: string;
};

function additiveClientFacingExtra(amount: number | null | undefined): number {
  const value = Number(amount);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** Display-only card total: client cost + agency fees + usage rights. Calculator keeps the split. */
export function clientFacingCreatorCardAmount(
  creator: Pick<ClientFacingCreatorCardAmounts, "investmentAmount" | "agencyFeeAmount" | "usageRightsAmount">
): number | undefined {
  if (!isPricedClientInvestment(creator.investmentAmount)) return undefined;
  return (
    (creator.investmentAmount ?? 0) +
    additiveClientFacingExtra(creator.agencyFeeAmount) +
    additiveClientFacingExtra(creator.usageRightsAmount)
  );
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

export function originalClientFacingCreatorCardAmount(
  creator: ClientFacingCreatorCardAmounts,
  quotationCurrency: string
): { amount: number; currency: string } | null {
  const original = originalInvestmentForDisplay(creator, quotationCurrency);
  if (!original) return null;
  const base = creator.investmentAmount ?? 0;
  const card = clientFacingCreatorCardAmount(creator);
  if (!card || base <= 0 || card === base) return original;
  return { amount: original.amount * (card / base), currency: original.currency };
}
