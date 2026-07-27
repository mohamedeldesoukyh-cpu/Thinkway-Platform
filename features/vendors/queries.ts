import { createSupabaseServerClient, requireRequestUser, type RequestUser } from "@/lib/supabase/server";
import { REL } from "@/lib/supabase/relation-hints";
import type {
  InfluencerPlatformAccountRow,
  InfluencerRow,
  InfluencerStatus,
  VendorCampaignAssignment,
  VendorDetail,
  VendorListItem,
} from "@/types/database";

import { VENDORS_PAGE_SIZE } from "./constants";
import type {
  VendorActivityItem,
  VendorAssignmentRow,
  VendorDeliverableRow,
  VendorFinancialSummary,
  VendorPayoutRow,
  VendorWorkspace,
} from "./types";
import { getQuotationPriceReferenceForInfluencer } from "@/lib/creators/quotation-price-reference";
import { fetchProfileNamesByIds } from "@/lib/services/campaigns/repositories/workspace-repository";

export type VendorsListResult = {
  vendors: (VendorListItem & {
    assignment_count: number;
    active_campaign_count: number;
  })[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type VendorListFilters = {
  page?: number;
  search?: string;
  status?: InfluencerStatus;
  platform?: string;
};

function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\,]/g, "\\$&");
}

/** List columns only — avoids heavy enrichment JSONB on `*`. */
const VENDOR_LIST_SELECT = `
  id,
  document_number,
  display_name,
  legal_name,
  email,
  status,
  country_code,
  country_codes,
  categories,
  rate_card,
  created_at,
  platform_accounts:influencer_platform_accounts!influencer_platform_accounts_influencer_id_fkey(
    id,
    platform,
    handle,
    follower_count,
    is_primary,
    profile_url,
    profile_picture_url
  )
`;

const VENDOR_LIST_SELECT_PLATFORM_FILTER = VENDOR_LIST_SELECT.replace(
  "influencer_platform_accounts!influencer_platform_accounts_influencer_id_fkey(",
  "influencer_platform_accounts!influencer_platform_accounts_influencer_id_fkey!inner("
);


export async function getVendorsList(
  params: VendorListFilters
): Promise<VendorsListResult> {
  const page = Math.max(1, params.page ?? 1);
  const search = params.search?.trim() ?? "";
  const status = params.status;
  const platform = params.platform?.trim() ?? "";
  const from = (page - 1) * VENDORS_PAGE_SIZE;
  const to = from + VENDORS_PAGE_SIZE - 1;

  // Middleware already validates the session; RLS enforces row access.
  // Pagination total uses vendor_list_total_count (avoids PostgREST exact-count
  // under per-row RLS, which timed out on ~7k influencers).
  const supabase = await createSupabaseServerClient();

  const select = platform ? VENDOR_LIST_SELECT_PLATFORM_FILTER : VENDOR_LIST_SELECT;
  let query = supabase
    .from("influencers")
    .select(select)
    .order("created_at", { ascending: false });

  if (platform) {
    query = query.eq("platform_accounts.platform", platform);
  }
  if (status) {
    query = query.eq("status", status);
  }
  if (search) {
    const pattern = `%${escapeIlikePattern(search)}%`;
    query = query.or(
      [
        `display_name.ilike.${pattern}`,
        `legal_name.ilike.${pattern}`,
        `document_number.ilike.${pattern}`,
        `email.ilike.${pattern}`,
      ].join(",")
    );
  }

  const [pageResult, countResult] = await Promise.all([
    query.range(from, to),
    supabase.rpc("vendor_list_total_count", {
      p_search: search || null,
      p_status: status ?? null,
      p_platform: platform || null,
    }),
  ]);

  if (pageResult.error) {
    throw new Error(pageResult.error.message);
  }
  if (countResult.error) {
    throw new Error(countResult.error.message);
  }

  const total = Number(countResult.data ?? 0);
  const vendors = await enrichVendorList(
    supabase,
    (pageResult.data ?? []) as unknown as VendorListItem[]
  );

  return {
    vendors,
    total,
    page,
    pageSize: VENDORS_PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / VENDORS_PAGE_SIZE)),
  };
}

