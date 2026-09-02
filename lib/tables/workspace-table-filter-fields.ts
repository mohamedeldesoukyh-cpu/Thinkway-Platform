import type { CampaignListItem } from "@/types/database";
import type {
  BillingInvoiceRow,
  CampaignBillingQueueRow,
  FinancialApprovalRow,
  VendorAssignmentPaymentRow,
  VendorPaymentBatchRow,
} from "@/lib/domains/billing/types";
import type { FinanceAdjustmentRegisterRow } from "@/features/finance/adjustments/types";
import type { FinanceInvoiceRegisterRow } from "@/features/finance/invoices/types";
import type { ClientIoRow, VendorIoRow } from "@/lib/domains/io/types";
import type { SettingsRoleRow, SettingsUserRow } from "@/features/settings/types";
import type { ClientAccessEntityRow } from "@/features/client-access/types";
import type { ClientBrandRow, ClientDetail, VendorDetail } from "@/types/database";
import type { GroupBrandRow, GroupLegalEntityRow, GroupWorkspace } from "@/lib/domains/groups/types";
import type { VendorWorkspace } from "@/features/vendors/types";
import type {
  MovementBatchRow,
  MovementCampaignRow,
  VendorMovementAssignmentRow,
} from "@/features/operations/types";
import type { LinkedCampaignSummary } from "@/lib/operations/entity-dependencies";
import type { CollectionInvoiceRow } from "@/lib/collections/queries/load-collection-invoices";
import type { VendorPayablesPayload } from "@/lib/vendor-payables/load-payables";
import { AGING_BUCKET_LABELS } from "@/lib/domains/billing/constants";
import { FINANCIAL_APPROVAL_STAGE_LABELS } from "@/lib/domains/billing/constants";
import { daysPastDue } from "@/lib/collections/aging";
import { LINE_BILLING_STATUS_LABELS, VENDOR_PAYMENT_STATUS_LABELS } from "@/lib/campaigns/constants";
import { labelForOption } from "@/features/clients/constants";
import { CLIENT_DOCUMENT_TYPE_OPTIONS } from "@/features/clients/constants";
import { formatDocumentNumberForDisplay } from "@/lib/documents/format-document-number";
import type { FilterableValue } from "@/lib/tables/operational-table-filter-sort";

type ClientCampaignRow = ClientDetail["campaigns"][number];
type ClientDocumentRow = ClientDetail["documents"][number];
type VendorAssignmentRow = VendorDetail["campaign_assignments"][number];
type VendorDocumentRow = VendorDetail["documents"][number];
type VendorDeliverableRow = VendorWorkspace["deliverables"][number];
type GroupDocumentRow = GroupWorkspace["documents"][number];
type RecentCampaignRow = GroupWorkspace["recent_campaigns"][number];
type VendorPayableRow = VendorPayablesPayload["rows"][number];

export const CLIENT_CAMPAIGNS_FILTER_ACCESSORS: Partial<
  Record<string, (row: ClientCampaignRow) => FilterableValue>
> = {
  campaign: (row) => row.name,
  campaign_number: (row) => formatDocumentNumberForDisplay(row.document_number),
  brand: (row) => (row.brand as { name: string } | null)?.name ?? null,
  status: (row) => row.status,
  currency: (row) => row.currency_code,
  dates: (row) => row.start_date,
};

export const VENDOR_CAMPAIGNS_FILTER_ACCESSORS: Partial<
  Record<string, (row: VendorAssignmentRow) => FilterableValue>
> = {
  campaign: (row) => row.campaign?.name ?? null,
  campaign_number: (row) =>
    formatDocumentNumberForDisplay(row.campaign?.document_number),
  status: (row) => row.status,
  agreed_fee: (row) => Number(row.agreed_fee),
};

export const CLIENT_BRANDS_FILTER_ACCESSORS: Partial<
  Record<string, (row: ClientBrandRow) => FilterableValue>
