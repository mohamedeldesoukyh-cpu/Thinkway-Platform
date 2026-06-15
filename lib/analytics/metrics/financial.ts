import {
  ACHIEVED_LINE_STATUSES,
  INVOICED_LINE_STATUSES,
} from "@/lib/analytics/metrics/definitions";
import { roundMoney } from "@/lib/analytics/aggregations/round";
import { rollupLineClientCommercial } from "@/lib/assignments/client-billing-commercial";
import type { FinancialMetrics } from "@/lib/analytics/types/metrics";
import type { CampaignLineBillingStatus } from "@/features/billing/types";

export type LineFinancialInput = {
  revenue: number;
  cost: number;
  profit: number;
  billing_status: CampaignLineBillingStatus;
  po_amount?: number;
  po_consumed?: number;
  revenue_before_vat?: number | null;
  usage_rights_amount?: number | null;
  usage_rights_cost?: number | null;
  agency_fee_percent?: number | null;
  agency_fee_amount?: number | null;
  cost_before_vat?: number | null;
};

/** Billable revenue (Rev + UR + AF), cost, and GP aligned with assignments/billing. */
export function resolveLineCommercialMetrics(line: LineFinancialInput): {
  revenue: number;
  cost: number;
  gp: number;
} {
  const hasCommercialBreakdown =
    line.revenue_before_vat != null ||
    line.usage_rights_amount != null ||
    line.agency_fee_amount != null ||
    line.agency_fee_percent != null;

  if (!hasCommercialBreakdown) {
    return {
      revenue: roundMoney(line.revenue),
      cost: roundMoney(line.cost),
      gp: roundMoney(line.profit),
    };
  }

  const costBeforeVat = Number(line.cost_before_vat ?? line.cost ?? 0);
  const usageRightsCost = Number(line.usage_rights_cost ?? 0);
  const commercial = rollupLineClientCommercial({
    revenueBeforeVat: Number(line.revenue_before_vat ?? line.revenue ?? 0),
    usageRightsAmount: Number(line.usage_rights_amount ?? 0),
    usageRightsCost,
    agencyFeePercent: Number(line.agency_fee_percent ?? 0),
    agencyFeeAmount: line.agency_fee_amount,
    costBeforeVat,
  });

  return {
    revenue: commercial.billableBase,
    cost: roundMoney(costBeforeVat + usageRightsCost),
    gp: commercial.gp,
  };
}

export function computeMarginPercent(revenue: number, gp: number): number {
  if (revenue <= 0) return 0;
  return Math.round((gp / revenue) * 10000) / 100;
}

export function lineAchievedRevenue(
  line: LineFinancialInput,
  billableRevenue?: number
): number {
  return ACHIEVED_LINE_STATUSES.has(line.billing_status)
    ? roundMoney(billableRevenue ?? line.revenue)
    : 0;
}

export function linePlannedRevenue(line: LineFinancialInput): number {
  return resolveLineCommercialMetrics(line).revenue;
}

export function lineLegacyInvoicedRevenue(line: LineFinancialInput): number {
  return INVOICED_LINE_STATUSES.has(line.billing_status)
    ? resolveLineCommercialMetrics(line).revenue
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
    const commercial = resolveLineCommercialMetrics(line);
    const revenue = commercial.revenue;
    const cost = commercial.cost;
    const gp = commercial.gp;
    const achieved = lineAchievedRevenue(line, revenue);

    metrics = mergeFinancialMetrics(metrics, {
      revenue,
      cost,
      gp,
      achieved_revenue: achieved,
      budget_amount: roundMoney(line.po_amount ?? 0),
      actual_amount: revenue,
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
