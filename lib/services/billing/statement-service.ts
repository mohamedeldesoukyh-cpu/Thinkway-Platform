import type { SupabaseClient } from "@supabase/supabase-js";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { REL } from "@/lib/supabase/relation-hints";
import { resolveOperationalPo } from "@/lib/finance/po/operational-budget";
import { resolveLinePoBillableBase } from "@/lib/finance/po/billable-base";
import type { PoStatus } from "@/lib/finance/po/status";
import {
  assignmentDeliverableBillingSelect,
  queryAssignmentDeliverables,
  resolveDeliverableVatExempt,
} from "@/lib/billing/assignment-deliverable-queries";
import {
  deliverableDisplayLabel,
  rollupAssignmentBilling,
  type DeliverableBillingRow,
} from "@/lib/billing/deliverable-billing";
import { queryCampaignLinesWithDisplayOrder } from "@/lib/campaigns/line-ordering";
import {
  parseLineAssignment,
  platformLabel,
} from "@/lib/campaigns/line-assignment";

import { resolveBillingKpis } from "@/lib/billing/kpi-enrichment";
import { devLog } from "@/lib/platform/logger";
import { AGING_BUCKET_LABELS } from "@/lib/domains/billing/constants";
import { buildCampaignQueueFromBillingLines } from "@/lib/billing/campaign-billing-queue";
import {
  loadCampaignInvoiceLineRollups,
  reconcileCampaignRollupWithInvoiceLines,
} from "@/lib/billing/invoice-operational-aggregation";
import { loadBillingCampaignQueue, loadCampaignOperationalBilling } from "@/lib/billing/operational-billing-query";
import {
  computeAgingBucket,
  formatMarginPercent,
  type AgingBucket,
  type AssignmentBillingGroup,
  type BillingDashboard,
  type BillingInvoiceRow,
  type BillingKpiSummary,
  type BillingLineRow,
  type CampaignLineBillingStatus,
  type CampaignOperationalBillingDetail,
  type FinancialApprovalRow,
  type InvoiceWorkspace,
  type VendorAssignmentPaymentRow,
  type VendorPaymentBatchRow,
  type VendorPaymentStatus,
} from "@/lib/domains/billing/types";

type LineQueryRow = {
  id: string;
  document_number: string;
  name: string;
  campaign_header_id: string;
  billing_status: CampaignLineBillingStatus;
  revenue: number;
  revenue_before_vat?: number;
  usage_rights_amount?: number;
  agency_fee_percent?: number;
  agency_fee_amount?: number | null;
  cost: number;
  profit: number;
  revenue_vat_amount?: number;
  cost_vat_amount?: number;
  po_amount: number;
  po_consumed: number;
  remaining_po: number;
  revenue_locked: boolean;
  cost_locked: boolean;
  vendor_assignment_locked: boolean;
  currency_code: string;
  invoice_id: string | null;
  header: {
    id: string;
    name: string;
    document_number: string;
    po_amount_campaign_currency?: number | null;
    po_consumed_amount?: number | null;
    po_remaining_amount?: number | null;
    po_remaining_percent?: number | null;
    po_status?: PoStatus | null;
    po_expiry_date?: string | null;
    client: { name: string } | null;
    brand: { name: string } | null;
  } | null;
  invoice: { document_number: string } | null;
};

function aggregateOperationalPoKpis(
  rawLines: {
    campaign_header_id: string;
    po_amount: number;
  revenue_before_vat?: number;
  revenue: number;
  usage_rights_amount?: number;
  agency_fee_percent?: number;
  agency_fee_amount?: number | null;
  header: LineQueryRow["header"];
  }[]
) {
  const headerMap = new Map<
    string,
    {
      po_amount_campaign_currency: number | null;
      po_consumed_amount: number | null;
      po_remaining_amount: number | null;
      po_remaining_percent: number | null;
      po_status: PoStatus | null;
      po_expiry_date: string | null;
      legacy_budget: number;
      legacy_consumed: number;
    }
  >();

  for (const row of rawLines) {
    const headerId = row.campaign_header_id;
    let entry = headerMap.get(headerId);
    if (!entry) {
      entry = {
        po_amount_campaign_currency:
          row.header?.po_amount_campaign_currency ?? null,
        po_consumed_amount: row.header?.po_consumed_amount ?? null,
        po_remaining_amount: row.header?.po_remaining_amount ?? null,
        po_remaining_percent: row.header?.po_remaining_percent ?? null,
        po_status: row.header?.po_status ?? null,
        po_expiry_date: row.header?.po_expiry_date ?? null,
        legacy_budget: 0,
        legacy_consumed: 0,
      };
      headerMap.set(headerId, entry);
    }
    entry.legacy_budget += row.po_amount;
    entry.legacy_consumed += resolveLinePoBillableBase(row);
  }

  let po_total = 0;
  let po_consumed = 0;
  let po_remaining = 0;
  let po_over_consumed_count = 0;

  for (const entry of headerMap.values()) {
    const operational = resolveOperationalPo({
      po_amount_campaign_currency: entry.po_amount_campaign_currency,
      po_consumed_amount: entry.legacy_consumed,
      po_remaining_amount: null,
      po_remaining_percent: null,
      po_status: entry.po_status,
      po_expiry_date: entry.po_expiry_date,
      legacy_budget: entry.legacy_budget,
      legacy_consumed: entry.legacy_consumed,
    });
    po_total += operational.po_amount;
    po_consumed += operational.po_consumed;
    po_remaining += operational.po_remaining;
    if (operational.po_exceeded) {
      po_over_consumed_count += 1;
    }
  }

  return { po_total, po_consumed, po_remaining, po_over_consumed_count };
}

function embedOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function coerceVendorPaymentStatus(raw: string): VendorPaymentStatus {
  if (raw === "paid" || raw === "pending" || raw === "cancelled") return raw;
  return "unpaid";
}

type AssignmentPaymentQueryRow = {
  id: string;
  agreed_fee: number;
  currency: string;
  vendor_payment_status: string;
  campaign_header_id: string | null;
  influencer:
    | { display_name: string | null; legal_name: string | null }
    | { display_name: string | null; legal_name: string | null }[]
    | null;
  campaign:
    | { id: string; name: string; document_number: string }
    | { id: string; name: string; document_number: string }[]
    | null;
  line:
    | {
        document_number: string | null;
        revenue: number | null;
        revenue_before_vat: number | null;
        currency_code: string | null;
        invoice_id: string | null;
        invoice: { document_number: string } | { document_number: string }[] | null;
      }
    | {
        document_number: string | null;
        revenue: number | null;
        revenue_before_vat: number | null;
        currency_code: string | null;
        invoice_id: string | null;
        invoice: { document_number: string } | { document_number: string }[] | null;
      }[]
    | null;
};

function mapVendorAssignmentPaymentRow(
  row: AssignmentPaymentQueryRow
): VendorAssignmentPaymentRow {
  const influencer = embedOne(row.influencer);
  const campaign = embedOne(row.campaign);
  const line = embedOne(row.line);
  const invoice = embedOne(line?.invoice);
  const agreedFee = Number(row.agreed_fee);
  const paymentStatus = coerceVendorPaymentStatus(row.vendor_payment_status);
  const sellValue = Number(line?.revenue_before_vat ?? line?.revenue ?? 0);

  return {
    id: row.id,
    creator_name: influencer?.display_name ?? influencer?.legal_name ?? "Creator",
    campaign_header_id: campaign?.id ?? row.campaign_header_id,
    campaign_name: campaign?.name ?? "Campaign",
    campaign_document_number: campaign?.document_number ?? null,
    assignment_document_number: line?.document_number ?? null,
    currency: row.currency || line?.currency_code || "",
    sell_value: Number.isFinite(sellValue) ? sellValue : 0,
    vendor_cost: agreedFee > 0 ? agreedFee : null,
    paid_amount: paymentStatus === "paid" && agreedFee > 0 ? agreedFee : 0,
    payment_status: paymentStatus,
    invoice_id: line?.invoice_id ?? null,
    invoice_document_number: invoice?.document_number ?? null,
  };
}

