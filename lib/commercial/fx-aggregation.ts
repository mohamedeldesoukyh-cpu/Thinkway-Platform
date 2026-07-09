/**
 * Pure FX conversion + EGP aggregation for commercials (no DB).
 *
 * The platform reporting currency is EGP. Each line carries a cost in its own
 * entry currency plus an FX rate to EGP (resolved server-side via the existing
 * `resolve_effective_exchange_rate` RPC and snapshotted on the row). This module
 * converts and aggregates line totals into EGP — it never fetches rates itself.
 */

export const REPORTING_CURRENCY = "EGP" as const;

/** Currencies offered for cost entry (spec §5). EGP is the default. */
export const COMMERCIAL_CURRENCIES = [
  "EGP",
  "USD",
  "AED",
  "SAR",
  "EUR",
  "GBP",
] as const;

import type {
  CommercialCurrency,
  CommercialLineEgp,
  CommercialTotals,
} from "@/lib/domains/commercial/types";

export type {
  CommercialCurrency,
  CommercialLineEgp,
  CommercialTotals,
} from "@/lib/domains/commercial/types";

export function isCommercialCurrency(code: string): code is CommercialCurrency {
  return (COMMERCIAL_CURRENCIES as readonly string[]).includes(code);
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}
function safe(value: number | null | undefined): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Convert an amount in `fromCurrency` to EGP using a pre-resolved rate. */
export function toEgp(amount: number | null | undefined, fxRateToEgp: number | null | undefined): number {
  const rate = safe(fxRateToEgp);
  // Identity when rate missing/invalid keeps totals safe rather than zeroing data.
  const effective = rate > 0 ? rate : 1;
  return round2(safe(amount) * effective);
}

/** Display helper: "500 USD / 25,000 EGP" style dual-currency string. */
export function formatDualCurrency(input: {
  amount: number;
  currency: string;
  egpAmount: number;
}): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
  if (input.currency === REPORTING_CURRENCY) {
    return `${fmt(input.egpAmount)} EGP`;
  }
  return `${fmt(input.amount)} ${input.currency} / ${fmt(input.egpAmount)} EGP`;
}

/**
 * Aggregate already-converted EGP line values into quotation/shortlist totals.
 * Blended GP% is computed from the EGP totals (NOT a naive average of line GP%),
 * so it stays correct across mixed currencies and costs.
 */
export function aggregateEgpTotals(lines: CommercialLineEgp[]): CommercialTotals {
  const totalCostEgp = round2(lines.reduce((sum, l) => sum + safe(l.costEgp), 0));
  const totalRevenueEgp = round2(lines.reduce((sum, l) => sum + safe(l.revenueEgp), 0));
  // Header GP must match Total Revenue − Total Cost (not a naive sum of line GP values,
  // which can drift when FX rounding is applied per field).
  const totalGpValueEgp = round2(totalRevenueEgp - totalCostEgp);
  const totalGpPct =
    totalRevenueEgp === 0 ? 0 : round4((totalGpValueEgp / totalRevenueEgp) * 100);
  const totalPmPct =
    totalCostEgp === 0 ? 0 : round4((totalGpValueEgp / totalCostEgp) * 100);
  const totalAfValueEgp = round2(
    lines.reduce((sum, l) => sum + safe(l.afValueEgp ?? 0), 0)
  );
  const totalAgencyMarginEgp = round2(totalGpValueEgp + totalAfValueEgp);

  return {
    totalCostEgp,
    totalRevenueEgp,
    totalGpValueEgp,
    totalGpPct,
    totalPmPct,
    totalAfValueEgp,
    totalAgencyMarginEgp,
    lineCount: lines.length,
  };
}
