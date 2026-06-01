import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getBrandsForCampaignForm,
  getMasterDataOptions,
} from "@/lib/master-data/queries";
import type { CampaignListItem } from "@/types/database";

import type { CampaignLineBillingStatus } from "@/features/billing/types";
import { CAMPAIGNS_PAGE_SIZE, METADATA_PLATFORM_KEY } from "./constants";
import {
  deriveLinePaymentStatus,
  deriveWorkflowStage,
  formatMarginPercent,
  mapDeliverableDisplayStatus,
  type BrandFormOption,
  type CampaignWorkspace,
  type InfluencerSearchResult,
} from "./types";

export type CampaignsListResult = {
  campaigns: CampaignListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type CampaignFormOptions = {
  brands: BrandFormOption[];
  accountManagers: {
    id: string;
    full_name: string | null;
    email: string;
  }[];
  masterData: Awaited<ReturnType<typeof getMasterDataOptions>>;
};

type HeaderWithRelations = {
  id: string;
  document_number: string;
  name: string;
  description: string | null;
  brief: string | null;
  status: CampaignWorkspace["status"];
  currency_code: string;
  start_date: string | null;
  end_date: string | null;
  metadata: Record<string, unknown>;
  brand: { id: string; name: string; document_number: string } | null;
  client: {
    id: string;
    name: string;
    document_number: string;
    legal_name: string | null;
  } | null;
  group: { id: string; name: string; document_number: string } | null;
  team: { id: string; name: string } | null;
  account_manager: CampaignWorkspace["account_manager"];
};

type LineRow = {
  id: string;
  document_number: string;
  name: string;
  status: CampaignWorkspace["status"];
  platform: string | null;
  revenue: number;
  cost: number;
  profit: number;
  profit_margin: number;
  po_amount: number;
  po_consumed: number;
  remaining_po: number;
  currency_code: string;
  start_date: string | null;
  end_date: string | null;
  billing_status: CampaignLineBillingStatus;
  revenue_locked: boolean;
  cost_locked: boolean;
  vendor_assignment_locked: boolean;
  invoice_id: string | null;
};

function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\,]/g, "\\$&");
}

async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message);
  }

  if (!user) {
    throw new Error("You must be signed in to continue.");
  }

  return { supabase, user };
}