async function enrichVendorList(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  vendorRows: VendorListItem[]
) {
  const influencerIds = vendorRows.map((v) => v.id);
  const assignmentCounts = new Map<string, number>();
  if (influencerIds.length > 0) {
    const { data: assignRows } = await supabase
      .from("campaign_influencers")
      .select("influencer_id")
      .in("influencer_id", influencerIds);
    for (const row of assignRows ?? []) {
      const id = (row as { influencer_id: string }).influencer_id;
      assignmentCounts.set(id, (assignmentCounts.get(id) ?? 0) + 1);
    }
  }
  return vendorRows.map((v) => ({
    ...v,
    assignment_count: assignmentCounts.get(v.id) ?? 0,
    active_campaign_count: assignmentCounts.get(v.id) ?? 0,
  }));
}

export async function getLinkableCreatorProfiles(
  vendorId: string
): Promise<{ id: string; full_name: string | null; email: string }[]> {
  const { supabase } = await requireRequestUser();

  const { data: roleRow } = await supabase
    .from("roles")
    .select("id")
    .eq("slug", "influencer")
    .maybeSingle();

  if (!roleRow) return [];

  const { data: profiles, error } = await (supabase as any)
    .from("profiles")
    .select("id, full_name, email")
    .eq("role_id", (roleRow as { id: string }).id)
    .eq("is_active", true)
    .order("full_name");

  if (error) throw new Error(error.message);

  const { data: linked } = await supabase
    .from("influencers")
    .select("id, profile_id")
    .not("profile_id", "is", null);

  const takenByOther = new Set(
    ((linked ?? []) as { id: string; profile_id: string }[])
      .filter((row) => row.id !== vendorId)
      .map((row) => row.profile_id)
  );

  return ((profiles ?? []) as { id: string; full_name: string | null; email: string }[]).filter(
    (profile) => !takenByOther.has(profile.id)
  );
}

