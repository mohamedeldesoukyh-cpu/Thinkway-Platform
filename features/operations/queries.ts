import { applyGroupIdColumnFilter } from "@/lib/groups/group-filter";
import { REL } from "@/lib/supabase/relation-hints";
import { governanceDb } from "@/lib/supabase/governance-client";

import type {
  HierarchyOption,
  MovementBatchRow,
  MovementCampaignRow,
  MovementType,
} from "./types";

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("You must be signed in to continue.");
  }
  return { supabase, user };
}

function deriveInvoiceStatus(
  lines: { billing_status: string; invoice_id: string | null }[]
): string {
  if (lines.length === 0) return "none";
  const invoiced = lines.filter((l) => l.invoice_id);
  if (invoiced.length === 0) return "not_invoiced";
  if (invoiced.length === lines.length) return "fully_invoiced";
  return "partially_invoiced";
}

function deriveBillingStatus(
  lines: { billing_status: string }[]
): string {
  if (lines.length === 0) return "none";
  const statuses = new Set(lines.map((l) => l.billing_status));
  if (statuses.size === 1) return [...statuses][0];
  return "mixed";
}

export async function getHierarchyOptions(): Promise<{
  groups: HierarchyOption[];
  clients: HierarchyOption[];
  brands: HierarchyOption[];
}> {
  const { supabase } = await requireUser();

  const [groupsResult, clientsResult, brandsResult] = await Promise.all([
    supabase
      .from("groups")
      .select("id, name, document_number")
      .neq("status", "archived")
      .order("name"),
    supabase
      .from("clients")
      .select("id, name, document_number, group_id")
      .neq("status", "archived")
      .order("name"),
    supabase
      .from("brands")
      .select("id, name, document_number, client_id")
      .neq("status", "archived")
      .order("name"),
  ]);

  if (groupsResult.error) throw new Error(groupsResult.error.message);
  if (clientsResult.error) throw new Error(clientsResult.error.message);
  if (brandsResult.error) throw new Error(brandsResult.error.message);

  return {
    groups: (groupsResult.data ?? []).map((g) => ({
      id: g.id,
      label: g.name,
      sublabel: g.document_number,
    })),
    clients: (clientsResult.data ?? []).map((c) => ({
      id: c.id,
      label: c.name,
      sublabel: c.document_number,
    })),
    brands: (brandsResult.data ?? []).map((b) => ({
      id: b.id,
      label: b.name,
      sublabel: b.document_number,
    })),
  };
}

