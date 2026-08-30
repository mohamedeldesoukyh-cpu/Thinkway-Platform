import type { SupabaseClient } from "@supabase/supabase-js";

import { CAMPAIGNS_PAGE_SIZE } from "@/lib/campaigns/constants";
import {
  syncCampaignHeaderStatusesForList,
} from "@/lib/campaigns/sync-campaign-header-status";
import {
  getBrandsForCampaignForm,
  getClientsForSelect,
  getGroupsForSelect,
  getMasterDataOptions,
} from "@/lib/master-data/queries";
import { DEFAULT_PLATFORM_CURRENCY } from "@/lib/master-data/default-currency";
import {
  campaignClientWorkspaceLinkFromLatest,
  campaignHeaderIdsWithShareToken,
  latestCampaignClientReviewByHeader,
} from "@/features/client-workspace/client-review-selection";
import type { AgencyOrDirect, CampaignListItem } from "@/types/database";

import { escapeIlikePattern } from "../campaign-commercial";

export type BrandForCampaignCreate = {
  id: string;
  client_id: string;
  group_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  vr_rate_id: string | null;
  currency_code: string;
  client: { agency_or_direct: AgencyOrDirect | null } | null;
};

export async function fetchBrandForCampaignCreate(
  supabase: SupabaseClient,
  brandId: string
): Promise<{ brand: BrandForCampaignCreate | null; error: string | null }> {
  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select(
      "id, client_id, group_id, category_id, subcategory_id, vr_rate_id, currency_code, client:clients(agency_or_direct)"
    )
    .eq("id", brandId)
    .maybeSingle();

  if (brandError) {
    return { brand: null, error: brandError.message };
  }
  if (!brand) {
    return { brand: null, error: "Brand not found." };
  }

  return { brand: brand as unknown as BrandForCampaignCreate, error: null };
}

export async function insertCampaignHeader(
  supabase: SupabaseClient,
  input: {
    name: string;
    brand: BrandForCampaignCreate;
    status: string;
    currency_code: string;
    start_date: string | null;
    end_date: string | null;
    account_manager_id: string | null;
    metadata: Record<string, unknown>;
    created_by: string;
    campaign_object_id?: string | null;
    source_campaign_object_version?: number | null;
  }
) {
  return supabase
    .from("campaign_headers")
    .insert({
      name: input.name,
      brand_id: input.brand.id,
      client_id: input.brand.client_id,
      group_id: input.brand.group_id,
      status: input.status,
      currency_code: input.currency_code,
      category_id: input.brand.category_id,
      subcategory_id: input.brand.subcategory_id,
      agency_or_direct: input.brand.client?.agency_or_direct ?? null,
      vr_rate_id: input.brand.vr_rate_id,
      start_date: input.start_date,
      end_date: input.end_date,
      account_manager_id: input.account_manager_id,
      metadata: input.metadata,
      created_by: input.created_by,
      campaign_object_id: input.campaign_object_id ?? null,
      source_campaign_object_version: input.source_campaign_object_version ?? null,
    })
    .select("id, document_number")
    .single();
}

export async function updateCampaignPoFields(
  supabase: SupabaseClient,
  campaignId: string,
  input: {
    currency: string;
    fxRate: number;
    poAmount: number;
  }
) {
  return supabase
    .from("campaign_headers")
    .update({
      po_currency: input.currency,
      po_exchange_rate: input.fxRate,
      po_amount_original: input.poAmount,
      po_amount_campaign_currency: input.poAmount,
      po_status: input.poAmount > 0 ? "active" : "draft",
    } as never)
    .eq("id", campaignId);
}

export async function deleteCampaignHeader(supabase: SupabaseClient, campaignId: string) {
  return supabase.from("campaign_headers").delete().eq("id", campaignId);
}

export async function fetchCampaignHeaderForUpdate(
  supabase: SupabaseClient,
  campaignId: string
) {
  return supabase
    .from("campaign_headers")
    .select("metadata, client_id, group_id")
    .eq("id", campaignId)
    .maybeSingle();
}