export async function getBillingDashboard(supabase: SupabaseClient): Promise<BillingDashboard> {
    const [
    linesResult,
    invoicesResult,
    approvalsResult,
    assignmentsResult,
  ] = await Promise.all([
    supabase
      .from("campaign_lines")
      .select(
        `
        id, document_number, name, campaign_header_id, billing_status,
        revenue, revenue_before_vat, usage_rights_amount, agency_fee_percent, agency_fee_amount,
        cost, profit, po_amount, po_consumed, remaining_po,
        revenue_vat_amount, cost_vat_amount,
        revenue_locked, cost_locked, vendor_assignment_locked,
        currency_code, invoice_id,
        header:${REL.campaignLines.campaignHeader}(id, name, document_number,
          po_amount_campaign_currency, po_consumed_amount, po_remaining_amount,
          po_remaining_percent, po_status, po_expiry_date,
          client:clients(name),
          brand:brands(name)
        ),
        invoice:invoices(document_number)
      `
      )
      .order("updated_at", { ascending: false })
      .limit(200),
    supabase
      .from("invoices")
      .select(
        `
        id, document_number, client_id, campaign_header_id, status,
        collection_status, issue_date, due_date, total, amount_paid, currency,
        client:clients(name),
        campaign:${REL.invoices.campaignHeader}(name)
      `
      )
      .not("status", "eq", "void")
      .order("issue_date", { ascending: false })
      .limit(100),
    supabase
      .from("financial_approval_requests")
      .select(
        `
        id, document_number, entity_type, entity_id, approval_stage,
        chain_order, status, title, decided_at,
        assignee:profiles!financial_approval_requests_assigned_to_fkey(full_name, email)
      `
      )
      .in("status", ["pending", "in_review"])
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("campaign_influencers")
      .select(
        `
        id, agreed_fee, currency, vendor_payment_status, campaign_header_id,
        influencer:influencers(display_name, legal_name),
        campaign:${REL.campaignInfluencers.campaignHeader}(id, name, document_number),
        line:${REL.campaignInfluencers.campaignLine}(
          document_number, revenue, revenue_before_vat, currency_code, invoice_id,
          invoice:invoices(document_number)
        )
      `
      )
      .in("vendor_payment_status", ["unpaid", "pending", "paid"])
      .limit(500),
  ]);

  if (linesResult.error) throw new Error(linesResult.error.message);
  if (invoicesResult.error) throw new Error(invoicesResult.error.message);
  if (assignmentsResult.error) throw new Error(assignmentsResult.error.message);

  const vendor_assignments: VendorAssignmentPaymentRow[] = (
    (assignmentsResult.data ?? []) as unknown as AssignmentPaymentQueryRow[]
  ).map(mapVendorAssignmentPaymentRow);

  vendor_assignments.sort((a, b) => {
    const campaignCmp = (a.campaign_document_number ?? "").localeCompare(
      b.campaign_document_number ?? ""
    );
    if (campaignCmp !== 0) return campaignCmp;
    return (a.assignment_document_number ?? a.creator_name).localeCompare(
      b.assignment_document_number ?? b.creator_name
    );
  });

  const unpaidVendorCost = vendor_assignments.reduce(
    (sum, row) =>
      sum +
      (row.payment_status === "unpaid" || row.payment_status === "pending"
        ? row.vendor_cost ?? 0
        : 0),
    0
  );

  const lines = ((linesResult.data ?? []) as unknown as LineQueryRow[]).map((row) => {
    const revenue = Number(row.revenue);
    const cost = Number(row.cost);
    const gp = Number(row.profit);
    const poAmount = Number(row.po_amount);
    const poConsumed = resolveLinePoBillableBase(row);
    return {
      id: row.id,
      document_number: row.document_number,
      name: row.name,
      campaign_header_id: row.campaign_header_id,
      campaign_name: row.header?.name ?? "",
      campaign_document_number: row.header?.document_number ?? "",
      client_name: row.header?.client?.name ?? "",
      brand_name: row.header?.brand?.name ?? null,
      billing_status: row.billing_status,
      revenue,
      cost,
      gp,
      margin_percent: formatMarginPercent(revenue, gp),
      po_amount: poAmount,
      po_consumed: poConsumed,
      remaining_po: Number(row.remaining_po),
      po_over_consumed: poConsumed > poAmount && poAmount > 0,
      revenue_locked: row.revenue_locked,
      cost_locked: row.cost_locked,
      vendor_assignment_locked: row.vendor_assignment_locked,
      currency_code: row.currency_code,
      invoice_id: row.invoice_id,
      invoice_document_number: row.invoice?.document_number ?? null,
    } satisfies BillingLineRow;
  });

  const invoices: BillingInvoiceRow[] = (invoicesResult.data ?? []).map(
    (inv) => {
      const row = inv as unknown as {
        id: string;
        document_number: string;
        client_id: string;
        campaign_header_id: string | null;
        status: string;
        collection_status: BillingInvoiceRow["collection_status"];
        issue_date: string;
        due_date: string | null;
        total: number;
        amount_paid: number;
        currency: string;
        client: { name: string } | null;
        campaign: { name: string } | null;
      };
      const total = Number(row.total);
      const amountPaid = Number(row.amount_paid);
      const outstanding = Math.max(0, total - amountPaid);
      return {
        id: row.id,
        document_number: row.document_number,
        client_id: row.client_id,
        client_name: row.client?.name ?? "",
        campaign_header_id: row.campaign_header_id,
        campaign_name: row.campaign?.name ?? null,
        status: row.status,
        collection_status: row.collection_status,
        issue_date: row.issue_date,
        due_date: row.due_date,
        total,
        amount_paid: amountPaid,
        outstanding,
        currency: row.currency,
        aging_bucket: computeAgingBucket(row.due_date, outstanding),
        line_count: 0,
      };
    }
  );

  const agingMap = new Map<AgingBucket, { count: number; amount: number }>();
  for (const key of Object.keys(AGING_BUCKET_LABELS) as AgingBucket[]) {
    agingMap.set(key, { count: 0, amount: 0 });
  }
  for (const inv of invoices) {
    if (inv.outstanding <= 0) continue;
    const bucket = agingMap.get(inv.aging_bucket)!;
    bucket.count += 1;
    bucket.amount += inv.outstanding;
  }

  const outputVat = (linesResult.data ?? []).reduce(
    (s, l) => s + Number((l as { revenue_vat_amount?: number }).revenue_vat_amount ?? 0),
    0
  );
  const inputVat = (linesResult.data ?? []).reduce(
    (s, l) => s + Number((l as { cost_vat_amount?: number }).cost_vat_amount ?? 0),
    0
  );

  const poKpis = aggregateOperationalPoKpis(
    (linesResult.data ?? []).map((row) => {
      const r = row as unknown as LineQueryRow;
      return {
        campaign_header_id: r.campaign_header_id,
        po_amount: Number(r.po_amount),
        revenue_before_vat: Number(
          (r as { revenue_before_vat?: number }).revenue_before_vat ?? r.revenue
        ),
        revenue: Number(r.revenue),
        header: r.header,
      };
    })
  );

  const kpiExtras = {
    output_vat: outputVat,
    input_vat: inputVat,
    po_total: poKpis.po_total,
    po_consumed: poKpis.po_consumed,
    po_remaining: poKpis.po_remaining,
    po_over_consumed_count: poKpis.po_over_consumed_count,
  };

  const { kpis } = await resolveBillingKpis(supabase, {
    lines: lines.map((l) => ({
      revenue: l.revenue,
      cost: l.cost,
      gp: l.gp,
      billing_status: l.billing_status,
    })),
    invoices: invoices.map((i) => ({
      amount_paid: i.amount_paid,
      outstanding: i.outstanding,
    })),
    unpaid_vendor_cost: unpaidVendorCost,
    extras: kpiExtras,
  });

  const pending_approvals: FinancialApprovalRow[] = (
    approvalsResult.data ?? []
  ).map((a) => {
    const row = a as unknown as {
      id: string;
      document_number: string;
      entity_type: string;
      entity_id: string;
      approval_stage: FinancialApprovalRow["approval_stage"];
      chain_order: number;
      status: string;
      title: string;
      decided_at: string | null;
      assignee: { full_name: string | null; email: string } | null;
    };
    return {
      id: row.id,
      document_number: row.document_number,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      approval_stage: row.approval_stage,
      chain_order: row.chain_order,
      status: row.status,
      title: row.title,
      assigned_to_name: row.assignee?.full_name ?? row.assignee?.email ?? null,
      decided_at: row.decided_at,
    };
  });

  const vendor_batches: VendorPaymentBatchRow[] = [];

  let campaign_queue: BillingDashboard["campaign_queue"] = [];
  try {
    const queueResult = await loadBillingCampaignQueue(supabase);
    campaign_queue = queueResult.campaigns;
  } catch (error) {
    devLog("operational-isolation", "billing queue load failed — using line fallback", {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  if (campaign_queue.length === 0 && lines.length > 0) {
    campaign_queue = buildCampaignQueueFromBillingLines(lines);
    if (process.env.NODE_ENV === "development") {
      devLog("operational-isolation", "billing queue line fallback", {
        count: campaign_queue.length,
      });
    }
  }

  return {
    kpis,
    lines,
    invoices,
    aging: (Object.keys(AGING_BUCKET_LABELS) as AgingBucket[]).map(
      (bucket) => ({
        bucket,
        label: AGING_BUCKET_LABELS[bucket],
        count: agingMap.get(bucket)?.count ?? 0,
        amount: agingMap.get(bucket)?.amount ?? 0,
      })
    ),
    vendor_batches,
    vendor_assignments,
    pending_approvals,
    campaign_queue,
  };
}