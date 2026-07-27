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
  VendorPayoutIoSummary,
  VendorPayoutRow,
  VendorWorkspace,
} from "./types";
import {
  getQuotationPriceReferenceForInfluencer,
  listQuotationHistoryForInfluencer,
} from "@/lib/creators/quotation-price-reference";
import { fetchProfileNamesByIds } from "@/lib/services/campaigns/repositories/workspace-repository";
import { isCreatorCrmFilterEnabled } from "@/lib/creators/crm/feature-flag";
import {
  computeCompletenessBreakdown,
  type CompletenessBreakdown,
} from "@/lib/creators/crm/completeness";
import {
  computePaymentReadiness,
  resolvePaymentBankAccount,
} from "@/lib/creators/crm/payment-readiness";
import type { CreatorCrmStatus } from "@/lib/creators/crm/types";
import type {
  CreatorCrmActivationEventRow,
  CreatorCrmProfileRow,
  InfluencerBankAccountRow,
  VendorIoCommunicationRow,
  VendorIoSignedArtifactRow,
  VendorPaymentTimelineEventRow,
} from "@/types/database";

export type VendorsListResult = {
  vendors: (VendorListItem & {
    assignment_count: number;
    active_campaign_count: number;
    has_commercial_profile?: boolean;
    crm_status?: CreatorCrmStatus | null;
    completeness_score?: number | null;
  })[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  crmOnly: boolean;
};

export type VendorListFilters = {
  page?: number;
  search?: string;
  status?: InfluencerStatus;
  platform?: string;
  /** Override CRM-only filter; default follows feature flag. */
  crmOnly?: boolean;
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
  has_commercial_profile,
  crm_profile:creator_crm_profiles!creator_crm_profiles_influencer_id_fkey(
    crm_status,
    completeness_score,
    activated_reason,
    onboarding_source
  ),
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
  const crmOnly = params.crmOnly ?? isCreatorCrmFilterEnabled();
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

  if (crmOnly) {
    query = query.eq("has_commercial_profile", true);
  }
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
      p_crm_only: crmOnly,
    }),
  ]);

  if (pageResult.error) {
    throw new Error(pageResult.error.message);
  }
  if (countResult.error) {
    throw new Error(countResult.error.message);
  }

  const total = Number(countResult.data ?? 0);
  const vendors = await enrichVendorList(supabase, pageResult.data ?? []);

  return {
    vendors,
    total,
    page,
    pageSize: VENDORS_PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / VENDORS_PAGE_SIZE)),
    crmOnly,
  };
}

type VendorListRow = VendorListItem & {
  has_commercial_profile?: boolean;
  crm_profile?:
    | {
        crm_status: CreatorCrmStatus;
        completeness_score: number;
        activated_reason?: string;
        onboarding_source?: string | null;
      }
    | {
        crm_status: CreatorCrmStatus;
        completeness_score: number;
        activated_reason?: string;
        onboarding_source?: string | null;
      }[]
    | null;
};

async function enrichVendorList(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  vendorRows: unknown[]
) {
  const rows = vendorRows as VendorListRow[];
  const influencerIds = rows.map((v) => v.id);
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
  return rows.map((v) => {
    const crm = Array.isArray(v.crm_profile)
      ? v.crm_profile[0]
      : v.crm_profile;
    return {
      ...v,
      assignment_count: assignmentCounts.get(v.id) ?? 0,
      active_campaign_count: assignmentCounts.get(v.id) ?? 0,
      has_commercial_profile: Boolean(v.has_commercial_profile),
      crm_status: crm?.crm_status ?? null,
      completeness_score:
        typeof crm?.completeness_score === "number"
          ? crm.completeness_score
          : null,
    };
  });
}