export async function updateCampaignHeaderFields(
  supabase: SupabaseClient,
  campaignId: string,
  fields: Record<string, unknown>
) {
  return supabase.from("campaign_headers").update(fields).eq("id", campaignId);
}

export async function fetchGroupNamesByIds(
  supabase: SupabaseClient,
  groupIds: string[]
) {
  if (groupIds.length === 0) {
    return new Map<string, string>();
  }
  const { data: groupRows } = await supabase
    .from("groups")
    .select("id, name")
    .in("id", groupIds);
  const groupNameById = new Map<string, string>();
  for (const row of groupRows ?? []) {
    groupNameById.set(row.id, row.name);
  }
  return groupNameById;
}

export async function fetchCampaignHeaderContext(
  supabase: SupabaseClient,
  campaignId: string
) {
  return supabase
    .from("campaign_headers")
    .select("client_id, currency_code")
    .eq("id", campaignId)
    .maybeSingle();
}

export async function listCampaignHeaders(
  supabase: SupabaseClient,
  params: { page: number; search: string }
) {
  const from = (params.page - 1) * CAMPAIGNS_PAGE_SIZE;
  const to = from + CAMPAIGNS_PAGE_SIZE - 1;

  let query = supabase
    .from("campaign_headers")
    .select(
      `
      *,
      brand:brands(id, name),
      client:clients(id, name, document_number, legal_name),
      group:groups(id, name),
      account_manager:profiles!campaign_headers_account_manager_id_fkey(id, full_name, email),
      lines:campaign_lines(id, document_number, name, po_amount, revenue, cost, profit, billing_status, invoice_id)
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false });

  if (params.search) {
    const pattern = `%${escapeIlikePattern(params.search)}%`;
    query = query.or(
      [`name.ilike.${pattern}`, `document_number.ilike.${pattern}`].join(",")
    );
  }

  return query.range(from, to);
}

export type CampaignNavOption = {
  id: string;
  document_number: string | null;
  name: string;
};

/** Ordered campaign ids for filtered Previous/Next (full result set, not page-local). */
export async function listCampaignHeaderIdsForNav(
  supabase: SupabaseClient,
  params: { search?: string; limit?: number }
): Promise<{ ids: string[]; error: { message: string } | null }> {
  const { options, error } = await listCampaignHeadersForNav(supabase, params);
  if (error) return { ids: [], error };
  return { ids: options.map((row) => row.id), error: null };
}

/** Camp Code + Name options for workspace jump dropdown (scrollable searchable list). */
export async function listCampaignHeadersForNav(
  supabase: SupabaseClient,
  params: { search?: string; limit?: number } = {}
): Promise<{ options: CampaignNavOption[]; error: { message: string } | null }> {
  const limit = Math.min(Math.max(params.limit ?? 5000, 1), 5000);
  let query = supabase
    .from("campaign_headers")
    .select("id, document_number, name")
    .order("created_at", { ascending: false })
    .limit(limit);

  const search = params.search?.trim() ?? "";
  if (search) {
    const pattern = `%${escapeIlikePattern(search)}%`;
    query = query.or(
      [`name.ilike.${pattern}`, `document_number.ilike.${pattern}`].join(",")
    );
  }

  const { data, error } = await query;
  if (error) return { options: [], error };
  return {
    options: ((data ?? []) as CampaignNavOption[]).map((row) => ({
      id: row.id,
      document_number: row.document_number?.trim() || null,
      name: row.name?.trim() || "Untitled campaign",
    })),
    error: null,
  };
}

export async function syncListCampaignStatuses(
  supabase: SupabaseClient,
  campaigns: CampaignListItem[]
) {
  try {
    await syncCampaignHeaderStatusesForList(supabase, campaigns);
  } catch (syncError) {
    console.warn("[campaigns-list] syncCampaignHeaderStatusesForList failed", syncError);
  }
}

/**
 * Attach Client IO / Vendor IO aggregates so portfolio Decision Center matches workspace.
 * Without this, list cues always show "Generate Client IO" (STAB-008).
 */
export async function enrichCampaignListLifecycleSignals(
  supabase: SupabaseClient,
  campaigns: CampaignListItem[]
): Promise<CampaignListItem[]> {
  if (campaigns.length === 0) return campaigns;
  const ids = campaigns.map((c) => c.id);

  const [cioResult, vioResult, reviewResult, journeyResult] = await Promise.all([
    supabase
      .from("client_ios")
      .select("campaign_header_id, status, created_at")
      .in("campaign_header_id", ids)
      .order("created_at", { ascending: false }),
    supabase
      .from("vendor_ios")
      .select("campaign_header_id, status")
      .in("campaign_header_id", ids),
    supabase
      .from("campaign_client_reviews")
      .select("campaign_header_id, status, review_number")
      .in("campaign_header_id", ids),
    supabase
      .from("campaign_client_journeys")
      .select("campaign_header_id, share_token")
      .in("campaign_header_id", ids),
  ]);

  if (cioResult.error) {
    console.warn("[campaigns-list] client_ios enrich failed", cioResult.error.message);
  }
  if (vioResult.error) {
    console.warn("[campaigns-list] vendor_ios enrich failed", vioResult.error.message);
  }
  if (reviewResult.error) {
    console.warn("[campaigns-list] client reviews enrich failed", reviewResult.error.message);
  }
  if (journeyResult.error) {
    console.warn("[campaigns-list] client journeys enrich failed", journeyResult.error.message);
  }

  const latestCio = new Map<string, string>();
  for (const row of (cioResult.data ?? []) as Array<{
    campaign_header_id: string;
    status: string;
  }>) {
    if (!latestCio.has(row.campaign_header_id)) {
      latestCio.set(row.campaign_header_id, row.status);
    }
  }

  const vioStats = new Map<
    string,
    { total: number; approved: number; sent: number }
  >();
  for (const row of (vioResult.data ?? []) as Array<{
    campaign_header_id: string;
    status: string;
  }>) {
    const cur = vioStats.get(row.campaign_header_id) ?? {
      total: 0,
      approved: 0,
      sent: 0,
    };
    cur.total += 1;
    if (row.status === "approved") cur.approved += 1;
    if (row.status === "sent" || row.status === "generated") cur.sent += 1;
    vioStats.set(row.campaign_header_id, cur);
  }

  const latestReviews = latestCampaignClientReviewByHeader(
    (reviewResult.data ?? []) as Array<{
      campaign_header_id: string;
      status: string;
      review_number: number;
    }>
  );
  const journeyShareHeaders = campaignHeaderIdsWithShareToken(
    (journeyResult.data ?? []) as Array<{
      campaign_header_id?: string | null;
      share_token?: string | null;
    }>
  );

  return campaigns.map((campaign) => {
    const status = latestCio.get(campaign.id) ?? null;
    const vio = vioStats.get(campaign.id);
    const review = latestReviews.get(campaign.id);
    return {
      ...campaign,
      client_io_status: status,
      has_client_io: status != null,
      vendor_io_count: vio?.total ?? 0,
      approved_vendor_io_count: vio?.approved ?? 0,
      sent_vendor_io_count: vio?.sent ?? 0,
      client_workspace_link: campaignClientWorkspaceLinkFromLatest({
        latestStatus: review?.status,
        reviewNumber: review?.review_number,
        journeyHasShareToken: journeyShareHeaders.has(campaign.id),
      }),
    };
  });
}

export async function fetchCampaignKpiSourceData(supabase: SupabaseClient) {
  return Promise.all([
    supabase.from("campaign_headers").select("id, status, currency_code").limit(2000),
    supabase
      .from("campaign_lines")
      .select(
        "campaign_header_id, revenue, cost, profit, billing_status, revenue_before_vat, usage_rights_amount, usage_rights_cost, agency_fee_percent, agency_fee_amount, cost_before_vat"
      )
      .limit(5000),
    supabase
      .from("campaign_influencers")
      .select("id, campaign_header_id")
      .limit(20000),
  ]);
}

export async function fetchCampaignFormOptionsData(supabase: SupabaseClient) {
  return Promise.all([
    getGroupsForSelect(),
    getClientsForSelect(),
    getBrandsForCampaignForm(),
    getMasterDataOptions(),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
  ]);
}

export type SourceCampaignHeader = {
  id: string;
  brand_id: string;
  client_id: string;
  group_id: string | null;
  description: string | null;
  brief: string | null;
  currency_code: string;
  category_id: string | null;
  subcategory_id: string | null;
  agency_or_direct: AgencyOrDirect | null;
  vr_rate_id: string | null;
  team_id: string | null;
  report_type_id: string | null;
  account_manager_id: string | null;
  objectives: string | null;
  metadata: Record<string, unknown>;
};

export async function fetchSourceCampaign(
  supabase: SupabaseClient,
  sourceId: string
) {
  return supabase.from("campaign_headers").select("*").eq("id", sourceId).maybeSingle();
}

export async function fetchSourceCampaignLines(
  supabase: SupabaseClient,
  sourceId: string
) {
  return supabase
    .from("campaign_lines")
    .select("*")
    .eq("campaign_header_id", sourceId)
    .order("document_number");
}

export async function fetchCampaignInfluencersForDuplicate(
  supabase: SupabaseClient,
  sourceId: string
) {
  return supabase
    .from("campaign_influencers")
    .select("*")
    .or(`campaign_header_id.eq.${sourceId},campaign_id.eq.${sourceId}`);
}

export async function fetchSourceDeliverables(
  supabase: SupabaseClient,
  sourceId: string
) {
  return supabase.from("deliverables").select("*").eq("campaign_id", sourceId);
}

export async function fetchCampaignLineById(
  supabase: SupabaseClient,
  lineId: string,
  campaignId: string
) {
  return supabase
    .from("campaign_lines")
    .select(
      "revenue_locked, cost_locked, revenue, cost, revenue_before_vat, cost_before_vat, vat_locked, document_number, finance_override_until, vendor_io_id, vendor_assignment_locked, metadata, operational_status, invoice_id, source_quotation_item_id, agency_fee_percent, agency_fee_amount, usage_rights_amount, usage_rights_cost, currency_code, fx_rate, revenue_vat_percent, cost_vat_percent, revenue_vat_exempt, cost_vat_exempt"
    )
    .eq("id", lineId)
    .eq("campaign_header_id", campaignId)
    .maybeSingle();
}

export async function insertCampaignLine(
  supabase: SupabaseClient,
  payload: Record<string, unknown>
) {
  return supabase.from("campaign_lines").insert(payload).select("id, document_number").single();
}

export async function updateCampaignLine(
  supabase: SupabaseClient,
  lineId: string,
  campaignId: string,
  payload: Record<string, unknown>
) {
  return supabase
    .from("campaign_lines")
    .update(payload)
    .eq("id", lineId)
    .eq("campaign_header_id", campaignId);
}

export async function unlockCampaignLineFinanceFields(
  supabase: SupabaseClient,
  lineId: string
) {
  return supabase
    .from("campaign_lines")
    .update({
      revenue_locked: false,
      cost_locked: false,
      vendor_assignment_locked: false,
      vat_locked: false,
    } as never)
    .eq("id", lineId);
}

export async function fetchInvoiceRegenerationStatus(
  supabase: SupabaseClient,
  invoiceId: string
) {
  return supabase
    .from("invoices")
    .select("regeneration_status")
    .eq("id", invoiceId)
    .maybeSingle();
}

export async function deleteCampaignLine(supabase: SupabaseClient, lineId: string) {
  return supabase.from("campaign_lines").delete().eq("id", lineId);
}

export async function deleteCampaignInfluencer(
  supabase: SupabaseClient,
  assignmentId: string
) {
  return supabase.from("campaign_influencers").delete().eq("id", assignmentId);
}
