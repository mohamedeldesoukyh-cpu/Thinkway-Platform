import type { FinancialMetrics } from "@/lib/analytics/types/metrics";
import type { BillingKpiSummary } from "@/features/billing/types";
import { formatMarginPercent } from "@/features/billing/types";

export type BillingKpiExtras = {
  output_vat: number;
  input_vat: number;
  po_total: number;
  po_consumed: number;
  po_remaining: number;
  po_over_consumed_count: number;
};

/** Maps centralized analytics metrics into the billing dashboard KPI shape. */
export function mapFinancialMetricsToBillingKpis(
  metrics: FinancialMetrics,
  extras: BillingKpiExtras
): BillingKpiSummary {
  return {
    revenue: metrics.revenue,
    cost: metrics.cost,
    gp: metrics.gp,
    margin_percent: formatMarginPercent(metrics.revenue, metrics.gp),
    output_vat: extras.output_vat,
    input_vat: extras.input_vat,
    net_vat_payable: extras.output_vat - extras.input_vat,
    billed_revenue: metrics.invoiced_revenue,
    collected_revenue: metrics.collected_revenue,
    outstanding_invoices: metrics.outstanding_revenue,
    unpaid_vendor_cost: metrics.vendor_payable,
    po_total: extras.po_total,
    po_consumed: extras.po_consumed,
    po_remaining: extras.po_remaining,
    po_over_consumed_count: extras.po_over_consumed_count,
  };
}