> = {
  brand_number: (row) => formatDocumentNumberForDisplay(row.document_number),
  name: (row) => row.name,
  vr_rate: (row) => row.vr_rate_percent,
  currency: (row) => row.currency_code,
  campaigns: (row) => row.active_campaigns,
  status: (row) => row.status,
};

export const GROUP_BRANDS_FILTER_ACCESSORS: Partial<
  Record<string, (row: GroupBrandRow) => FilterableValue>
> = {
  brand: (row) => row.name,
  legal_entity: (row) => row.client_name,
  vr_rate: (row) => row.vr_rate_percent,
  currency: (row) => row.currency_code,
  campaigns: (row) => row.active_campaigns,
  status: (row) => row.status,
};

export const GROUP_LEGAL_ENTITIES_FILTER_ACCESSORS: Partial<
  Record<string, (row: GroupLegalEntityRow) => FilterableValue>
> = {
  entity: (row) => row.name,
  country: (row) => row.country,
  currency: (row) => row.currency,
  payment_terms: (row) => row.payment_terms,
  active_campaigns: (row) => row.active_campaigns,
  revenue: (row) => row.revenue,
  status: (row) => row.status,
};

export const GROUP_RECENT_CAMPAIGNS_FILTER_ACCESSORS: Partial<
  Record<string, (row: RecentCampaignRow) => FilterableValue>
> = {
  campaign: (row) => row.name,
  brand: (row) => row.brand_name,
  status: (row) => row.status,
  revenue: (row) => row.revenue,
};

export const CLIENT_DOCUMENTS_FILTER_ACCESSORS: Partial<
  Record<string, (row: ClientDocumentRow) => FilterableValue>
> = {
  type: (row) => labelForOption(CLIENT_DOCUMENT_TYPE_OPTIONS, row.document_type),
  file: (row) => row.file_name,
  uploaded: (row) => row.created_at.slice(0, 10),
  expiry: (row) => row.expires_at?.slice(0, 10) ?? null,
};

export const GROUP_DOCUMENTS_FILTER_ACCESSORS = CLIENT_DOCUMENTS_FILTER_ACCESSORS;

export const VENDOR_DOCUMENTS_FILTER_ACCESSORS: Partial<
  Record<string, (row: VendorDocumentRow) => FilterableValue>
> = {
  type: (row) => row.document_type,
  file: (row) => row.file_name,
  uploaded: (row) => row.created_at.slice(0, 10),
  expiry: (row) => row.expires_at?.slice(0, 10) ?? null,
};

export const VENDOR_ASSIGNMENTS_FILTER_ACCESSORS: Partial<
  Record<string, (row: VendorWorkspace["assignments"][number]) => FilterableValue>
> = {
  campaign: (row) => row.campaign_name,
  assignment_line: (row) => row.line_name,
  ops_status: (row) => row.assignment_status,
  billing: (row) =>
    row.billing_status ? LINE_BILLING_STATUS_LABELS[row.billing_status] : null,
  revenue: (row) => row.revenue,
  cost: (row) => row.cost,
  gp: (row) => row.gp,
  payout: (row) =>
    row.vendor_payment_status
      ? VENDOR_PAYMENT_STATUS_LABELS[row.vendor_payment_status]
      : null,
};

export const VENDOR_DELIVERABLES_FILTER_ACCESSORS: Partial<
  Record<string, (row: VendorDeliverableRow) => FilterableValue>
> = {
  deliverable: (row) => row.title,
  campaign: (row) => row.campaign_name,
  status: (row) => row.status,
};

export const VENDOR_PAYOUTS_FILTER_ACCESSORS: Partial<
  Record<string, (row: VendorWorkspace["payouts"][number]) => FilterableValue>
> = {
  campaign: (row) => row.campaign_name,
  amount: (row) => row.amount,
  status: (row) => row.status,
};

export const USERS_TABLE_FILTER_ACCESSORS: Partial<
  Record<string, (row: SettingsUserRow) => FilterableValue>
