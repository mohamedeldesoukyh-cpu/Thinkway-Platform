import { createSupabaseServerClient } from "@/lib/supabase/server";
import { REL } from "@/lib/supabase/relation-hints";
import { resolveOperationalPo } from "@/lib/finance/po/operational-budget";
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
} from "@/features/campaigns/line-assignment";

import { resolveBillingKpis } from "@/lib/billing/kpi-enrichment";
import { devLog } from "@/lib/platform/logger";
import { AGING_BUCKET_LABELS } from "./constants";
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
  type VendorPaymentBatchRow,
} from "./types";

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error(error?.message ?? "Unauthorized");
  }
  return { supabase, user };
}

type LineQueryRow = {
  id: string;
  document_number: string;
  name: string;
  campaign_header_id: string;
  billing_status: CampaignLineBillingStatus;
  revenue: number;
  revenue_before_vat?: number;
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
    entry.legacy_consumed += Number(row.revenue_before_vat ?? row.revenue);
  }

  let po_total = 0;
  let po_consumed = 0;
  let po_remaining = 0;
  let po_over_consumed_count = 0;

  for (const entry of headerMap.values()) {
    const operational = resolveOperationalPo({
      po_amount_campaign_currency: entry.po_amount_campaign_currency,
      po_consumed_amount: entry.po_consumed_amount,
      po_remaining_amount: entry.po_remaining_amount,
      po_remaining_percent: entry.po_remaining_percent,
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

export async function getBillingDashboard(): Promise<BillingDashboard> {
  const { supabase } = await requireUser();

  const [
    linesResult,
    invoicesResult,
    batchesResult,
    approvalsResult,
    vendorCostResult,
  ] = await Promise.all([
    supabase
      .from("campaign_lines")
      .select(
        `
        id, document_number, name, campaign_header_id, billing_status,
        revenue, revenue_before_vat, cost, profit, po_amount, po_consumed, remaining_po,
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
      .from("vendor_payment_batches")
      .select("id, document_number, name, status, batch_date, total_amount, currency")
      .order("batch_date", { ascending: false })
      .limit(20),
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
      .select("agreed_fee, vendor_payment_status")
      .neq("vendor_payment_status", "paid"),
  ]);

  if (linesResult.error) throw new Error(linesResult.error.message);
  if (invoicesResult.error) throw new Error(invoicesResult.error.message);

  const lines = ((linesResult.data ?? []) as unknown as LineQueryRow[]).map((row) => {
    const revenue = Number(row.revenue);
    const cost = Number(row.cost);
    const gp = Number(row.profit);
    const poAmount = Number(row.po_amount);
    const poConsumed = Number(row.po_consumed ?? row.cost);
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
    unpaid_vendor_cost: (vendorCostResult.data ?? []).reduce(
      (s, v) =>
        s +
        (["unpaid", "pending"].includes(
          (v as { vendor_payment_status: string }).vendor_payment_status
        )
          ? Number((v as { agreed_fee: number }).agreed_fee)
          : 0),
      0
    ),
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

  const vendor_batches: VendorPaymentBatchRow[] = (
    batchesResult.data ?? []
  ).map((b) => ({
    id: b.id,
    document_number: b.document_number,
    name: b.name,
    status: b.status,
    batch_date: b.batch_date,
    total_amount: Number(b.total_amount),
    currency: b.currency,
    assignment_count: 0,
  }));

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
    pending_approvals,
    campaign_queue,
  };
}

export async function getInvoiceWorkspace(
  invoiceId: string
): Promise<InvoiceWorkspace | null> {
  const { supabase } = await requireUser();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select(
      `
      *,
      client:clients(id, name, document_number),
      campaign:${REL.invoices.campaignHeader}(id, name, document_number)
    `
    )
    .eq("id", invoiceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!invoice) return null;

  const inv = invoice as unknown as {
    id: string;
    document_number: string;
    status: string;
    collection_status: InvoiceWorkspace["collection_status"];
    regeneration_status: InvoiceWorkspace["regeneration_status"];
    version_number: number;
    ungenerate_reason: string | null;
    issue_date: string;
    due_date: string | null;
    subtotal: number;
    tax_amount: number;
    total: number;
    amount_paid: number;
    currency: string;
    notes: string | null;
    client: InvoiceWorkspace["client"];
    campaign: InvoiceWorkspace["campaign"];
  };

  const [linesResult, paymentsResult, approvalsResult, auditResult, profilesResult] =
    await Promise.all([
      supabase
        .from("invoice_line_items")
        .select(
          `
        id, campaign_line_id, assignment_deliverable_id, description, quantity, unit_price, line_total,
        revenue_before_vat, revenue_vat_percent, revenue_vat_amount, revenue_vat_exempt,
        line:${REL.invoiceLineItems.campaignLine}(document_number),
        deliverable:assignment_deliverables(platform, deliverable_type, sort_order, quantity)
        `
        )
        .eq("invoice_id", invoiceId)
        .order("sort_order"),
      supabase
        .from("payments")
        .select("id, document_number, amount, currency, status, paid_at, payment_method")
        .eq("invoice_id", invoiceId)
        .order("created_at", { ascending: false }),
      supabase
        .from("financial_approval_requests")
        .select(
          `
          id, document_number, entity_type, entity_id, approval_stage,
          chain_order, status, title, decided_at,
          assignee:profiles!financial_approval_requests_assigned_to_fkey(full_name, email)
        `
        )
        .eq("entity_id", invoiceId)
        .order("chain_order"),
      supabase
        .from("audit_logs")
        .select("id, action, entity_type, created_at, actor_id")
        .or(
          `and(entity_type.eq.invoices,entity_id.eq.${invoiceId}),entity_type.eq.payments,entity_type.eq.invoice_line_items`
        )
        .order("created_at", { ascending: false })
        .limit(25),
      supabase.from("profiles").select("id, full_name, email"),
    ]);

  const profileMap = new Map(
    (profilesResult.data ?? []).map((p) => [p.id, p])
  );

  const total = Number(inv.total);
  const amountPaid = Number(inv.amount_paid);

  return {
    id: inv.id,
    document_number: inv.document_number,
    status: inv.status,
    collection_status: inv.collection_status,
    regeneration_status: inv.regeneration_status ?? "active",
    version_number: inv.version_number ?? 1,
    ungenerate_reason: inv.ungenerate_reason,
    issue_date: inv.issue_date,
    due_date: inv.due_date,
    subtotal: Number(inv.subtotal),
    tax_amount: Number(inv.tax_amount),
    total,
    amount_paid: amountPaid,
    outstanding: Math.max(0, total - amountPaid),
    currency: inv.currency,
    notes: inv.notes,
    client: inv.client,
    campaign: inv.campaign,
    lines: (linesResult.data ?? []).map((l) => {
      const row = l as unknown as {
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
        line: { document_number: string } | null;
        deliverable: {
          platform: string;
          deliverable_type: string;
          sort_order: number;
          quantity: number;
        } | null;
      };
      return {
        id: row.id,
        campaign_line_id: row.campaign_line_id,
        assignment_deliverable_id: row.assignment_deliverable_id,
        description: row.description,
        quantity: Number(row.quantity),
        unit_price: Number(row.unit_price),
        line_total: Number(row.line_total),
        revenue_before_vat: Number(row.revenue_before_vat ?? row.unit_price),
        revenue_vat_percent: Number(row.revenue_vat_percent ?? 0),
        revenue_vat_amount: Number(row.revenue_vat_amount ?? 0),
        revenue_vat_exempt: row.revenue_vat_exempt ?? false,
        line_document_number: row.line?.document_number ?? null,
        deliverable_label: row.deliverable
          ? deliverableDisplayLabel(row.deliverable)
          : null,
      };
    }),
    payments: (paymentsResult.data ?? []).map((p) => ({
      id: p.id,
      document_number: p.document_number,
      amount: Number(p.amount),
      currency: p.currency,
      status: p.status,
      paid_at: p.paid_at,
      payment_method: p.payment_method,
    })),
    approvals: (approvalsResult.data ?? []).map((a) => {
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
    }),
    activity: (auditResult.data ?? []).slice(0, 20).map((log) => {
      const row = log as unknown as {
        id: string;
        action: string;
        entity_type: string;
        created_at: string;
        actor_id: string | null;
      };
      const actor = row.actor_id ? profileMap.get(row.actor_id) : null;
      return {
        id: row.id,
        action: row.action,
        entity_type: row.entity_type,
        created_at: row.created_at,
        actor: actor
          ? { full_name: actor.full_name, email: actor.email }
          : null,
        summary: `${row.action} · ${row.entity_type}`,
      };
    }),
  };
}

export async function getCampaignBillingLines(
  campaignId: string
): Promise<BillingLineRow[]> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("campaign_lines")
    .select(
      `
        id, document_number, name, campaign_header_id, billing_status,
        revenue, cost, profit, po_amount, po_consumed, remaining_po,
        revenue_locked, cost_locked, vendor_assignment_locked,
        currency_code, invoice_id,
        header:${REL.campaignLines.campaignHeader}(id, name, document_number,
          client:clients(name),
          brand:brands(name)
        ),
        invoice:invoices(document_number)
      `
    )
    .eq("campaign_header_id", campaignId)
    .order("updated_at", { ascending: false });

  if (error) {
    if (process.env.NODE_ENV === "development") {
      devLog("[analytics-fallback] getCampaignBillingLines query failed", error.message);
    }
    return [];
  }

  return ((data ?? []) as unknown as LineQueryRow[]).map((row) => {
    const revenue = Number(row.revenue);
    const cost = Number(row.cost);
    const gp = Number(row.profit);
    const poAmount = Number(row.po_amount);
    const poConsumed = Number(row.po_consumed ?? row.cost);
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
}

export async function getCampaignBillingGroups(
  campaignId: string
): Promise<AssignmentBillingGroup[]> {
  const { supabase } = await requireUser();

  type CampaignLineBillingQueryRow = {
    id: string;
    document_number: string;
    name: string;
    billing_status: CampaignLineBillingStatus;
    currency_code: string;
    pricing_mode: string | null;
    revenue: number;
    po_amount: number;
    po_consumed: number;
    revenue_locked: boolean;
    cost_locked: boolean;
    vendor_assignment_locked: boolean;
    invoice_id: string | null;
    metadata: Record<string, unknown> | null;
    invoice: { document_number: string } | null;
  };

  const lineSelectWithSort =
    "id, document_number, name, billing_status, currency_code, pricing_mode, revenue, cost, po_amount, po_consumed, remaining_po, revenue_locked, cost_locked, vendor_assignment_locked, invoice_id, metadata, sort_order, invoice:invoices(document_number)";

  const lineSelectFallback =
    "id, document_number, name, billing_status, currency_code, pricing_mode, revenue, cost, po_amount, po_consumed, remaining_po, revenue_locked, cost_locked, vendor_assignment_locked, invoice_id, metadata, invoice:invoices(document_number)";

  const { data: lines, error: linesError } =
    await queryCampaignLinesWithDisplayOrder<CampaignLineBillingQueryRow>(
      async (orderColumn, includeSortOrderColumn) => {
        const result = await supabase
          .from("campaign_lines")
          .select(includeSortOrderColumn ? lineSelectWithSort : lineSelectFallback)
          .eq("campaign_header_id", campaignId)
          .order(orderColumn, { ascending: true });
        return {
          data: (result.data ?? null) as CampaignLineBillingQueryRow[] | null,
          error: result.error,
        };
      }
    );

  if (linesError) throw new Error(linesError);

  const lineIds = lines.map((l) => l.id);
  if (lineIds.length === 0) return [];

  const {
    data: deliverableRows,
    error: deliverableError,
    includesVatExempt,
  } = await queryAssignmentDeliverables<
    Omit<DeliverableBillingRow, "label"> & { revenue_vat_exempt?: boolean | null }
  >(async (select) => {
    const result = await supabase
      .from("assignment_deliverables")
      .select(select)
      .in("campaign_line_id", lineIds)
      .order("sort_order");
    return {
      data: (result.data ?? null) as Array<
        Omit<DeliverableBillingRow, "label"> & { revenue_vat_exempt?: boolean | null }
      > | null,
      error: result.error,
    };
  });

  if (deliverableError) throw new Error(deliverableError);

  const deliverablesByLine = new Map<string, DeliverableBillingRow[]>();
  for (const row of deliverableRows ?? []) {
    const typed = row as unknown as Omit<DeliverableBillingRow, "label">;
    const mapped: DeliverableBillingRow = {
      ...typed,
      billable_amount: Number(typed.billable_amount),
      invoiced_amount: Number(typed.invoiced_amount),
      collected_amount: Number(typed.collected_amount),
      disputed_amount: Number(typed.disputed_amount),
      remaining_amount: Number(typed.remaining_amount),
      revenue_before_vat: Number(typed.revenue_before_vat),
      revenue_vat_percent: Number(typed.revenue_vat_percent ?? 0),
      revenue_vat_exempt: resolveDeliverableVatExempt(typed, includesVatExempt),
      label: deliverableDisplayLabel(typed),
    };
    const list = deliverablesByLine.get(typed.campaign_line_id) ?? [];
    list.push(mapped);
    deliverablesByLine.set(typed.campaign_line_id, list);
  }

  return lines.map((line) => {
    const row = line;

    const assignment = parseLineAssignment(row.metadata);
    const deliverables = deliverablesByLine.get(row.id) ?? [];
    const rollups = rollupAssignmentBilling(deliverables);
    const poAmount = Number(row.po_amount);
    const poConsumed = Number(row.po_consumed);

    return {
      line_id: row.id,
      document_number: row.document_number,
      name: row.name,
      influencer_name: assignment?.influencer_name ?? null,
      platform_summary: assignment
        ? assignment.platforms.map((p) => platformLabel(p.platform)).join(", ")
        : null,
      billing_status: row.billing_status,
      currency_code: row.currency_code,
      pricing_mode: row.pricing_mode ?? assignment?.pricing_mode ?? "package",
      deliverables,
      ...rollups,
      revenue_locked: row.revenue_locked,
      cost_locked: row.cost_locked,
      vendor_assignment_locked: row.vendor_assignment_locked,
      invoice_id: row.invoice_id,
      invoice_document_number: row.invoice?.document_number ?? null,
      po_over_consumed: poConsumed > poAmount && poAmount > 0,
      po_amount: poAmount,
      po_consumed: poConsumed,
    } satisfies AssignmentBillingGroup;
  });
}

export async function getCampaignOperationalBillingDetail(
  campaignId: string
): Promise<CampaignOperationalBillingDetail | null> {
  const { supabase } = await requireUser();

  const { data: header, error: headerError } = await supabase
    .from("campaign_headers")
    .select("id, currency_code, client_id")
    .eq("id", campaignId)
    .maybeSingle();

  if (headerError || !header) return null;

  const { groups, operational_rows, error } = await loadCampaignOperationalBilling(
    supabase,
    campaignId
  );

  if (error) {
    throw new Error(error);
  }

  const { isInvoiceAppendable } = await import("@/lib/billing/campaign-billing-queue");
  const { computeCampaignFinancialRollup } = await import(
    "@/lib/billing/operational-financial-sync"
  );
  const { resolveClientBillingVatRate } = await import("@/lib/vat/queries");
  const { vatRate: default_vat_percent } = await resolveClientBillingVatRate(
    supabase,
    header.client_id
  );

  const legacyRevenue = groups.reduce((sum, group) => sum + group.total_value, 0);
  const legacyInvoiced = groups.reduce((sum, group) => sum + group.invoiced_value, 0);
  const baseRollup = computeCampaignFinancialRollup({
    operational_rows,
    legacy_line_revenue: legacyRevenue,
    legacy_invoiced: legacyInvoiced,
  });

  const lineRollups = await loadCampaignInvoiceLineRollups(supabase, [campaignId]);
  const lineInvoiced = lineRollups.get(campaignId)?.invoiced_subtotal ?? 0;
  const reconciled = reconcileCampaignRollupWithInvoiceLines({
    ...baseRollup,
    invoice_line_invoiced: lineInvoiced,
  });
  const rollup = { ...baseRollup, ...reconciled };

  const { data: invoiceRows } = await supabase
    .from("invoices")
    .select(
      "id, document_number, status, regeneration_status, is_operational_locked, total, subtotal, tax_amount, currency, client_id, campaign_header_id"
    )
    .eq("campaign_header_id", campaignId)
    .not("status", "eq", "void");

  const appendable_invoices = (invoiceRows ?? [])
    .map((inv) => {
      const row = inv as unknown as {
        id: string;
        document_number: string;
        status: string;
        regeneration_status: string | null;
        is_operational_locked?: boolean | null;
        total: number;
        subtotal: number;
        tax_amount: number;
        currency: string;
        client_id: string;
        campaign_header_id: string | null;
      };
      const appendable = isInvoiceAppendable({
        status: row.status,
        regeneration_status: row.regeneration_status,
        is_operational_locked: row.is_operational_locked,
        currency: row.currency,
        client_id: row.client_id,
        campaign_header_id: row.campaign_header_id,
        target_currency: header.currency_code,
        target_client_id: header.client_id,
        target_campaign_id: campaignId,
      });
      if (!appendable) return null;
      return {
        id: row.id,
        document_number: row.document_number,
        status: row.status,
        regeneration_status: row.regeneration_status ?? "active",
        total: Number(row.total),
        subtotal: Number(row.subtotal ?? 0),
        tax_amount: Number(row.tax_amount ?? 0),
        currency: row.currency,
        client_id: row.client_id,
        campaign_header_id: row.campaign_header_id,
        is_locked:
          Boolean(row.is_operational_locked) ||
          row.regeneration_status === "pending_regeneration",
      };
    })
    .filter(Boolean) as CampaignOperationalBillingDetail["appendable_invoices"];

  if (process.env.NODE_ENV === "development") {
    console.debug("[billing-drilldown] loaded campaign detail", {
      campaignId,
      assignments: operational_rows.length,
      appendableInvoices: appendable_invoices.length,
      rollup,
    });
  }

  return {
    campaign_header_id: campaignId,
    currency_code: header.currency_code,
    default_vat_percent,
    groups,
    operational_rows,
    rollup,
    appendable_invoices,
  };
}
