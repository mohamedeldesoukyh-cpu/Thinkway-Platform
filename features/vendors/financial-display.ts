import { rollupLineClientCommercial } from "@/lib/assignments/client-billing-commercial";
import { resolveLineCostAmount, resolveLineCostCurrency, resolveLineRevenueCurrency, type CampaignLineCommercialFxInput } from "@/lib/campaigns/campaign-display-financials";
import type { VendorAssignmentRow, VendorPayoutRow } from "./types";
import { formatMoney, formatPercent } from "./utils";

export function creatorAssignmentCommercials(line: CampaignLineCommercialFxInput | null, fee: number, currency: string) {
  const revenueCurrency = resolveLineRevenueCurrency(line ?? {}, currency);
  const commercial = rollupLineClientCommercial({
    revenueBeforeVat: Number(line?.revenue_before_vat ?? line?.revenue ?? 0),
    costBeforeVat: Number(line?.cost_before_vat ?? line?.cost ?? fee),
    usageRightsAmount: Number(line?.usage_rights_amount ?? 0),
    usageRightsCost: Number(line?.usage_rights_cost ?? 0),
    agencyFeePercent: Number(line?.agency_fee_percent ?? 0),
    agencyFeeAmount: line?.agency_fee_amount,
  });
  return {
    revenue: commercial.billableBase,
    cost: line ? resolveLineCostAmount(line) : fee,
    gp: commercial.gp,
    revenue_currency: revenueCurrency,
    cost_currency: resolveLineCostCurrency(line ?? {}, currency),
    usage_rights_cost: Number(line?.usage_rights_cost ?? 0),
  };
}

export type CreatorFinancialDisplay = Record<"revenue" | "cost" | "gp" | "margin" | "invoiced" | "paid" | "pending", string>;
type MoneyPart = { amount: number; currency: string };
export function formatCreatorMoney(parts: MoneyPart[]): string {
  const totals = new Map<string, number>();
  for (const part of parts) {
    const currency = part.currency.trim().toUpperCase();
    totals.set(currency, (totals.get(currency) ?? 0) + part.amount);
  }
  return [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([currency, amount]) => formatMoney(amount, currency)).join(" · ") || "—";
}
export function assignmentCostParts(a: VendorAssignmentRow): MoneyPart[] {
  return [{ amount: a.cost, currency: a.cost_currency ?? a.currency }, ...(a.usage_rights_cost ? [{ amount: a.usage_rights_cost, currency: a.revenue_currency ?? a.currency }] : [])];
}
export function creatorFinancialDisplay(assignments: VendorAssignmentRow[], payouts: VendorPayoutRow[]): CreatorFinancialDisplay {
  const active = assignments.filter(a => a.status !== "cancelled" && a.campaign_status !== "cancelled");
  const revenue = (a: VendorAssignmentRow) => ({ amount: a.revenue, currency: a.revenue_currency ?? a.currency });
  const totals = new Map<string, { revenue: number; gp: number }>();
  for (const a of active) {
    const currency = a.revenue_currency ?? a.currency;
    const total = totals.get(currency) ?? { revenue: 0, gp: 0 };
    total.revenue += a.revenue; total.gp += a.gp; totals.set(currency, total);
  }
  return {
    revenue: formatCreatorMoney(active.map(revenue)),
    cost: formatCreatorMoney(active.flatMap(assignmentCostParts)),
    gp: formatCreatorMoney(active.map(a => ({ amount: a.gp, currency: a.revenue_currency ?? a.currency }))),
    margin: [...totals].map(([currency, t]) => `${totals.size > 1 ? currency + " " : ""}${t.revenue > 0 ? formatPercent(t.gp / t.revenue * 100) : "—"}`).join(" · ") || "—",
    invoiced: formatCreatorMoney(active.filter(a => a.billing_status && !["draft", "approved"].includes(a.billing_status)).map(revenue)),
    paid: formatCreatorMoney(payouts.map(p => ({ amount: p.paid_amount ?? (p.status === 'paid' ? p.amount : 0), currency: p.currency }))),
    pending: formatCreatorMoney(payouts.filter(p => p.status !== "cancelled").map(p => ({ amount: Math.max(0, p.amount - (p.paid_amount ?? (p.status === 'paid' ? p.amount : 0))), currency: p.currency }))),
  };
}

