import { creatorFxRate } from "@/lib/commercial/creator-fx";
import { computeQuotationRowComputed, type QuotationRowDraft } from "@/features/quotations/quotation-row-math";

/** Describe the same revenue-side rates used by computeQuotationDisplayTotals. */
export function quotationAppliedRates(rows: QuotationRowDraft[], currency: string, rateToEgp: number): string[] {
  const grouped = new Map<string, number[]>();
  for (const row of rows) {
    const amounts = computeQuotationRowComputed(row);
    if (amounts.revenue === 0 && amounts.afValue === 0) continue;
    const rate = creatorFxRate({ from: row.costCurrency, to: currency, sourceRateToEgp: row.fxRateToEgp, targetRateToEgp: rateToEgp, override: row.revenueFxOverride });
    const rates = grouped.get(row.costCurrency) ?? [];
    rates.push(rate);
    grouped.set(row.costCurrency, rates);
  }
  const format = (rate: number) => rate.toLocaleString("en-US", { maximumFractionDigits: 8 });
  return [...grouped].sort(([a], [b]) => a.localeCompare(b)).map(([from, rates]) => {
    if (from === currency) return `${currency} amounts unchanged`;
    const min = Math.min(...rates), max = Math.max(...rates);
    return Math.abs(max - min) < 1e-10
      ? `1 ${from} = ${format(min)} ${currency}`
      : `1 ${from} = ${format(min)}–${format(max)} ${currency} (varies by line)`;
  });
}
