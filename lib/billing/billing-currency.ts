import { creatorFxRate, creatorFxAmount } from "@/lib/commercial/creator-fx";
import type { OperationalBillingRow } from "./operational-billing-rows";

export const operationalMoneyFields = [
  "billable_amount", "invoiced_amount", "collected_amount", "remaining_amount",
  "revenue_before_vat", "usage_rights_amount", "agency_fee_amount",
] as const;
export type OperationalMoneyField = typeof operationalMoneyFields[number];
export type BillingSourceMoney = {
  currency: string;
  rate?: number;
  amounts: Partial<Record<OperationalMoneyField, number>>;
};

export function convertMoney(amount: number, source: string, target: string, rates: Record<string, number>): number {
  source = source.trim().toUpperCase(); target = target.trim().toUpperCase();
  if (!Number.isFinite(amount)) throw new Error("Invalid monetary amount");
  if (source === target) return amount;
  const from = source === "EGP" ? 1 : rates[source];
  const to = target === "EGP" ? 1 : rates[target];
  if (!Number.isFinite(from) || !Number.isFinite(to) || !(from > 0) || !(to > 0)) throw new Error(`Missing FX rate: ${source} → ${target}`);
  return Math.round((amount * from / to + Number.EPSILON) * 100) / 100;
}

/** Read projection only. Eligibility and coverage remain in original assignment units. */
export function projectBillingRows(rows: OperationalBillingRow[], target: string, rates: Record<string, number>, inherited?: string, inheritedFx?: string | null): OperationalBillingRow[] {
  return rows.map(row => {
    const source = row.source_money?.currency ?? row.currency_code ?? inherited;
    if (!source) throw new Error(`Missing source currency for billing row ${row.id}`);
    const override = row.revenue_fx_override ?? inheritedFx;
    const conversion = { from: source, to: target, sourceRateToEgp: rates[source], targetRateToEgp: rates[target], override };
    const amounts = row.source_money?.amounts ?? Object.fromEntries(operationalMoneyFields.map(key => [key, row[key]]));
    const converted = Object.fromEntries(operationalMoneyFields.filter(key => amounts[key] != null)
      .map(key => [key, creatorFxAmount(amounts[key]!, conversion)]));
    return { ...row, ...converted, currency_code: target, source_money: { currency: source, amounts, rate: creatorFxRate(conversion) },
      children: projectBillingRows(row.children, target, rates, source, override) };
  });
}

/** Percent selection is currency independent; allocations submitted to billing are native. */
export function originalBillingRows(rows: OperationalBillingRow[]): OperationalBillingRow[] {
  return rows.map(row => ({ ...row, ...row.source_money?.amounts,
    currency_code: row.source_money?.currency ?? row.currency_code,
    source_money: undefined, children: originalBillingRows(row.children) }));
}