export async function getCampaignsForMovement(params: {
  movementType: MovementType;
  groupId?: string;
  clientId?: string;
  brandId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  campaigns: MovementCampaignRow[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? 25;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { supabase } = await requireUser();

  let query = supabase
    .from("campaign_headers")
    .select(
      `
      id, document_number, name, status, group_id, client_id, brand_id,
      start_date, created_at,
      group:groups(name),
      client:clients(name),
      brand:brands(name),
      lines:campaign_lines(revenue, profit, billing_status, invoice_id)
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (params.brandId) {
    query = query.eq("brand_id", params.brandId);
  } else if (params.clientId) {
    query = query.eq("client_id", params.clientId);
  } else if (params.groupId) {
    query = applyGroupIdColumnFilter(query, params.groupId);
  }

  const search = params.search?.trim();
  if (search) {
    query = query.or(
      `name.ilike.%${search}%,document_number.ilike.%${search}%`
    );
  }

  const { data, error, count } = await query.range(from, to);
  if (error) throw new Error(error.message);

  const campaigns: MovementCampaignRow[] = (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      document_number: string;
      name: string;
      status: string;
      group_id: string | null;
      client_id: string | null;
      brand_id: string | null;
      start_date: string | null;
      created_at: string;
      group: { name: string } | null;
      client: { name: string } | null;
      brand: { name: string } | null;
      lines: {
        revenue: number;
        profit: number;
        billing_status: string;
        invoice_id: string | null;
      }[];
    };
    const revenue = r.lines.reduce((s, l) => s + Number(l.revenue), 0);
    const gp = r.lines.reduce((s, l) => s + Number(l.profit), 0);
    return {
      id: r.id,
      document_number: r.document_number,
      name: r.name,
      status: r.status,
      group_id: r.group_id,
      group_name: r.group?.name ?? null,
      client_id: r.client_id,
      client_name: r.client?.name ?? null,
      brand_id: r.brand_id,
      brand_name: r.brand?.name ?? null,
      revenue,
      gp,
      billing_status: deriveBillingStatus(r.lines),
      invoice_status: deriveInvoiceStatus(r.lines),
      live_date: r.start_date,
      created_at: r.created_at,
    };
  });

  return {
    campaigns,
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function getMovementBatches(): Promise<MovementBatchRow[]> {
  const { supabase } = await requireUser();

  const { data, error } = await governanceDb(supabase)
    .from("movement_batches")
    .select(
      `
      id, document_number, movement_type, status, reason,
      campaign_count, total_revenue, total_gp, total_invoices,
      executed_at, created_at,
      creator:profiles!movement_batches_created_by_fkey(full_name)
    `
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      document_number: string;
      movement_type: MovementBatchRow["movement_type"];
      status: MovementBatchRow["status"];
      reason: string;
      campaign_count: number;
      total_revenue: number;
      total_gp: number;
      total_invoices: number;
      executed_at: string | null;
      created_at: string;
      creator: { full_name: string | null } | { full_name: string | null }[] | null;
    };
    const creator = Array.isArray(r.creator) ? r.creator[0] : r.creator;
    return {
      id: r.id,
      document_number: r.document_number,
      movement_type: r.movement_type,
      status: r.status,
      reason: r.reason,
      campaign_count: r.campaign_count,
      total_revenue: Number(r.total_revenue),
      total_gp: Number(r.total_gp),
      total_invoices: r.total_invoices,
      executed_at: r.executed_at,
      created_at: r.created_at,
      created_by_name: creator?.full_name ?? null,
    };
  });
}

export async function getFinancialPeriods() {
  const { supabase } = await requireUser();

  const { data, error } = await governanceDb(supabase)
    .from("financial_periods")
    .select(
      `
      id, year, month, status, locked_at, notes,
      locker:profiles!financial_periods_locked_by_fkey(full_name)
    `
    )
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(24);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      year: number;
      month: number;
      status: string;
      locked_at: string | null;
      notes: string | null;
      locker: { full_name: string | null } | { full_name: string | null }[] | null;
    };
    const locker = Array.isArray(r.locker) ? r.locker[0] : r.locker;
    return {
      id: r.id,
      year: r.year,
      month: r.month,
      status: r.status,
      locked_at: r.locked_at,
      notes: r.notes,
      locked_by_name: locker?.full_name ?? null,
    };
  });
}

export async function getPeriodLockLogs(periodId: string) {
  const { supabase } = await requireUser();

  const { data, error } = await governanceDb(supabase)
    .from("period_lock_logs")
    .select(
      `
      id, previous_status, new_status, reason, created_at,
      actor:profiles!period_lock_logs_actor_id_fkey(full_name)
    `
    )
    .eq("period_id", periodId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return data ?? [];
}

export async function getInvoiceVersions(invoiceId: string) {
  const { supabase } = await requireUser();

  const { data, error } = await governanceDb(supabase)
    .from("invoice_versions")
    .select(
      `
      id, version_number, total, subtotal, tax_amount,
      regeneration_reason, created_at,
      regenerator:profiles!invoice_versions_regenerated_by_fkey(full_name)
    `
    )
    .eq("invoice_id", invoiceId)
  if (error) throw new Error(error.message);

  return data ?? [];
}

export async function getVendorsForMovement(): Promise<
  import("./types").HierarchyOption[]
> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("influencers")
    .select("id, display_name, document_number")
    .neq("status", "archived")
    .order("display_name");

  if (error) throw new Error(error.message);

  return (data ?? []).map((v) => ({
    id: v.id,
    label: v.display_name,
    sublabel: v.document_number,
  }));
}

export async function getVendorAssignmentsForMovement(
  influencerId: string
): Promise<import("./types").VendorMovementAssignmentRow[]> {
  const { supabase } = await requireUser();

  const { data, error } = await supabase
    .from("campaign_influencers")
    .select(
      `
      id, campaign_line_id, campaign_header_id, agreed_fee, currency, vendor_payment_status,
      campaign:${REL.campaignInfluencers.campaignHeader}(id, document_number, name),
      line:${REL.campaignInfluencers.campaignLine}(
        id, document_number, name, revenue, profit, billing_status
      )
    `
    )
    .eq("influencer_id", influencerId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      campaign_line_id: string | null;
      campaign_header_id: string | null;
      agreed_fee: number;
      currency: string;
      vendor_payment_status: string | null;
      campaign: { id: string; document_number: string; name: string } | null;
      line: {
        id: string;
        document_number: string;
        name: string;
        revenue: number;
        profit: number;
        billing_status: string;
      } | null;
    };
    return {
      id: r.id,
      campaign_line_id: r.campaign_line_id,
      campaign_id: r.campaign?.id ?? r.campaign_header_id ?? null,
      campaign_document_number: r.campaign?.document_number ?? null,
      campaign_name: r.campaign?.name ?? null,
      line_document_number: r.line?.document_number ?? null,
      line_name: r.line?.name ?? null,
      agreed_fee: Number(r.agreed_fee),
      currency: r.currency,
      billing_status: r.line?.billing_status ?? null,
      vendor_payment_status: r.vendor_payment_status,
      revenue: Number(r.line?.revenue ?? r.agreed_fee),
      gp: Number(r.line?.profit ?? 0),
    };
  });
}
