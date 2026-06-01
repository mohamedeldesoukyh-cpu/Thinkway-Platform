export type AssignmentDeliverableBillingStatus =
  | "draft"
  | "ready_to_invoice"
  | "partially_invoiced"
  | "invoiced"
  | "partially_collected"
  | "collected"
  | "disputed"
  | "cancelled";

export type DeliverableBillingRow = {
  id: string;
  campaign_line_id: string;
  sort_order: number;
  platform: string;
  deliverable_type: string;
  quantity: number;
  live_date: string | null;
  billable_amount: number;
  invoiced_amount: number;
  collected_amount: number;
  disputed_amount: number;
  remaining_amount: number;
  billing_status: AssignmentDeliverableBillingStatus;
  invoice_line_item_id: string | null;
  locked_at: string | null;
  revenue_before_vat: number;
  revenue_vat_percent: number;
  revenue_vat_exempt: boolean;
  label: string;
};

export type AssignmentBillingGroup = {
  line_id: string;
  document_number: string;
  name: string;
  influencer_name: string | null;
  platform_summary: string | null;
  billing_status: string;
  currency_code: string;
  pricing_mode: string;
  total_value: number;
  invoiced_value: number;
  remaining_value: number;
  collected_value: number;
  disputed_value: number;
  deliverables: DeliverableBillingRow[];
};

export function deliverableDisplayLabel(row: {
  platform: string;
  deliverable_type: string;
  sort_order: number;
  quantity: number;
}): string {
  const typeLabel = row.deliverable_type.replace(/_/g, " ");
  const platformLabel = row.platform.charAt(0).toUpperCase() + row.platform.slice(1);
  if (row.quantity > 1) {
    return `${platformLabel} ${typeLabel} ×${row.quantity} (#${row.sort_order + 1})`;
  }
  return `${platformLabel} ${typeLabel} (#${row.sort_order + 1})`;
}

export function rollupAssignmentBilling(
  deliverables: DeliverableBillingRow[]
): Pick<
  AssignmentBillingGroup,
  "total_value" | "invoiced_value" | "remaining_value" | "collected_value" | "disputed_value"
> {
  return {
    total_value: deliverables.reduce((s, d) => s + d.billable_amount, 0),
    invoiced_value: deliverables.reduce((s, d) => s + d.invoiced_amount, 0),
    remaining_value: deliverables.reduce((s, d) => s + d.remaining_amount, 0),
    collected_value: deliverables.reduce((s, d) => s + d.collected_amount, 0),
    disputed_value: deliverables.reduce((s, d) => s + d.disputed_amount, 0),
  };
}

export function deriveLineBillingStatusFromDeliverables(
  deliverables: DeliverableBillingRow[],
  currentLineStatus: string
): string {
  if (deliverables.length === 0) return currentLineStatus;

  const billable = deliverables.reduce((s, d) => s + d.billable_amount, 0);
  const invoiced = deliverables.reduce((s, d) => s + d.invoiced_amount, 0);
  const collected = deliverables.reduce((s, d) => s + d.collected_amount, 0);
  const disputed = deliverables.some((d) => d.billing_status === "disputed");

  if (disputed) return currentLineStatus;
  if (billable > 0 && invoiced >= billable) {
    if (collected >= billable) return "paid";
    if (collected > 0) return "partially_paid";
    return "invoiced";
  }
  if (invoiced > 0 && invoiced < billable) return "partially_invoiced";
  if (["moved_to_billing", "approved"].includes(currentLineStatus)) {
    return currentLineStatus;
  }
  return currentLineStatus;
}

export function isDeliverableInvoiceEligible(
  row: DeliverableBillingRow,
  lineBillingStatus: string
): boolean {
  if (row.locked_at) return false;
  if (row.remaining_amount <= 0) return false;
  if (row.billing_status === "disputed" || row.billing_status === "cancelled") {
    return false;
  }
  return ["moved_to_billing", "approved", "partially_invoiced"].includes(lineBillingStatus);
}

export function shouldLockLineFully(
  deliverables: DeliverableBillingRow[]
): boolean {
  if (deliverables.length === 0) return true;
  return deliverables.every(
    (d) => d.remaining_amount <= 0 || d.billing_status === "invoiced"
  );
}
