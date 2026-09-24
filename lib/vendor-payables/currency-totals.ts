import { roundMoney } from "../analytics/aggregations/round";
import type { VendorPayableRow } from "./load-payables";

/** Native amounts must only be added within the same currency. */
export function payableCurrencyTotals(
  rows: Pick<VendorPayableRow, "currency" | "agreed_fee" | "status">[]
) {
  const groups = new Map<string, { currency: string; pending: number; paid: number; pendingCount: number; paidCount: number }>();
  for (const row of rows) {
    const currency = row.currency?.trim().toUpperCase() || "Unspecified currency";
    const group = groups.get(currency) ?? { currency, pending: 0, paid: 0, pendingCount: 0, paidCount: 0 };
    if (row.status === "paid") {
      group.paid += row.agreed_fee;
      group.paidCount += 1;
    } else {
      group.pending += row.agreed_fee;
      group.pendingCount += 1;
    }
    groups.set(currency, group);
  }
  return [...groups.values()].sort((a, b) => a.currency.localeCompare(b.currency)).map((group) => ({
    ...group,
    pending: roundMoney(group.pending),
    paid: roundMoney(group.paid),
  }));
}