> = {
  name: (row) => row.name,
  email: (row) => row.email,
  role: (row) => row.role,
  business_function: (row) => row.business_function,
  department: (row) => row.department,
  country: (row) => row.country,
  status: (row) => row.status,
  last_login: (row) => row.last_login,
  portal_type: (row) => row.portal_type,
  access_level: (row) => row.access_level,
};

export const ROLES_TABLE_FILTER_ACCESSORS: Partial<
  Record<string, (row: SettingsRoleRow) => FilterableValue>
> = {
  role: (row) => row.name,
  description: (row) => row.description,
  user_count: (row) => row.user_count,
  permission_count: (row) => row.permission_count,
};

export const CLIENT_ACCESS_USERS_FILTER_ACCESSORS: Partial<
  Record<string, (row: ClientAccessEntityRow["users"][number]) => FilterableValue>
> = {
  user: (row) => row.full_name,
  email: (row) => row.email,
  role: (row) => row.access_role,
  primary: (row) => row.is_primary,
};

export const BILLING_INVOICES_FILTER_ACCESSORS: Partial<
  Record<string, (row: BillingInvoiceRow) => FilterableValue>
> = {
  invoice: (row) => formatDocumentNumberForDisplay(row.document_number),
  client: (row) => row.client_name,
  campaign: (row) => row.campaign_name,
  issue_date: (row) => row.issue_date,
  due_date: (row) => row.due_date,
  currency: (row) => row.currency,
  total: (row) => row.total,
  paid: (row) => row.amount_paid,
  outstanding: (row) => row.outstanding,
  collection: (row) => row.collection_status,
};

export const BILLING_COLLECTION_TRACKER_FILTER_ACCESSORS: Partial<
  Record<string, (row: BillingInvoiceRow) => FilterableValue>
> = {
  invoice: (row) => formatDocumentNumberForDisplay(row.document_number),
  client: (row) => row.client_name,
  campaign: (row) => row.campaign_name,
  issue_date: (row) => row.issue_date,
  due_date: (row) => row.due_date,
  days_past_due: (row) => (row.due_date ? daysPastDue(row.due_date) : null),
  aging: (row) => AGING_BUCKET_LABELS[row.aging_bucket],
  outstanding: (row) => row.outstanding,
  status: (row) => row.collection_status,
};

export const BILLING_FINANCIAL_APPROVALS_FILTER_ACCESSORS: Partial<
  Record<string, (row: FinancialApprovalRow) => FilterableValue>
> = {
  request: (row) => formatDocumentNumberForDisplay(row.document_number),
  stage: (row) => FINANCIAL_APPROVAL_STAGE_LABELS[row.approval_stage] ?? row.approval_stage,
  assignee: (row) => row.assigned_to_name,
};

export const BILLING_VENDOR_BATCHES_FILTER_ACCESSORS: Partial<
  Record<string, (row: VendorPaymentBatchRow) => FilterableValue>
> = {
  batch: (row) => formatDocumentNumberForDisplay(row.document_number),
  name: (row) => row.name,
  date: (row) => row.batch_date,
  amount: (row) => row.total_amount,
  status: (row) => row.status,
};

export const BILLING_VENDOR_ASSIGNMENTS_FILTER_ACCESSORS: Partial<
  Record<string, (row: VendorAssignmentPaymentRow) => FilterableValue>
> = {
  creator: (row) => row.creator_name,
  campaign: (row) => row.campaign_name,
  assignment: (row) => formatDocumentNumberForDisplay(row.assignment_document_number),
  currency: (row) => row.currency,
  sell_value: (row) => row.sell_value,
  vendor_cost: (row) => row.vendor_cost,
  paid: (row) => row.paid_amount,
  payment_state: (row) => row.payment_status,
  client_invoice: (row) => formatDocumentNumberForDisplay(row.invoice_document_number),
};

export const BILLING_CAMPAIGN_QUEUE_FILTER_ACCESSORS: Partial<
  Record<string, (row: CampaignBillingQueueRow) => FilterableValue>
