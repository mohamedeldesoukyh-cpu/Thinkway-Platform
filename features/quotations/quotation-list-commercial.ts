import type { QuotationListRow } from "./types";

/** Same client cost as the workspace: quoted revenue plus agency fees, in EGP. */
export function quotationListClientCost(
  row: Pick<QuotationListRow, "total_revenue_egp" | "total_af_egp">
): number {
  return Math.round((row.total_revenue_egp + (row.total_af_egp ?? 0) + Number.EPSILON) * 100) / 100;
}
