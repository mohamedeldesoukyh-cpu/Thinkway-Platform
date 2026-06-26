import { roundMoney } from "@/lib/analytics/aggregations/round";
import { computeMarginPercent } from "@/lib/analytics/metrics/financial";
import { mapFinancialMetricsToBillingKpis } from "@/lib/analytics/queries/billing-bridge";
import type { BillingKpiExtras } from "@/lib/analytics/queries/billing-bridge";
import type { BillingKpiSummary } from "@/features/billing/types";
import type { CampaignLineBillingStatus } from "@/lib/domains/campaign/types";

const INVOICED_STATUSES = new Set<CampaignLineBillingStatus>([
  "invoiced",
  "partially_invoiced",
  "partially_paid",
  "paid",
  "closed",
]);

export function buildBillingKpisFromOperationalRows(input: {
  lines: { revenue: number; cost: number; gp: number; billing_status: CampaignLineBillingStatus }[];
  invoices: { amount_paid: number; outstanding: number }[];
  unpaid_vendor_cost: number;
  extras: BillingKpiExtras;
}): BillingKpiSummary {
  const revenue = roundMoney(input.lines.reduce((s, l) => s + l.revenue, 0));
  const cost = roundMoney(input.lines.reduce((s, l) => s + l.cost, 0));
  const gp = roundMoney(input.lines.reduce((s, l) => s + l.gp, 0));
  const invoiced = roundMoney(
    input.lines
      .filter((l) => INVOICED_STATUSES.has(l.billing_status))
      .reduce((s, l) => s + l.revenue, 0)
  );
  const collected = roundMoney(
    input.invoices.reduce((s, i) => s + i.amount_paid, 0)
  );
  const outstanding = roundMoney(
    input.invoices.reduce((s, i) => s + i.outstanding, 0)
  );

  return mapFinancialMetricsToBillingKpis(
    {
      revenue,
      cost,
      gp,
      margin_percent: computeMarginPercent(revenue, gp),
      achieved_revenue: revenue,
      unachieved_revenue: 0,
      invoiced_revenue: invoiced,
      collected_revenue: collected,
      outstanding_revenue: outstanding,
      vendor_payable: input.unpaid_vendor_cost,
      remaining_to_invoice: 0,
      budget_amount: input.extras.po_total,
      actual_amount: input.extras.po_consumed,
      budget_variance: input.extras.po_remaining,
    },
    input.extras
  );
}