export async function getCampaignsList(params: {
  page?: number;
  search?: string;
}): Promise<CampaignsListResult> {
  const page = Math.max(1, params.page ?? 1);
  const search = params.search?.trim() ?? "";
  const from = (page - 1) * CAMPAIGNS_PAGE_SIZE;
  const to = from + CAMPAIGNS_PAGE_SIZE - 1;

  const { supabase } = await requireUser();

  let query = supabase
    .from("campaign_headers")
    .select(
      `
      *,
      brand:brands(id, name),
      client:clients(id, name, document_number, legal_name),
      group:groups(id, name),
      account_manager:profiles!campaign_headers_account_manager_id_fkey(id, full_name, email),
      lines:campaign_lines(id, document_number, name, po_amount, revenue, cost, profit)
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (search) {
    const pattern = `%${escapeIlikePattern(search)}%`;
    query = query.or(
      [`name.ilike.${pattern}`, `document_number.ilike.${pattern}`].join(",")
    );
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / CAMPAIGNS_PAGE_SIZE));

  return {
    campaigns: (data ?? []) as CampaignListItem[],
    total,
    page,
    pageSize: CAMPAIGNS_PAGE_SIZE,
    totalPages,
  };
}

export async function getCampaignFormOptions(): Promise<CampaignFormOptions> {
  const { supabase } = await requireUser();

  const [brands, masterData, managersResult] = await Promise.all([
    getBrandsForCampaignForm(),
    getMasterDataOptions(),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
  ]);

  if (managersResult.error) {
    throw new Error(managersResult.error.message);
  }

  return {
    brands: brands as BrandFormOption[],
    masterData,
    accountManagers: managersResult.data ?? [],
  };
}

export async function getCampaignWorkspace(
  campaignId: string
): Promise<CampaignWorkspace | null> {
  const { supabase } = await requireUser();

  const { data: header, error: headerError } = await supabase
    .from("campaign_headers")
    .select(
      `
      *,
      brand:brands(id, name, document_number),
      client:clients(id, name, document_number, legal_name),
      group:groups(id, name, document_number),
      team:md_teams(id, name),
      account_manager:profiles!campaign_headers_account_manager_id_fkey(id, full_name, email)
    `
    )
    .eq("id", campaignId)
    .maybeSingle();

  if (headerError) {
    throw new Error(headerError.message);
  }
  if (!header) {
    return null;
  }

  const [
    linesResult,
    vendorsResult,
    deliverablesResult,
    invoicesResult,
    approvalsResult,
    auditResult,
    profilesResult,
  ] = await Promise.all([
    supabase
      .from("campaign_lines")
      .select("*")
      .eq("campaign_header_id", campaignId)
      .order("document_number"),
    supabase
      .from("campaign_influencers")
      .select(
        `
        id, campaign_line_id, influencer_id, status, agreed_fee, currency,
        deliverable_count, invited_at, confirmed_at,
        influencer:influencers(id, document_number, display_name),
        line:campaign_lines(document_number)
      `
      )
      .or(`campaign_header_id.eq.${campaignId},campaign_id.eq.${campaignId}`),
    supabase
      .from("deliverables")
      .select(
        `
        id, document_number, deliverable_type, title, status, platform,
        due_date, submitted_at, approved_at, published_at, content_url, metrics,
        influencer:influencers(display_name)
      `
      )
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: false }),
    supabase
      .from("invoices")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("issue_date", { ascending: false }),
    supabase
      .from("approvals")
      .select(
        `
        id, document_number, entity_type, title, status, due_at, decided_at,
        assignee:profiles!approvals_assigned_to_fkey(full_name, email)
      `
      )
      .or(
        `and(entity_type.eq.campaign,entity_id.eq.${campaignId}),entity_type.eq.deliverable,entity_type.eq.campaign_influencer`
      )
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("audit_logs")
      .select("id, action, entity_type, entity_id, created_at, actor_id, new_data")
      .or(
        [
          `and(entity_type.eq.campaign_headers,entity_id.eq.${campaignId})`,
          `entity_type.eq.campaign_lines`,
          `entity_type.eq.campaign_influencers`,
          `entity_type.eq.deliverables`,
        ].join(",")
      )
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("profiles").select("id, full_name, email"),
  ]);

  if (linesResult.error) {
    throw new Error(linesResult.error.message);
  }
  if (vendorsResult.error) {
    throw new Error(vendorsResult.error.message);
  }

  const lines = (linesResult.data ?? []) as LineRow[];
  const lineIds = new Set(lines.map((l) => l.id));
  const lineDocMap = new Map(lines.map((l) => [l.id, l.document_number]));

  const influencerIds = [
    ...new Set(
      (vendorsResult.data ?? []).map(
        (v) => (v as { influencer_id: string }).influencer_id
      )
    ),
  ];

  let platformAccounts: {
    influencer_id: string;
    platform: string;
    handle: string;
    profile_url: string | null;
    follower_count: number;
    engagement_rate: number | null;
  }[] = [];

  if (influencerIds.length > 0) {
    const { data: accounts } = await supabase
      .from("influencer_platform_accounts")
      .select(
        "influencer_id, platform, handle, profile_url, follower_count, engagement_rate"
      )
      .in("influencer_id", influencerIds);
    platformAccounts = accounts ?? [];
  }

  const accountsByInfluencer = new Map<string, typeof platformAccounts>();
  for (const account of platformAccounts) {
    const list = accountsByInfluencer.get(account.influencer_id) ?? [];
    list.push(account);
    accountsByInfluencer.set(account.influencer_id, list);
  }

  const vendors = (vendorsResult.data ?? []).map((row) => {
    const v = row as {
      id: string;
      campaign_line_id: string | null;
      influencer_id: string;
      status: string;
      agreed_fee: number;
      currency: string;
      deliverable_count: number;
      invited_at: string | null;
      confirmed_at: string | null;
      influencer: {
        id: string;
        document_number: string;
        display_name: string;
      } | null;
      line: { document_number: string } | null;
    };
    return {
      id: v.id,
      campaign_line_id: v.campaign_line_id,
      line_document_number:
        v.line?.document_number ??
        (v.campaign_line_id ? lineDocMap.get(v.campaign_line_id) ?? null : null),
      influencer_id: v.influencer_id,
      influencer_name: v.influencer?.display_name ?? "Unknown",
      influencer_document_number: v.influencer?.document_number ?? "",
      status: v.status,
      agreed_fee: Number(v.agreed_fee),
      currency: v.currency,
      deliverable_count: v.deliverable_count,
      platforms: accountsByInfluencer.get(v.influencer_id) ?? [],
      invited_at: v.invited_at,
      confirmed_at: v.confirmed_at,
    };
  });

  const influencersByLine = new Map<string, number>();
  const vendorFeesByLine = new Map<string, number>();
  for (const vendor of vendors) {
    if (vendor.campaign_line_id) {
      influencersByLine.set(
        vendor.campaign_line_id,
        (influencersByLine.get(vendor.campaign_line_id) ?? 0) + 1
      );
      vendorFeesByLine.set(
        vendor.campaign_line_id,
        (vendorFeesByLine.get(vendor.campaign_line_id) ?? 0) + vendor.agreed_fee
      );
    }
  }

  const invoices = (invoicesResult.data ?? []).map((inv) => {
    const row = inv as {
      id: string;
      document_number: string;
      status: string;
      issue_date: string;
      due_date: string | null;
      total: number;
      amount_paid: number;
      currency: string;
    };
    const total = Number(row.total);
    const amountPaid = Number(row.amount_paid);
    return {
      id: row.id,
      document_number: row.document_number,
      status: row.status,
      issue_date: row.issue_date,
      due_date: row.due_date,
      total,
      amount_paid: amountPaid,
      outstanding: Math.max(0, total - amountPaid),
      currency: row.currency,
    };
  });

  let payments: CampaignWorkspace["payments"] = [];
  if (invoices.length > 0) {
    const invoiceIds = invoices.map((i) => i.id);
    const invoiceDocMap = new Map(invoices.map((i) => [i.id, i.document_number]));
    const { data: paymentRows } = await supabase
      .from("payments")
      .select("id, document_number, invoice_id, amount, currency, status, paid_at")
      .in("invoice_id", invoiceIds)
      .order("created_at", { ascending: false });

    payments = (paymentRows ?? []).map((p) => {
      const row = p as {
        id: string;
        document_number: string;
        invoice_id: string;
        amount: number;
        currency: string;
        status: string;
        paid_at: string | null;
      };
      return {
        id: row.id,
        document_number: row.document_number,
        invoice_document_number: invoiceDocMap.get(row.invoice_id) ?? "",
        amount: Number(row.amount),
        currency: row.currency,
        status: row.status,
        paid_at: row.paid_at,
      };
    });
  }

  const workspaceLines = lines.map((line) => {
    const revenue = Number(line.revenue);
    const cost = Number(line.cost);
    const gp = Number(line.profit);
    const poAmount = Number(line.po_amount);
    const poConsumed = Number(line.po_consumed ?? cost);
    const vendorFees = vendorFeesByLine.get(line.id) ?? 0;

    return {
      id: line.id,
      document_number: line.document_number,
      name: line.name,
      status: line.status,
      platform: line.platform,
      influencer_count: influencersByLine.get(line.id) ?? 0,
      revenue,
      cost,
      gp,
      margin_percent: formatMarginPercent(revenue, gp),
      po_amount: poAmount,
      po_consumed: poConsumed,
      remaining_po: Number(line.remaining_po),
      po_over_consumed: poConsumed > poAmount && poAmount > 0,
      billing_status: line.billing_status ?? "draft",
      revenue_locked: line.revenue_locked ?? false,
      cost_locked: line.cost_locked ?? false,
      vendor_assignment_locked: line.vendor_assignment_locked ?? false,
      invoice_id: line.invoice_id ?? null,
      payment_status: deriveLinePaymentStatus(cost, vendorFees),
      currency_code: line.currency_code,
      start_date: line.start_date,
      end_date: line.end_date,
    };
  });

  const budget = workspaceLines.reduce((s, l) => s + l.po_amount, 0);
  const revenue = workspaceLines.reduce((s, l) => s + l.revenue, 0);
  const cost = workspaceLines.reduce((s, l) => s + l.cost, 0);
  const gp = workspaceLines.reduce((s, l) => s + l.gp, 0);
  const remainingPo = workspaceLines.reduce((s, l) => s + l.remaining_po, 0);
  const billingOutstanding = invoices.reduce((s, i) => s + i.outstanding, 0);
  const collected = invoices.reduce((s, i) => s + i.amount_paid, 0);

  const deliverableIds = new Set(
    (deliverablesResult.data ?? []).map((d) => (d as { id: string }).id)
  );
  const vendorIds = new Set(vendors.map((v) => v.id));

  const deliverables = (deliverablesResult.data ?? []).map((row) => {
    const d = row as {
      id: string;
      document_number: string;
      deliverable_type: string;
      title: string;
      status: string;
      platform: string | null;
      due_date: string | null;
      submitted_at: string | null;
      approved_at: string | null;
      published_at: string | null;
      content_url: string | null;
      metrics: Record<string, unknown>;
      influencer: { display_name: string } | null;
    };
    return {
      id: d.id,
      document_number: d.document_number,
      deliverable_type: d.deliverable_type,
      title: d.title,
      status: d.status,
      display_status: mapDeliverableDisplayStatus(d.status),
      influencer_name: d.influencer?.display_name ?? "Unknown",
      platform: d.platform,
      due_date: d.due_date,
      submitted_at: d.submitted_at,
      approved_at: d.approved_at,
      published_at: d.published_at,
      content_url: d.content_url,
      metrics: d.metrics ?? {},
    };
  });

  const filteredApprovals = (approvalsResult.data ?? []).filter((a) => {
    const row = a as { entity_type: string; entity_id: string };
    if (row.entity_type === "campaign" && row.entity_id === campaignId) {
      return true;
    }
    if (row.entity_type === "deliverable" && deliverableIds.has(row.entity_id)) {
      return true;
    }
    if (
      row.entity_type === "campaign_influencer" &&
      vendorIds.has(row.entity_id)
    ) {
      return true;
    }
    return false;
  });

  const approvals = filteredApprovals.map((row) => {
    const a = row as {
      id: string;
      document_number: string;
      entity_type: string;
      title: string;
      status: string;
      due_at: string | null;
      decided_at: string | null;
      assignee: { full_name: string | null; email: string } | null;
    };
    return {
      id: a.id,
      document_number: a.document_number,
      entity_type: a.entity_type,
      title: a.title,
      status: a.status,
      assigned_to_name: a.assignee?.full_name ?? a.assignee?.email ?? null,
      due_at: a.due_at,
      decided_at: a.decided_at,
    };
  });

  const profileMap = new Map(
    (profilesResult.data ?? []).map((p) => [p.id, p])
  );

  const filteredAudit = (auditResult.data ?? []).filter((log) => {
    const row = log as { entity_type: string; entity_id: string | null };
    if (row.entity_type === "campaign_headers" && row.entity_id === campaignId) {
      return true;
    }
    if (row.entity_type === "campaign_lines" && row.entity_id && lineIds.has(row.entity_id)) {
      return true;
    }
    if (
      row.entity_type === "campaign_influencers" &&
      row.entity_id &&
      vendorIds.has(row.entity_id)
    ) {
      return true;
    }
    if (
      row.entity_type === "deliverables" &&
      row.entity_id &&
      deliverableIds.has(row.entity_id)
    ) {
      return true;
    }
    return false;
  });

  const blockers: string[] = [];
  if (approvals.some((a) => a.status === "pending" || a.status === "in_review")) {
    blockers.push("Pending approvals require action");
  }
  if (deliverables.some((d) => d.display_status === "rejected")) {
    blockers.push("Rejected deliverables need revision");
  }
  if (billingOutstanding > 0) {
    blockers.push("Outstanding client billing");
  }
  if (vendors.some((v) => v.status === "negotiating")) {
    blockers.push("Vendor negotiations in progress");
  }

  const headerRow = header as HeaderWithRelations;
  const platform =
    typeof headerRow.metadata?.[METADATA_PLATFORM_KEY] === "string"
      ? headerRow.metadata[METADATA_PLATFORM_KEY]
      : null;

  const workspaceVendors = vendors;
  const workflowStage = deriveWorkflowStage({
    status: headerRow.status,
    vendors: workspaceVendors,
    invoices,
  });

  return {
    id: headerRow.id,
    document_number: headerRow.document_number,
    name: headerRow.name,
    description: headerRow.description,
    brief: headerRow.brief,
    status: headerRow.status,
    currency_code: headerRow.currency_code,
    start_date: headerRow.start_date,
    end_date: headerRow.end_date,
    platform,
    group: headerRow.group,
    client: headerRow.client,
    brand: headerRow.brand,
    team: headerRow.team,
    account_manager: headerRow.account_manager,
    financials: {
      budget,
      revenue,
      cost,
      gp,
      margin_percent: formatMarginPercent(revenue, gp),
      po_total: budget,
      remaining_po: remainingPo,
      billing_outstanding: billingOutstanding,
      collected,
    },
    workflow_stage: workflowStage,
    lines: workspaceLines,
    vendors: workspaceVendors,
    deliverables,
    invoices,
    payments,
    approvals,
    activity: filteredAudit.slice(0, 30).map((log) => {
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
          ? {
              id: actor.id,
              full_name: actor.full_name,
              email: actor.email,
            }
          : null,
        summary: `${row.action} · ${row.entity_type}`,
      };
    }),
    blockers,
  };
}

export async function searchInfluencersForCampaign(params: {
  search?: string;
  platform?: string;
  limit?: number;
}): Promise<InfluencerSearchResult[]> {
  const { supabase } = await requireUser();
  const search = params.search?.trim() ?? "";
  const platform = params.platform?.trim() ?? "";
  const limit = params.limit ?? 20;

  let influencerIds: string[] | null = null;

  if (platform) {
    const { data: platformMatches, error } = await supabase
      .from("influencer_platform_accounts")
      .select("influencer_id")
      .eq("platform", platform);

    if (error) {
      throw new Error(error.message);
    }

    influencerIds = [
      ...new Set(platformMatches?.map((r) => r.influencer_id) ?? []),
    ];
    if (influencerIds.length === 0) {
      return [];
    }
  }

  let query = supabase
    .from("influencers")
    .select("id, document_number, display_name, status")
    .eq("status", "active")
    .order("display_name")
    .limit(limit);

  if (search) {
    const pattern = `%${escapeIlikePattern(search)}%`;
    query = query.or(
      [`display_name.ilike.${pattern}`, `document_number.ilike.${pattern}`].join(
        ","
      )
    );
  }

  if (influencerIds) {
    query = query.in("id", influencerIds);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const ids = (data ?? []).map((r) => r.id);
  if (ids.length === 0) {
    return [];
  }

  const { data: accounts } = await supabase
    .from("influencer_platform_accounts")
    .select(
      "influencer_id, platform, handle, profile_url, follower_count, engagement_rate"
    )
    .in("influencer_id", ids);

  const accountsByInfluencer = new Map<
    string,
    InfluencerSearchResult["platforms"]
  >();
  for (const account of accounts ?? []) {
    const list = accountsByInfluencer.get(account.influencer_id) ?? [];
    list.push({
      platform: account.platform,
      handle: account.handle,
      profile_url: account.profile_url,
      follower_count: account.follower_count,
      engagement_rate: account.engagement_rate,
    });
    accountsByInfluencer.set(account.influencer_id, list);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    document_number: row.document_number,
    display_name: row.display_name,
    status: row.status,
    platforms: accountsByInfluencer.get(row.id) ?? [],
  }));
}

export { getBrandHierarchySnapshot } from "@/lib/master-data/queries";
