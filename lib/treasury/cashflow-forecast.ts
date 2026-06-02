import { roundMoney } from "@/lib/analytics/aggregations/round";
import type { AgedInvoiceInput } from "@/lib/collections/aging";
import { invoiceOutstanding } from "@/lib/collections/aging";
import { devLog } from "@/lib/platform/logger";

export type CashflowPeriodPoint = {
  period_key: string;
  label: string;
  expected_in: number;
  expected_out: number;
  net: number;
};

export type CashflowForecastInput = {
  invoices: AgedInvoiceInput[];
  vendor_payable_total: number;
  planning_collections_forecast?: number;
  planning_payout_forecast?: number;
};

export type CashflowForecastResult = {
  weekly: CashflowPeriodPoint[];
  monthly: CashflowPeriodPoint[];
  expected_collections: number;
  expected_payouts: number;
  net_cashflow: number;
};

function addWeeks(start: Date, weeks: number): Date {
  const d = new Date(start);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function buildCashflowForecast(
  input: CashflowForecastInput
): CashflowForecastResult {
  const now = new Date();
  const weekly: CashflowPeriodPoint[] = [];
  const monthlyMap = new Map<string, CashflowPeriodPoint>();

  let expected_collections = 0;

  for (let w = 0; w < 8; w++) {
    const start = addWeeks(now, w);
    const end = addWeeks(now, w + 1);
    const key = `W${w + 1}`;
    let expected_in = 0;

    for (const inv of input.invoices) {
      const outstanding = invoiceOutstanding(inv.total, inv.amount_paid);
      if (outstanding <= 0 || !inv.due_date) continue;
      const due = new Date(`${inv.due_date}T00:00:00`);
      if (due >= start && due < end) {
        expected_in = roundMoney(expected_in + outstanding);
      }
    }

    const expected_out =
      w === 0 ? roundMoney(input.vendor_payable_total / 8) : 0;
    weekly.push({
      period_key: key,
      label: `Week ${w + 1}`,
      expected_in,
      expected_out,
      net: roundMoney(expected_in - expected_out),
    });
    expected_collections = roundMoney(expected_collections + expected_in);
  }

  if (input.planning_collections_forecast) {
    expected_collections = roundMoney(
      Math.max(expected_collections, input.planning_collections_forecast)
    );
  }

  for (const inv of input.invoices) {
    const outstanding = invoiceOutstanding(inv.total, inv.amount_paid);
    if (outstanding <= 0) continue;
    const due = inv.due_date ? new Date(`${inv.due_date}T00:00:00`) : now;
    const mk = monthKey(due);
    const existing = monthlyMap.get(mk) ?? {
      period_key: mk,
      label: mk,
      expected_in: 0,
      expected_out: 0,
      net: 0,
    };
    existing.expected_in = roundMoney(existing.expected_in + outstanding);
    existing.net = roundMoney(existing.expected_in - existing.expected_out);
    monthlyMap.set(mk, existing);
  }

  const expected_payouts = roundMoney(
    input.vendor_payable_total +
      (input.planning_payout_forecast ?? 0)
  );

  const monthly = [...monthlyMap.values()]
    .sort((a, b) => a.period_key.localeCompare(b.period_key))
    .slice(0, 6);

  for (const m of monthly) {
    m.expected_out = roundMoney(expected_payouts / Math.max(monthly.length, 1));
    m.net = roundMoney(m.expected_in - m.expected_out);
  }

  const net_cashflow = roundMoney(expected_collections - expected_payouts);

  if (process.env.NODE_ENV === "development") {
    devLog("[cashflow-forecast] built", { net_cashflow, weeks: weekly.length });
  }

  return {
    weekly,
    monthly,
    expected_collections,
    expected_payouts,
    net_cashflow,
  };
}
