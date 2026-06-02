import {
  ACHIEVED_LINE_STATUSES,
  INVOICED_LINE_STATUSES,
} from "@/lib/analytics/metrics/definitions";
import { roundMoney } from "@/lib/analytics/aggregations/round";
import type { FinancialMetrics } from "@/lib/analytics/types/metrics";
import type { CampaignLineBillingStatus } from "@/features/billing/types";

export type LineFinancialInput = {
  revenue: number;
  cost: number;
  profit: number;
  billing_status: CampaignLineBillingStatus;
  po_amount?: number;
  po_consumed?: number;
};

export function computeMarginPercent(revenue: number, gp: number): number {
  if (revenue <= 0) return 0;
  return Math.round((gp / revenue) * 10000) / 100;
}

export function lineAchievedRevenue(line: LineFinancialInput): number {
  return ACHIEVED_LINE_STATUSES.has(line.billing_status)
    ? roundMoney(line.revenue)
    : 0;
}

export function linePlannedRevenue(line: LineFinancialInput): number {
  return roundMoney(line.revenue);
}

export function lineLegacyInvoicedRevenue(line: LineFinancialInput): number {
  return INVOICED_LINE_STATUSES.has(line.billing_status)
    ? roundMoney(line.revenue)
    : 0;
}

export function emptyFinancialMetrics(): FinancialMetrics {
  return {
    revenue: 0,
    cost: 0,
    gp: 0,
    margin_percent: 0,
    achieved_revenue: 0,
    unachieved_revenue: 0,
    invoiced_revenue: 0,
    collected_revenue: 0,
    outstanding_revenue: 0,
    vendor_payable: 0,
    remaining_to_invoice: 0,
    budget_amount: 0,
    actual_amount: 0,
    budget_variance: 0,
  };
}

export function mergeFinancialMetrics(
  base: FinancialMetrics,
  add: Partial<FinancialMetrics>
): FinancialMetrics {
  const revenue = roundMoney(base.revenue + (add.revenue ?? 0));
  const cost = roundMoney(base.cost + (add.cost ?? 0));
  const gp = roundMoney(base.gp + (add.gp ?? 0));
  const achieved_revenue = roundMoney(
    base.achieved_revenue + (add.achieved_revenue ?? 0)
  );
  const invoiced_revenue = roundMoney(
    base.invoiced_revenue + (add.invoiced_revenue ?? 0)
  );
  const collected_revenue = roundMoney(
    base.collected_revenue + (add.collected_revenue ?? 0)
  );
  const outstanding_revenue = roundMoney(
    base.outstanding_revenue + (add.outstanding_revenue ?? 0)
  );
  const vendor_payable = roundMoney(
    base.vendor_payable + (add.vendor_payable ?? 0)
  );
  const unachieved_revenue = roundMoney(
    Math.max(0, revenue - achieved_revenue)
  );
  const remaining_to_invoice = roundMoney(
    Math.max(0, achieved_revenue - invoiced_revenue)
  );
  const budget_amount = roundMoney(base.budget_amount + (add.budget_amount ?? 0));
  const actual_amount = roundMoney(base.actual_amount + (add.actual_amount ?? 0));

  return {
    revenue,
    cost,
    gp,
    margin_percent: computeMarginPercent(revenue, gp),
    achieved_revenue,
    unachieved_revenue,
    invoiced_revenue,
    collected_revenue,
    outstanding_revenue,
    vendor_payable,
    remaining_to_invoice,
    budget_amount,
    actual_amount,
    budget_variance: roundMoney(budget_amount - actual_amount),
  };
}

export function metricsFromCampaignLines(
  lines: LineFinancialInput[],
  invoicedFromLineItems: number
): FinancialMetrics {
  let metrics = emptyFinancialMetrics();

  for (const line of lines) {
    const revenue = linePlannedRevenue(line);
    const cost = roundMoney(line.cost);
    const gp = roundMoney(line.profit);
    const achieved = lineAchievedRevenue(line);

    metrics = mergeFinancialMetrics(metrics, {
      revenue,
      cost,
      gp,
      achieved_revenue: achieved,
      budget_amount: roundMoney(line.po_amount ?? 0),
      actual_amount: roundMoney(line.po_consumed ?? line.cost),
    });
  }

  const invoiced_revenue = roundMoney(
    Math.max(invoicedFromLineItems, metrics.invoiced_revenue)
  );

  return {
    ...metrics,
    invoiced_revenue,
    remaining_to_invoice: roundMoney(
      Math.max(0, metrics.achieved_revenue - invoiced_revenue)
    ),
  };
}

export function applyInvoiceCollectionMetrics(
  metrics: FinancialMetrics,
  input: { collected: number; outstanding: number }
): FinancialMetrics {
  return {
    ...metrics,
    collected_revenue: roundMoney(input.collected),
    outstanding_revenue: roundMoney(input.outstanding),
  };
}
