import type { CampaignLineBillingStatus } from "@/features/billing/types";

/**
 * Canonical metric definitions for Thinkway executive analytics.
 * All dashboards must align with these semantics.
 */

export const METRIC_DEFINITIONS = {
  revenue: "Planned campaign revenue (assignment line totals).",
  achieved_revenue:
    "Operational revenue in approved, billing-ready, or invoiced states.",
  unachieved_revenue: "Planned revenue not yet achieved operationally.",
  invoiced_revenue:
    "Revenue linked to invoice line items (invoice_line_items.revenue_before_vat).",
  collected_revenue: "Cash collected against client invoices (amount_paid).",
  outstanding_revenue: "Invoiced revenue minus collected (open AR).",
  gp: "Gross profit = revenue − cost.",
  margin_percent: "GP ÷ revenue × 100 when revenue > 0.",
  vendor_payable: "Unpaid vendor / influencer obligations.",
  remaining_to_invoice: "Achieved revenue not yet invoiced.",
  budget_amount: "Approved PO / budget envelope (future-ready).",
  actual_amount: "Consumed PO / actual spend (future-ready).",
  budget_variance: "Budget − actual (future-ready).",
} as const;

/** Line statuses treated as operationally achieved. */
export const ACHIEVED_LINE_STATUSES = new Set<CampaignLineBillingStatus>([
  "approved",
  "moved_to_billing",
  "partially_invoiced",
  "invoiced",
  "partially_paid",
  "paid",
  "closed",
]);

export const INVOICED_LINE_STATUSES = new Set<CampaignLineBillingStatus>([
  "invoiced",
  "partially_invoiced",
  "partially_paid",
  "paid",
  "closed",
]);