> = {
  campaign_no: (row) => formatDocumentNumberForDisplay(row.campaign_document_number),
  client: (row) => row.client_name,
  brand: (row) => row.brand_name,
  campaign: (row) => row.campaign_name,
  currency: (row) => row.currency_code,
  total: (row) => row.total_campaign_amount,
  achieved: (row) => row.achieved_revenue,
  invoiced: (row) => row.already_invoiced,
  remaining: (row) => row.remaining_to_invoice,
  unachieved: (row) => row.unachieved_revenue,
  status: (row) => row.billing_status,
};

export const FINANCE_INVOICE_REGISTER_FILTER_ACCESSORS: Partial<
  Record<string, (row: FinanceInvoiceRegisterRow) => FilterableValue>
> = {
  invoice_number: (row) => formatDocumentNumberForDisplay(row.document_number),
  client: (row) => row.client_name,
  brand: (row) => row.brand_name,
  campaign: (row) => row.campaign_name,
  revenue_before_vat: (row) => row.revenue_before_vat,
  vat: (row) => row.vat_amount,
  revenue_after_vat: (row) => row.revenue_after_vat,
  invoice_status: (row) => row.status,
  locked: (row) => row.locked_status,
  created: (row) => row.created_date,
};

export const ADJUSTMENT_REGISTER_FILTER_ACCESSORS: Partial<
  Record<string, (row: FinanceAdjustmentRegisterRow) => FilterableValue>
> = {
  document: (row) => row.document_number,
  source: (row) => row.source_document_number,
  party: (row) => row.client_name ?? row.vendor_name,
  campaign: (row) => row.campaign_document_number,
  date: (row) => row.issue_date,
  amount: (row) => row.amount_after_vat,
  status: (row) => row.status,
};

export const INVOICES_AR_FILTER_ACCESSORS: Partial<
  Record<string, (row: CollectionInvoiceRow) => FilterableValue>
> = {
  invoice: (row) => formatDocumentNumberForDisplay(row.document_number),
  client: (row) => row.client_name,
  status: (row) => row.collection_status,
  aging: (row) => AGING_BUCKET_LABELS[row.aging_bucket],
  outstanding: (row) => row.outstanding,
};

export const VENDOR_PAYABLES_FILTER_ACCESSORS: Partial<
  Record<string, (row: VendorPayableRow) => FilterableValue>
> = {
  vendor: (row) => row.influencer_name,
  campaign: (row) => row.campaign_name,
  status: (row) => row.status,
  fee: (row) => row.agreed_fee,
};

export const CLIENT_IOS_FILTER_ACCESSORS: Partial<
  Record<string, (row: ClientIoRow) => FilterableValue>
> = {
  campaign: (row) => row.campaign_name,
  client: (row) => row.client_name,
  status: (row) => row.status,
  sent: (row) => row.sent_at,
  approved: (row) => row.approved_at,
};

export const VENDOR_IOS_FILTER_ACCESSORS: Partial<
  Record<string, (row: VendorIoRow) => FilterableValue>
> = {
  campaign: (row) => row.campaign_name,
  vendor: (row) => row.influencer_name,
  status: (row) => row.status,
  sent: (row) => row.sent_at,
  approved: (row) => row.approved_at,
};

export const OPERATIONS_VENDOR_MOVE_FILTER_ACCESSORS: Partial<
  Record<string, (row: VendorMovementAssignmentRow) => FilterableValue>
> = {
  campaign: (row) => row.campaign_name,
  line: (row) => formatDocumentNumberForDisplay(row.line_document_number),
  billing: (row) => row.billing_status,
  revenue: (row) => row.revenue,
  payout: (row) => row.vendor_payment_status,
};

export const OPERATIONS_MOVE_CAMPAIGNS_FILTER_ACCESSORS: Partial<
  Record<string, (row: MovementCampaignRow) => FilterableValue>
