import { createSupabaseServerClient } from "@/lib/supabase/server";

import { AGING_BUCKET_LABELS } from "./constants";
import {
  computeAgingBucket,
  formatMarginPercent,
  type AgingBucket,
  type BillingDashboard,
  type BillingInvoiceRow,
  type BillingKpiSummary,
  type BillingLineRow,
  type CampaignLineBillingStatus,
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
  cost: number;
  profit: number;
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
    client: { name: string } | null;
    brand: { name: string } | null;
  } | null;
  invoice: { document_number: string } | null;
};

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
        revenue, cost, profit, po_amount, po_consumed, remaining_po,
        revenue_locked, cost_locked, vendor_assignment_locked,
        currency_code, invoice_id,
        header:campaign_headers(id, name, document_number,
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
        campaign:campaign_headers(name)
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

  const lines = ((linesResult.data ?? []) as LineQueryRow[]).map((row) => {
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
      const row = inv as {
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

  const billedRevenue = lines
    .filter((l) =>
      ["invoiced", "partially_paid", "paid", "closed"].includes(l.billing_status)
    )
    .reduce((s, l) => s + l.revenue, 0);

  const revenue = lines.reduce((s, l) => s + l.revenue, 0);
  const cost = lines.reduce((s, l) => s + l.cost, 0);
  const gp = lines.reduce((s, l) => s + l.gp, 0);
  const collected = invoices.reduce((s, i) => s + i.amount_paid, 0);
  const outstanding = invoices.reduce((s, i) => s + i.outstanding, 0);
  const unpaidVendorCost = (vendorCostResult.data ?? []).reduce(
    (s, v) =>
      s +
      (["unpaid", "pending"].includes(
        (v as { vendor_payment_status: string }).vendor_payment_status
      )
        ? Number((v as { agreed_fee: number }).agreed_fee)
        : 0),
    0
  );

  const kpis: BillingKpiSummary = {
    revenue,
    cost,
    gp,
    margin_percent: formatMarginPercent(revenue, gp),
    billed_revenue: billedRevenue,
    collected_revenue: collected,
    outstanding_invoices: outstanding,
    unpaid_vendor_cost: unpaidVendorCost,
    po_total: lines.reduce((s, l) => s + l.po_amount, 0),
    po_consumed: lines.reduce((s, l) => s + l.po_consumed, 0),
    po_remaining: lines.reduce((s, l) => s + l.remaining_po, 0),
    po_over_consumed_count: lines.filter((l) => l.po_over_consumed).length,
  };

  const pending_approvals: FinancialApprovalRow[] = (
    approvalsResult.data ?? []
  ).map((a) => {
    const row = a as {
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
      campaign:campaign_headers(id, name, document_number)
    `
    )
    .eq("id", invoiceId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!invoice) return null;

  const inv = invoice as {
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
          id, campaign_line_id, description, quantity, unit_price, line_total,
          line:campaign_lines(document_number)
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
      const row = l as {
        id: string;
        campaign_line_id: string | null;
        description: string;
        quantity: number;
        unit_price: number;
        line_total: number;
        line: { document_number: string } | null;
      };
      return {
        id: row.id,
        campaign_line_id: row.campaign_line_id,
        description: row.description,
        quantity: Number(row.quantity),
        unit_price: Number(row.unit_price),
        line_total: Number(row.line_total),
        line_document_number: row.line?.document_number ?? null,
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
      const row = a as {
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
      const row = log as {
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
  const dashboard = await getBillingDashboard();
  return dashboard.lines.filter((l) => l.campaign_header_id === campaignId);
}