/** Search identities not yet in CRM — for New Creator → Discovery import. */
export async function searchIdentitiesForCrmImport(query: string, limit = 20) {
  const supabase = await createSupabaseServerClient();
  const search = query.trim();
  let q = supabase
    .from("influencers")
    .select("id, display_name, legal_name, email, document_number, has_commercial_profile")
    .eq("has_commercial_profile", false)
    .order("display_name")
    .limit(limit);
  if (search) {
    const pattern = `%${escapeIlikePattern(search)}%`;
    q = q.or(
      [
        `display_name.ilike.${pattern}`,
        `legal_name.ilike.${pattern}`,
        `email.ilike.${pattern}`,
        `document_number.ilike.${pattern}`,
      ].join(",")
    );
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
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

  const [
    deliverableResult,
    quotation_price_reference,
    quotation_history,
    auditRows,
    crmProfileResult,
    bankAccountsResult,
    activationEventsResult,
    vendorIosResult,
    signedIoResult,
    ioCommsResult,
    paymentTimelineResult,
  ] = await Promise.all([
    supabase
      .from("deliverables")
      .select(
        "id, document_number, title, deliverable_type, status, platform, due_date, campaign_id"
      )
      .eq("influencer_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    getQuotationPriceReferenceForInfluencer(supabase, id),
    listQuotationHistoryForInfluencer(supabase, id, 50),
    fetchVendorActivityLogs(supabase, id, assignmentIds),
    supabase
      .from("creator_crm_profiles")
      .select("*")
      .eq("influencer_id", id)
      .maybeSingle(),
    supabase
      .from("influencer_bank_accounts")
      .select("*")
      .eq("influencer_id", id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("creator_crm_activation_events")
      .select("*")
      .eq("influencer_id", id)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("vendor_ios")
      .select(
        "id, document_number, status, revision_number, created_at, document_generated_at, generated_pdf_url, is_superseded, root_vendor_io_id, assignment_id, campaign_header_id"
      )
      .eq("influencer_id", id)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("vendor_io_signed_artifacts")
      .select("*")
      .eq("influencer_id", id)
      .order("uploaded_at", { ascending: false })
      .limit(50),
    supabase
      .from("vendor_io_communications")
      .select("*")
      .eq("influencer_id", id)
      .order("occurred_at", { ascending: false })
      .limit(50),
    supabase
      .from("vendor_payment_timeline_events")
      .select("*")
      .eq("influencer_id", id)
      .order("created_at", { ascending: false })
      .limit(60),
  ]);

  const crm_profile = (crmProfileResult.data ?? null) as CreatorCrmProfileRow | null;
  const bank_accounts = (
    bankAccountsResult.error ? [] : (bankAccountsResult.data ?? [])
  ) as InfluencerBankAccountRow[];
  const activation_events = (activationEventsResult.data ??
    []) as CreatorCrmActivationEventRow[];
  const signed_io_artifacts = (
    signedIoResult.error ? [] : (signedIoResult.data ?? [])
  ) as VendorIoSignedArtifactRow[];
  const io_communications = (
    ioCommsResult.error ? [] : (ioCommsResult.data ?? [])
  ) as VendorIoCommunicationRow[];
  const payment_timeline = (
    paymentTimelineResult.error ? [] : (paymentTimelineResult.data ?? [])
  ) as VendorPaymentTimelineEventRow[];

  type IoRow = VendorPayoutIoSummary & {
    assignment_id: string | null;
    campaign_header_id: string | null;
  };
  const vendorIos = (vendorIosResult.error ? [] : (vendorIosResult.data ?? [])) as IoRow[];
  const iosByAssignment = new Map<string, IoRow[]>();
  const iosByCampaign = new Map<string, IoRow[]>();
  for (const io of vendorIos) {
    if (io.assignment_id) {
      const list = iosByAssignment.get(io.assignment_id) ?? [];
      list.push(io);
      iosByAssignment.set(io.assignment_id, list);
    }
    if (io.campaign_header_id) {
      const list = iosByCampaign.get(io.campaign_header_id) ?? [];
      list.push(io);
      iosByCampaign.set(io.campaign_header_id, list);
    }
  }
  const signedByIo = new Map<string, VendorIoSignedArtifactRow>();
  for (const artifact of signed_io_artifacts) {
    if (!signedByIo.has(artifact.vendor_io_id)) {
      signedByIo.set(artifact.vendor_io_id, artifact);
    }
  }

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

  const assignmentCampaignIds = [
    ...new Set(assignments.map((a) => a.campaign_id).filter(Boolean) as string[]),
  ];
  const campaignContextById = new Map<
    string,
    {
      document_number: string | null;
      po_status: string | null;
      po_number: string | null;
      po_issue_date: string | null;
      client_name: string | null;
      brand_name: string | null;
    }
  >();
  if (assignmentCampaignIds.length > 0) {
    const { data: campaignRows } = await supabase
      .from("campaign_headers")
      .select(
        `
        id, document_number, po_status, po_number, created_at,
        client:clients(name),
        brand:brands(name)
      `
      )
      .in("id", assignmentCampaignIds);
    for (const row of campaignRows ?? []) {
      const r = row as unknown as {
        id: string;
        document_number: string | null;
        po_status: string | null;
        po_number: string | null;
        created_at: string | null;
        client: { name: string } | null;
        brand: { name: string } | null;
      };
      campaignContextById.set(r.id, {
        document_number: r.document_number,
        po_status: r.po_status,
        po_number: r.po_number,
        po_issue_date: r.created_at,
        client_name: r.client?.name ?? null,
        brand_name: r.brand?.name ?? null,
      });
    }
  }

  const paymentBank = resolvePaymentBankAccount(
    bank_accounts,
    (base.payment_details as Record<string, unknown> | null) ?? null
  );
  const bankLabel = paymentBank
    ? [paymentBank.bank_name, paymentBank.currency, paymentBank.iban || paymentBank.account_number]
        .filter(Boolean)
        .join(" · ")
    : null;

  const payouts: VendorPayoutRow[] = assignments.map((a) => {
    const ctx = a.campaign_id ? campaignContextById.get(a.campaign_id) : null;
    const versions =
      (a.id && iosByAssignment.get(a.id)) ||
      (a.campaign_id ? iosByCampaign.get(a.campaign_id) : null) ||
      [];
    const activeIo =
      versions.find((io) => !io.is_superseded) ?? versions[0] ?? null;
    return {
      id: a.id,
      assignment_id: a.id,
      campaign_id: a.campaign_id,
      campaign_name: a.campaign_name,
      campaign_document_number: ctx?.document_number ?? a.campaign_document_number,
      client_name: ctx?.client_name ?? null,
      brand_name: ctx?.brand_name ?? null,
      line_id: a.campaign_line_id,
      amount: a.agreed_fee,
      currency: a.currency,
      status: a.vendor_payment_status ?? "unpaid",
      paid_at: null,
      po_status: ctx?.po_status ?? null,
      po_number: ctx?.po_number ?? null,
      po_issue_date: ctx?.po_number ? ctx.po_issue_date : null,
      io: activeIo
        ? {
            id: activeIo.id,
            document_number: activeIo.document_number,
            status: activeIo.status,
            revision_number: activeIo.revision_number ?? 0,
            created_at: activeIo.created_at,
            document_generated_at: activeIo.document_generated_at,
            generated_pdf_url: activeIo.generated_pdf_url,
            is_superseded: activeIo.is_superseded,
            root_vendor_io_id: activeIo.root_vendor_io_id,
          }
        : null,
      io_versions: versions.map((io) => ({
        id: io.id,
        document_number: io.document_number,
        status: io.status,
        revision_number: io.revision_number ?? 0,
        created_at: io.created_at,
        document_generated_at: io.document_generated_at,
        generated_pdf_url: io.generated_pdf_url,
        is_superseded: io.is_superseded,
        root_vendor_io_id: io.root_vendor_io_id,
      })),
      signed_io: activeIo ? signedByIo.get(activeIo.id) ?? null : null,
      bank_label: bankLabel,
    };
  });

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

  const activityFromAudit: VendorActivityItem[] = auditRows.map((row) => {
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

  const activityFromCrm: VendorActivityItem[] = activation_events.map((event) => ({
    id: `crm-${event.id}`,
    action: event.reason,
    entity_type: event.source_entity_type ?? "creator_crm",
    summary: `CRM · ${event.reason.replace(/_/g, " ")}${
      event.source_entity_type ? ` · ${event.source_entity_type.replace(/_/g, " ")}` : ""
    }`,
    created_at: event.created_at,
    actor: null,
  }));

  let crm_completeness: CompletenessBreakdown | null = null;
  if (crm_profile) {
    const storedMissing = Array.isArray(crm_profile.completeness_missing)
      ? (crm_profile.completeness_missing as CompletenessBreakdown["missing"])
      : [];
    crm_completeness = computeCompletenessBreakdown({
      influencer: {
        display_name: base.display_name,
        email: base.email,
        phone: base.phone,
        country_code: base.country_code,
        legal_name: base.legal_name,
        rate_card: (base.rate_card as Record<string, unknown> | null) ?? null,
        payment_details:
          (base.payment_details as Record<string, unknown> | null) ?? null,
        payment_terms: base.payment_terms,
        vat_registered: base.vat_registered,
        tax_registration_number: base.tax_registration_number,
        contract_status: base.contract_status,
        preferred_currency: crm_profile.preferred_currency,
      },
      platformCount: base.platform_accounts.length,
      documentTypes: base.documents.map((d) => d.document_type),
      bankAccountCount: bank_accounts.length,
      verifiedDefaultBank: bank_accounts.some((b) => b.is_default && b.is_verified),
    });
    if (storedMissing.length > 0 && crm_profile.completeness_score != null) {
      crm_completeness = {
        ...crm_completeness,
        overall: Number(crm_profile.completeness_score),
        missing:
          storedMissing.length > 0 ? storedMissing : crm_completeness.missing,
      };
    }
  }

  const payment_readiness = computePaymentReadiness({
    bank: paymentBank,
    documentTypes: base.documents.map((d) => d.document_type),
  });

  const activityFromPayment: VendorActivityItem[] = payment_timeline.map((event) => ({
    id: `pay-${event.id}`,
    action: event.event_type,
    entity_type: "vendor_payment",
    summary: event.summary,
    created_at: event.created_at,
    actor: null,
  }));

  const activityMerged: VendorActivityItem[] = [
    ...activityFromAudit,
    ...activityFromCrm,
    ...activityFromPayment,
  ]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 80);

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
    activity: activityMerged,
    quotation_price_reference,
    quotation_history,
    crm_profile,
    crm_completeness,
    bank_accounts,
    activation_events,
    payment_readiness,
    payment_timeline,
    io_communications,
    signed_io_artifacts,
  };
}