> = {
  campaign_number: (row) => formatDocumentNumberForDisplay(row.document_number),
  name: (row) => row.name,
  group: (row) => row.group_name,
  client: (row) => row.client_name,
  brand: (row) => row.brand_name,
  revenue: (row) => row.revenue,
  gp: (row) => row.gp,
  status: (row) => row.status,
  billing: (row) => row.billing_status,
  invoice: (row) => row.invoice_status,
  live: (row) => row.live_date,
};

export const REASSIGNMENT_BATCH_FILTER_ACCESSORS: Partial<
  Record<string, (row: MovementBatchRow) => FilterableValue>
> = {
  batch_number: (row) => formatDocumentNumberForDisplay(row.document_number),
  type: (row) => row.movement_type,
  status: (row) => row.status,
  campaigns: (row) => row.campaign_count,
  revenue: (row) => row.total_revenue,
  gp: (row) => row.total_gp,
  invoices: (row) => row.total_invoices,
  moved_by: (row) => row.created_by_name,
  executed: (row) => row.executed_at,
  reason: (row) => row.reason,
};

export const ENTITY_CAMPAIGN_DEPS_FILTER_ACCESSORS: Partial<
  Record<string, (row: LinkedCampaignSummary) => FilterableValue>
> = {
  campaign: (row) => row.name,
  status: (row) => row.status,
  revenue: (row) => row.revenue,
  gp: (row) => row.gp,
};

export const BILLING_CAMPAIGN_REVIEW_LINES_FILTER_ACCESSORS: Partial<
  Record<string, (row: import("@/lib/billing/operational-billing-rows").OperationalBillingRow) => FilterableValue>
> = {
  type: (row) => row.kind,
  line: (row) => row.document_number ?? row.label,
  invoice: (row) => row.invoice_document_number,
  invoice_status: (row) => row.billing_status,
  achieved: (row) => (row.is_achieved ? row.billable_amount : 0),
  invoiced: (row) => row.invoiced_amount,
  remaining: (row) => row.remaining_amount,
  billing_status: (row) => row.line_billing_status,
};

export const VENDOR_ASSIGNMENT_DEPS_FILTER_ACCESSORS: Partial<
  Record<string, (row: { campaign_name: string; line_document_number: string | null; billing_status: string | null; agreed_fee: number }) => FilterableValue>
> = {
  campaign: (row) => row.campaign_name,
  line: (row) => formatDocumentNumberForDisplay(row.line_document_number),
  billing: (row) => row.billing_status,
  fee: (row) => row.agreed_fee,
};

export const PORTAL_CLIENT_CAMPAIGNS_FILTER_ACCESSORS: Partial<
  Record<string, (row: import("@/features/portals/types").ClientCampaignRow) => FilterableValue>
> = {
  campaign: (row) => row.campaign_name,
  progress: (row) => row.status,
  deliverables: (row) => row.deliverable_total,
  publications: (row) => row.publication_total,
  approvals: (row) => row.pending_approvals,
  client_io: (row) => row.client_io_status,
};

export const PORTAL_CLIENT_INVOICES_FILTER_ACCESSORS: Partial<
  Record<string, (row: import("@/features/portals/types").ClientInvoiceRow) => FilterableValue>
> = {
  invoice: (row) => formatDocumentNumberForDisplay(row.document_number),
  campaign: (row) => row.campaign_name,
  issue_date: (row) => row.issue_date,
  due_date: (row) => row.due_date,
  total: (row) => row.amount_total,
  paid: (row) => row.amount_paid,
  pending: (row) => row.amount_pending,
  status: (row) => row.status,
};

export const PORTAL_CLIENT_APPROVALS_FILTER_ACCESSORS: Partial<
  Record<string, (row: import("@/features/portals/types").ClientApprovalRow) => FilterableValue>
> = {
  campaign: (row) => row.campaign_name,
  entity: (row) => row.entity_type,
  title: (row) => row.title,
  status: (row) => row.status,
  decision: (row) => row.approved_at,
};

