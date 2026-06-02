export type CampaignLineBillingStatus =
  | "draft"
  | "approved"
  | "moved_to_billing"
  | "partially_invoiced"
  | "invoiced"
  | "partially_paid"
  | "paid"
  | "closed";

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
  billing_status: CampaignLineBillingStatus;
  currency_code: string;
  pricing_mode: string;
  total_value: number;
  invoiced_value: number;
  remaining_value: number;
  collected_value: number;
  disputed_value: number;
  deliverables: DeliverableBillingRow[];
  revenue_locked: boolean;
  cost_locked: boolean;
  vendor_assignment_locked: boolean;
  invoice_id: string | null;
  invoice_document_number: string | null;
  po_over_consumed: boolean;
  po_amount: number;
  po_consumed: number;
};

export type CollectionStatus =
  | "pending"
  | "partial"
  | "collected"
  | "overdue"
  | "written_off";

export type VendorPaymentStatus = "unpaid" | "pending" | "paid" | "cancelled";

export type FinancialApprovalStage =
  | "campaign_manager"
  | "finance"
  | "cfo_admin";

export type AgingBucket = "current" | "1_30" | "31_60" | "61_90" | "90_plus";

export type BillingKpiSummary = {
  revenue: number;
  cost: number;
  gp: number;
  margin_percent: number;
  output_vat: number;
  input_vat: number;
  net_vat_payable: number;
  billed_revenue: number;
  collected_revenue: number;
  outstanding_invoices: number;
  unpaid_vendor_cost: number;
  po_total: number;
  po_consumed: number;
  po_remaining: number;
  po_over_consumed_count: number;
};

export type BillingLineRow = {
  id: string;
  document_number: string;
  name: string;
  campaign_header_id: string;
  campaign_name: string;
  campaign_document_number: string;
  client_name: string;
  brand_name: string | null;
  billing_status: CampaignLineBillingStatus;
  revenue: number;
  cost: number;
  gp: number;
  margin_percent: number;
  po_amount: number;
  po_consumed: number;
  remaining_po: number;
  po_over_consumed: boolean;
  revenue_locked: boolean;
  cost_locked: boolean;
  vendor_assignment_locked: boolean;
  currency_code: string;
  invoice_id: string | null;
  invoice_document_number: string | null;
};

export type BillingInvoiceRow = {
  id: string;
  document_number: string;
  client_id: string;
  client_name: string;
  campaign_header_id: string | null;
  campaign_name: string | null;
  status: string;
  collection_status: CollectionStatus;
  issue_date: string;
  due_date: string | null;
  total: number;
  amount_paid: number;
  outstanding: number;
  currency: string;
  aging_bucket: AgingBucket;
  line_count: number;
};

export type InvoiceWorkspace = {
  id: string;
  document_number: string;
  status: string;
  collection_status: CollectionStatus;
  regeneration_status: "active" | "pending_regeneration" | "regenerated";
  version_number: number;
  ungenerate_reason: string | null;
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  outstanding: number;
  currency: string;
  notes: string | null;
  client: { id: string; name: string; document_number: string };
  campaign: {
    id: string;
    name: string;
    document_number: string;
  } | null;
  lines: {
    id: string;
    campaign_line_id: string | null;
    assignment_deliverable_id: string | null;
    description: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    revenue_before_vat: number;
    revenue_vat_percent: number;
    revenue_vat_amount: number;
    revenue_vat_exempt: boolean;
    line_document_number: string | null;
    deliverable_label: string | null;
  }[];
  payments: {
    id: string;
    document_number: string;
    amount: number;
    currency: string;
    status: string;
    paid_at: string | null;
    payment_method: string;
  }[];
  approvals: FinancialApprovalRow[];
  activity: BillingActivityItem[];
};

export type FinancialApprovalRow = {
  id: string;
  document_number: string;
  entity_type: string;
  entity_id: string;
  approval_stage: FinancialApprovalStage;
  chain_order: number;
  status: string;
  title: string;
  assigned_to_name: string | null;
  decided_at: string | null;
};

export type BillingActivityItem = {
  id: string;
  action: string;
  entity_type: string;
  created_at: string;
  actor: { full_name: string | null; email: string } | null;
  summary: string;
};

export type VendorPaymentBatchRow = {
  id: string;
  document_number: string;
  name: string;
  status: string;
  batch_date: string;
  total_amount: number;
  currency: string;
  assignment_count: number;
};

export type BillingDashboard = {
  kpis: BillingKpiSummary;
  lines: BillingLineRow[];
  invoices: BillingInvoiceRow[];
  aging: { bucket: AgingBucket; label: string; count: number; amount: number }[];
  vendor_batches: VendorPaymentBatchRow[];
  pending_approvals: FinancialApprovalRow[];
  campaign_queue: CampaignBillingQueueRow[];
};

export type CampaignBillingQueueRow = {
  campaign_header_id: string;
  campaign_document_number: string;
  campaign_name: string;
  client_id: string;
  client_name: string;
  brand_name: string | null;
  legal_entity_name: string | null;
  currency_code: string;
  billing_status: CampaignLineBillingStatus;
  total_campaign_amount: number;
  achieved_revenue: number;
  already_invoiced: number;
  remaining_to_invoice: number;
  unachieved_revenue: number;
  assignment_count: number;
  operational_row_count: number;
};

export type AppendableInvoiceOption = {
  id: string;
  document_number: string;
  status: string;
  regeneration_status: string;
  total: number;
  currency: string;
  client_id: string;
  campaign_header_id: string | null;
  is_locked: boolean;
};

export type CampaignOperationalBillingDetail = {
  campaign_header_id: string;
  currency_code: string;
  groups: AssignmentBillingGroup[];
  operational_rows: import("@/lib/billing/operational-billing-rows").OperationalBillingRow[];
  rollup: {
    total_campaign_amount: number;
    achieved_revenue: number;
    already_invoiced: number;
    remaining_to_invoice: number;
    unachieved_revenue: number;
  };
  appendable_invoices: AppendableInvoiceOption[];
};

export type BillingWorkspace = BillingDashboard;

export function formatMarginPercent(revenue: number, gp: number): number {
  if (revenue <= 0) return 0;
  return Math.round((gp / revenue) * 10000) / 100;
}

export function computeAgingBucket(
  dueDate: string | null,
  outstanding: number
): AgingBucket {
  if (outstanding <= 0) return "current";
  if (!dueDate) return "current";
  const due = new Date(`${dueDate}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.floor((today.getTime() - due.getTime()) / 86400000);
  if (days <= 0) return "current";
  if (days <= 30) return "1_30";
  if (days <= 60) return "31_60";
  if (days <= 90) return "61_90";
  return "90_plus";
}