export async function getVendorById(id: string): Promise<VendorDetail | null> {
  const { supabase } = await requireRequestUser();

  const { data: vendor, error } = await supabase
    .from("influencers")
    .select(
      `
      *,
      platform_accounts:influencer_platform_accounts!influencer_platform_accounts_influencer_id_fkey(
        id,
        platform,
        handle,
        username,
        profile_url,
        follower_count,
        engagement_rate,
        avg_views,
        audience_country,
        audience_gender_split,
        is_verified,
        is_primary,
        created_at,
        updated_at
      )
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!vendor) {
    return null;
  }

  const { data: documents, error: documentsError } = await supabase
    .from("influencer_documents")
    .select("*")
    .eq("influencer_id", id)
    .order("created_at", { ascending: false });

  if (documentsError) {
    throw new Error(documentsError.message);
  }

  const { data: assignments, error: assignmentsError } = await supabase
    .from("campaign_influencers")
    .select(
      `
      id,
      status,
      agreed_fee,
      currency,
      invited_at,
      confirmed_at,
      campaign:${REL.campaignInfluencers.campaignHeader}(id, name, document_number, status)
    `
    )
    .eq("influencer_id", id)
    .order("created_at", { ascending: false });

  if (assignmentsError) {
    throw new Error(assignmentsError.message);
  }

  const vendorRow = vendor as unknown as InfluencerRow & {
    platform_accounts?: InfluencerPlatformAccountRow[];
  };

  return {
    ...vendorRow,
    platform_accounts: vendorRow.platform_accounts ?? [],
    campaign_assignments: (assignments ?? []) as unknown as VendorCampaignAssignment[],
    documents: documents ?? [],
  };
}

function formatMarginPercent(revenue: number, gp: number): number {
  if (revenue <= 0) return 0;
  return Math.round((gp / revenue) * 10000) / 100;
}

type AuditLogRow = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
  actor_id: string | null;
};

async function fetchVendorActivityLogs(
  supabase: RequestUser["supabase"],
  influencerId: string,
  assignmentIds: string[]
): Promise<AuditLogRow[]> {
  const select =
    "id, action, entity_type, entity_id, created_at, actor_id, new_data" as const;

  if (assignmentIds.length === 0) {
    const { data, error } = await supabase
      .from("audit_logs")
      .select(select)
      .eq("entity_type", "influencers")
      .eq("entity_id", influencerId)
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) throw new Error(error.message);
    return (data ?? []) as AuditLogRow[];
  }

  const [influencerLogs, assignmentLogs] = await Promise.all([
    supabase
      .from("audit_logs")
      .select(select)
      .eq("entity_type", "influencers")
      .eq("entity_id", influencerId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("audit_logs")
      .select(select)
      .eq("entity_type", "campaign_influencers")
      .in("entity_id", assignmentIds)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  if (influencerLogs.error) throw new Error(influencerLogs.error.message);
  if (assignmentLogs.error) throw new Error(assignmentLogs.error.message);

  const merged = [...(influencerLogs.data ?? []), ...(assignmentLogs.data ?? [])] as AuditLogRow[];
  merged.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return merged.slice(0, 40);
}

export async function getVendorWorkspace(
  id: string
): Promise<VendorWorkspace | null> {
  const base = await getVendorById(id);
  if (!base) return null;

  const { supabase } = await requireRequestUser();

  const { data: assignmentRows, error: assignError } = await supabase
    .from("campaign_influencers")
    .select(
      `
      id, campaign_line_id, campaign_header_id, status, agreed_fee, currency, deliverable_count,
      vendor_payment_status, vendor_paid_at, invited_at, confirmed_at,
      campaign:${REL.campaignInfluencers.campaignHeader}(id, document_number, name, status),
      line:${REL.campaignInfluencers.campaignLine}(
        id, document_number, name, revenue, cost, profit,
        billing_status, assignment_status, metadata
      )
    `
    )
    .eq("influencer_id", id)
    .order("created_at", { ascending: false });

  if (assignError) throw new Error(assignError.message);

  const assignments: VendorAssignmentRow[] = (assignmentRows ?? []).map((row) => {
    const r = row as unknown as {
      id: string;
      campaign_line_id: string | null;
      campaign_header_id: string | null;
      status: string;
      agreed_fee: number;
      currency: string;
      deliverable_count: number;
      vendor_payment_status: string | null;
      invited_at: string | null;
      confirmed_at: string | null;
      campaign: { id: string; document_number: string; name: string; status: string } | null;
      line: {
        id: string;
        document_number: string;
        name: string;
        revenue: number;
        cost: number;
        profit: number;
        billing_status: string;
        assignment_status: string;
      } | null;
    };
    return {
      id: r.id,
      campaign_line_id: r.campaign_line_id,
      line_document_number: r.line?.document_number ?? null,
      line_name: r.line?.name ?? null,
      assignment_status: r.line?.assignment_status ?? null,
      billing_status: r.line?.billing_status ?? null,
      campaign_id: r.campaign?.id ?? r.campaign_header_id ?? null,
      campaign_document_number: r.campaign?.document_number ?? null,
      campaign_name: r.campaign?.name ?? null,
      campaign_status: r.campaign?.status ?? null,
      status: r.status,
      agreed_fee: Number(r.agreed_fee),
      currency: r.currency,
      deliverable_count: r.deliverable_count,
      vendor_payment_status: r.vendor_payment_status,
      revenue: Number(r.line?.revenue ?? r.agreed_fee),
      cost: Number(r.line?.cost ?? r.agreed_fee),
      gp: Number(r.line?.profit ?? 0),
      invited_at: r.invited_at,
      confirmed_at: r.confirmed_at,
    };
  });

  const assignmentIds = assignments.map((a) => a.id);

  const [deliverableResult, quotation_price_reference, auditRows] = await Promise.all([
    supabase
      .from("deliverables")
      .select(
        "id, document_number, title, deliverable_type, status, platform, due_date, campaign_id"
      )
      .eq("influencer_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    getQuotationPriceReferenceForInfluencer(supabase, id),
    fetchVendorActivityLogs(supabase, id, assignmentIds),
  ]);

  const deliverableRows = deliverableResult.data;

  const deliverableCampaignIds = [
    ...new Set(
      (deliverableRows ?? [])
        .map((d) => (d as { campaign_id: string }).campaign_id)
        .filter(Boolean)
    ),
  ];

  const campaignNameById = new Map<string, string>();
  if (deliverableCampaignIds.length > 0) {
    const { data: headerRows } = await supabase
      .from("campaign_headers")
      .select("id, name")
      .in("id", deliverableCampaignIds);
    for (const row of headerRows ?? []) {
      campaignNameById.set(row.id, row.name);
    }
  }

  const deliverables: VendorDeliverableRow[] = (deliverableRows ?? []).map((d) => {
    const row = d as unknown as {
      id: string;
      document_number: string;
      title: string;
      deliverable_type: string;
      status: string;
      platform: string | null;
      due_date: string | null;
      campaign_id: string;
    };
    return {
      id: row.id,
      document_number: row.document_number,
      title: row.title,
      deliverable_type: row.deliverable_type,
      status: row.status,
      platform: row.platform,
      due_date: row.due_date,
      campaign_name: campaignNameById.get(row.campaign_id) ?? null,
    };
  });

  const payouts: VendorPayoutRow[] = assignments.map((a) => ({
    id: a.id,
    assignment_id: a.id,
    campaign_name: a.campaign_name,
    amount: a.agreed_fee,
    currency: a.currency,
    status: a.vendor_payment_status ?? "unpaid",
    paid_at: null,
  }));

  const totalRevenue = assignments.reduce((s, a) => s + a.revenue, 0);
  const totalCost = assignments.reduce((s, a) => s + a.cost, 0);
  const totalGp = assignments.reduce((s, a) => s + a.gp, 0);
  const invoicedAmount = assignments
    .filter((a) => a.billing_status && !["draft", "approved"].includes(a.billing_status))
    .reduce((s, a) => s + a.revenue, 0);
  const paidOut = payouts
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + p.amount, 0);
  const pendingPayout = payouts
    .filter((p) => p.status !== "paid" && p.status !== "cancelled")
    .reduce((s, p) => s + p.amount, 0);

  const financials: VendorFinancialSummary = {
    total_revenue: totalRevenue,
    total_cost: totalCost,
    total_gp: totalGp,
    margin_percent: formatMarginPercent(totalRevenue, totalGp),
    invoiced_amount: invoicedAmount,
    paid_out: paidOut,
    pending_payout: pendingPayout,
  };

  const campaignIds = new Set(
    assignments.map((a) => a.campaign_id).filter(Boolean) as string[]
  );

  const actorIds = [
    ...new Set(auditRows.map((row) => row.actor_id).filter(Boolean) as string[]),
  ];
  const profileMap =
    actorIds.length > 0 ? await fetchProfileNamesByIds(supabase, actorIds) : new Map();

  const activity: VendorActivityItem[] = auditRows.map((row) => {
    const actor = row.actor_id ? profileMap.get(row.actor_id) : null;
    return {
      id: row.id,
      action: row.action,
      entity_type: row.entity_type,
      summary: `${row.action.replace(/_/g, " ")} · ${row.entity_type.replace(/_/g, " ")}`,
      created_at: row.created_at,
      actor: actor
        ? {
            id: actor.id,
            full_name: actor.full_name,
            email: actor.email,
          }
        : null,
    };
  });

  return {
    ...base,
    financials,
    counts: {
      assignments: assignments.length,
      campaigns: campaignIds.size,
      deliverables: deliverables.length,
      platforms: base.platform_accounts.length,
    },
    assignments,
    deliverables,
    payouts,
    activity,
    quotation_price_reference,
  };
}