export const PORTAL_CLIENT_REPORTS_FILTER_ACCESSORS: Partial<
  Record<string, (row: import("@/features/portals/types").ClientReportRow) => FilterableValue>
> = {
  campaign: (row) => row.campaign_name,
  status: (row) => row.campaign_status,
  publications: (row) => row.total_publications,
  approved_publications: (row) => row.approved_publications,
  deliverables: (row) => row.total_deliverables,
  approved_deliverables: (row) => row.approved_deliverables,
};

export const PORTAL_CREATOR_CAMPAIGNS_FILTER_ACCESSORS: Partial<
  Record<string, (row: import("@/features/portals/types").CreatorCampaignRow) => FilterableValue>
> = {
  campaign: (row) => row.campaign_name,
  status: (row) => row.assignment_status,
  deliverables: (row) => row.deliverable_total,
  publications: (row) => row.publication_total,
  payment: (row) => row.vendor_payment_status,
  vendor_io: (row) => row.vendor_io_status,
};

export const PORTAL_CREATOR_PUBLICATIONS_FILTER_ACCESSORS: Partial<
  Record<string, (row: import("@/features/portals/types").CreatorPublicationRow) => FilterableValue>
> = {
  campaign: (row) => row.campaign_name,
  platform: (row) => row.platform,
  type: (row) => row.publication_type,
  status: (row) => row.status,
  date: (row) => row.publication_date,
};

export const PORTAL_CREATOR_PAYMENTS_FILTER_ACCESSORS: Partial<
  Record<string, (row: import("@/features/portals/types").CreatorPaymentRow) => FilterableValue>
> = {
  campaign: (row) => row.campaign_name,
  agreed_amount: (row) => row.agreed_amount,
  invoiced: (row) => row.invoiced_amount,
  paid: (row) => row.paid_amount,
  pending: (row) => row.pending_amount,
  status: (row) => row.payment_status,
};

export const PORTAL_CREATOR_VENDOR_IOS_FILTER_ACCESSORS: Partial<
  Record<string, (row: import("@/features/portals/types").CreatorVendorIoRow) => FilterableValue>
> = {
  campaign: (row) => row.campaign_name,
  amount: (row) => row.amount,
  status: (row) => row.status,
  sent: (row) => row.sent_at,
  approved: (row) => row.approved_at,
};

export const PORTAL_CREATOR_DELIVERABLES_FILTER_ACCESSORS: Partial<
  Record<string, (row: { title: string; campaign_name: string; status: string; due_date: string | null; content_url: string | null }) => FilterableValue>
> = {
  deliverable: (row) => row.title,
  campaign: (row) => row.campaign_name,
  status: (row) => row.status,
  due: (row) => row.due_date,
  content: (row) => row.content_url,
};

export const PORTAL_CLIENT_IO_FILTER_ACCESSORS: Partial<
  Record<string, (row: import("@/features/portals/types").ClientIoRow) => FilterableValue>
> = {
  campaign: (row) => row.campaign?.name ?? null,
  status: (row) => row.status,
  sent: (row) => row.sent_at,
  approved: (row) => row.approved_at,
};

export function permissionsMatrixFilterAccessors(
  permissions: string[]
): Partial<Record<string, (row: (typeof import("@/features/settings/constants").SETTINGS_MODULES)[number]) => FilterableValue>> {
  const hasAny = (required: string[]) => required.some((p) => permissions.includes(p));
  return {
    module: (row) => row.label,
    read: (row) =>
      hasAny(row.permissions.filter((p) => p.endsWith(".read"))) ? "Yes" : "No",
    write: (row) =>
      hasAny(row.permissions.filter((p) => p.endsWith(".write"))) ? "Yes" : "No",
    approve: (row) =>
      hasAny(row.permissions.filter((p) => p.endsWith(".approve"))) ? "Yes" : "No",
    delete: (row) =>
      hasAny(row.permissions.filter((p) => p.endsWith(".delete"))) ? "Yes" : "No",
  };
}

export type { ClientCampaignRow, CampaignListItem };
