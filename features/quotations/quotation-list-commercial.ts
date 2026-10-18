import type { QuotationListRow } from "./types";

/** Same client cost as the workspace: quoted revenue plus agency fees, in EGP. */
export function quotationListClientCost(
  row: Pick<QuotationListRow, "total_revenue_egp" | "total_af_egp">
): number {
  return Math.round((row.total_revenue_egp + (row.total_af_egp ?? 0) + Number.EPSILON) * 100) / 100;
}

/** Keep pipeline estimates separate from approved quotation totals. */
export function quotationListStatusTotals(rows: Pick<QuotationListRow, "status" | "total_revenue_egp" | "total_af_egp" | "total_cost_egp">[]) {
  const totals = { approved: { count: 0, revenue: 0, cost: 0 }, under_review: { count: 0, revenue: 0, cost: 0 }, draft: { count: 0, revenue: 0, cost: 0 } };
  for (const row of rows) {
    if (row.status !== "approved" && row.status !== "under_review" && row.status !== "draft") continue;
    const bucket = totals[row.status];
    bucket.count += 1;
    bucket.revenue += quotationListClientCost(row);
    bucket.cost += row.total_cost_egp;
  }
  return totals;
}
