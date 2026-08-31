import type { SupabaseClient } from "@supabase/supabase-js";

import {
  resolveCreatorFromRefLookup,
  resolveUnifiedCreatorsByRefs,
} from "@/lib/creators/unified-browse";
import { getAuthContext } from "@/lib/auth/permissions-server";
import { hasPermission } from "@/lib/auth/permissions";
import { buildClientSelectOptions } from "@/lib/clients/client-select-options";
import { enrichQuotationItemsForWorkspace } from "@/lib/services/quotations/enrich-quotation-item-avatars";
import {
  aggregateQuotationAudienceSize,
  aggregateQuotationEngagementRate,
  aggregateQuotationReach,
} from "@/lib/quotations/quotation-aggregate-metrics";
import {
  getBrandsForSelect,
  getClientsForSelect,
  getMasterDataOptions,
} from "@/lib/master-data/queries";
import { isCommercialSyncEnabled, stripQuotationVersionSuffix } from "@/lib/commercial-sync/rules";
import {
  readHideCostAndFees,
  readShowOriginalCurrency,
} from "@/lib/commercial/client-original-currency";
import { QUOTATION_PERMISSIONS } from "@/lib/domains/commercial/quotation-constants";
import { clientWorkspaceListLinkForSubject } from "@/features/client-workspace/client-review-selection";
import { loadClientWorkspaceListLinks } from "@/features/client-workspace/list-client-workspace-links";
import type { CommercialInputMode, Database, QuotationStatus } from "@/types/database";

import {
  isQuotationOfferExpired,
  quotationIsConvertedToCampaign,
  validDaysRemaining,
} from "@/lib/commercial/quotation-validity";
import {
  fetchLinkedShortlistSummary,
} from "@/lib/services/quotations/repositories/quotation-document-repository";
import type {
  PromoteWizardOptions,
  QuotationDeliverable,
  QuotationDetail,
  QuotationFormOptions,
  QuotationItemRow,
  QuotationListRow,
  QuotationCreatorPreview,
  QuotationRevisionRow,
  QuotationVersionSummary,
} from "@/lib/domains/commercial/quotation-detail-types";

function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapItem(raw: Record<string, unknown>): QuotationItemRow {
  return {
    id: raw.id as string,
    influencer_id: (raw.influencer_id as string | null) ?? null,
    profile_id: (raw.profile_id as string | null) ?? null,
    unified_id: (raw.unified_id as string | null) ?? null,
    source_shortlist_item_id: (raw.source_shortlist_item_id as string | null) ?? null,
    creator_name: (raw.creator_name as string | null) ?? null,
    platform: (raw.platform as string | null) ?? null,
    handle: (raw.handle as string | null) ?? null,
    followers: raw.followers != null ? Number(raw.followers) : null,
    engagement_rate: raw.engagement_rate != null ? Number(raw.engagement_rate) : null,
    country_code: (raw.country_code as string | null) ?? null,
    profile_image_url: (raw.profile_image_url as string | null) ?? null,
    profile_url: (raw.profile_url as string | null) ?? null,
    deliverables: Array.isArray(raw.deliverables)
      ? (raw.deliverables as QuotationDeliverable[])
      : [],
    option_number:
      raw.option_number == null || raw.option_number === ""
        ? null
        : Number(raw.option_number),
    service_description: (raw.service_description as string | null) ?? null,
    commercial_input_mode: (raw.commercial_input_mode as CommercialInputMode) ?? "cost_gp_pct",
    cost: Number(raw.cost ?? 0),
    cost_currency: (raw.cost_currency as string) ?? "EGP",
    revenue: Number(raw.revenue ?? 0),
    gp_pct: Number(raw.gp_pct ?? 0),
    gp_value: Number(raw.gp_value ?? 0),
    fx_rate_to_egp: Number(raw.fx_rate_to_egp ?? 1),
    cost_egp: Number(raw.cost_egp ?? 0),
    revenue_egp: Number(raw.revenue_egp ?? 0),
    gp_value_egp: Number(raw.gp_value_egp ?? 0),
    af_pct: Number(raw.af_pct ?? 0),
    af_value: Number(raw.af_value ?? 0),
    af_value_egp: Number(raw.af_value_egp ?? 0),
    sort_order: Number(raw.sort_order ?? 0),
    collapse_group_id: (raw.collapse_group_id as string | null) ?? null,
    collapse_label: (raw.collapse_label as string | null) ?? null,
  };
}

function mapRevision(raw: Record<string, unknown>): QuotationRevisionRow {
  return {
    id: raw.id as string,
    version: (raw.version as string) ?? "v1.0",
    updated_by_name: (raw.updated_by_name as string | null) ?? null,
    change_summary: (raw.change_summary as string | null) ?? null,
    created_at: raw.created_at as string,
  };
}

export async function getQuotationFormOptions(
  supabase: SupabaseClient<Database>
): Promise<QuotationFormOptions> {
  const [clients, brands, campaignsResult] = await Promise.all([
    getClientsForSelect(),
    getBrandsForSelect(),
    supabase
      .from("campaign_headers")
      .select("id, name, document_number")
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  if (campaignsResult.error) throw new Error(campaignsResult.error.message);

  return {
    clients: buildClientSelectOptions(clients).map((c) => ({
      id: c.value,
      name: c.label,
      legal_name: c.description ?? null,
    })),
    brands: brands.map((b) => ({
      id: b.id,
      name: b.name,
      client_id: b.client_id,
    })),
    campaigns: ((campaignsResult.data ?? []) as Array<{
      id: string;
      name: string;
      document_number: string | null;
    }>) ?? [],
  };
}

export async function getPromoteWizardOptions(
  supabase: SupabaseClient<Database>
): Promise<PromoteWizardOptions> {
  const [groups, clients, brands, masterData, ownersResult] = await Promise.all([
    supabase.from("groups").select("id, name").order("name").limit(200),
    getClientsForSelect(),
    getBrandsForSelect(),
    getMasterDataOptions(),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
  ]);

  if (groups.error) throw new Error(groups.error.message);
  if (ownersResult.error) throw new Error(ownersResult.error.message);

  return {
    groups: ((groups.data ?? []) as Array<{ id: string; name: string }>) ?? [],
    clients: (clients ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      legal_name: c.legal_name,
      document_number: c.document_number,
    })),
    brands: (brands ?? []).map((b) => ({
      id: b.id,
      name: b.name,
      client_id: b.client_id,
    })),
    categories: masterData.categories,
    subcategories: masterData.subcategories,
    owners: ((ownersResult.data ?? []) as Array<{
      id: string;
      full_name: string | null;
      email: string;
    }>) ?? [],
  };
}

export async function getQuotationsList(
  supabase: SupabaseClient<Database>
): Promise<QuotationListRow[]> {
  const { data, error } = await supabase
    .from("quotations")
    .select(
      `id, serial_number, name, status, shortlist_id, is_archived,
       owner_id, client_id, brand_id,
       total_cost_egp, total_revenue_egp, total_gp_value_egp, total_gp_pct,
       issue_date, validity_date, version,
       created_at, updated_at,
       clients:client_id(name),
       brands:brand_id(name),
       campaign_headers:campaign_header_id(name),
       owner:owner_id(full_name),
       quotation_items(count)`
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    const itemsAgg = row.quotation_items as Array<{ count: number }> | undefined;
    return {
      id: row.id as string,
      serial_number: (row.serial_number as string | null) ?? null,
      name: row.name as string,
      status: row.status as QuotationStatus,
      client_id: (row.client_id as string | null) ?? null,
      client_name: unwrap(row.clients as { name: string } | null)?.name ?? null,
      brand_id: (row.brand_id as string | null) ?? null,
      brand_name: unwrap(row.brands as { name: string } | null)?.name ?? null,
      campaign_name:
        unwrap(row.campaign_headers as { name: string } | null)?.name ?? null,
      shortlist_id: (row.shortlist_id as string | null) ?? null,
      owner_id: (row.owner_id as string | null) ?? null,
      owner_name: unwrap(row.owner as { full_name: string | null } | null)?.full_name ?? null,
      total_cost_egp: Number(row.total_cost_egp ?? 0),
      total_revenue_egp: Number(row.total_revenue_egp ?? 0),
      total_gp_value_egp: Number(row.total_gp_value_egp ?? 0),
      total_gp_pct: Number(row.total_gp_pct ?? 0),
      item_count: itemsAgg?.[0]?.count ?? 0,
      creator_previews: [] as QuotationCreatorPreview[],
      is_archived: Boolean(row.is_archived),
      issue_date: (row.issue_date as string | null) ?? null,
      validity_date: (row.validity_date as string | null) ?? null,
      version: (row.version as string) ?? "v1.0",
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  });

  if (rows.length === 0) return rows;

  const [creatorPreviews, linkIndex] = await Promise.all([
    loadQuotationCreatorPreviews(
      supabase,
      rows.map((row) => row.id)
    ),
    loadClientWorkspaceListLinks(supabase, {
      quotationIds: rows.map((row) => row.id),
      shortlistIds: rows.map((row) => row.shortlist_id),
    }),
  ]);

  return rows.map((row) => ({
    ...row,
    creator_previews: creatorPreviews.get(row.id) ?? [],
    client_workspace_link: clientWorkspaceListLinkForSubject(linkIndex, {
      quotationId: row.id,
      shortlistId: row.shortlist_id,
    }) ?? { state: "none" },
  }));
}

async function loadQuotationCreatorPreviews(
  supabase: SupabaseClient<Database>,
  quotationIds: string[]
): Promise<Map<string, QuotationCreatorPreview[]>> {
  const previews = new Map<string, QuotationCreatorPreview[]>();
  if (quotationIds.length === 0) return previews;

  const { data } = await supabase
    .from("quotation_items")
    .select(
      "quotation_id, creator_name, influencer_id, profile_id, unified_id, sort_order"
    )
    .in("quotation_id", quotationIds)
    .order("sort_order", { ascending: true });

  const items = (data ?? []) as Array<{
    quotation_id: string;
    creator_name: string | null;
    influencer_id: string | null;
    profile_id: string | null;
    unified_id: string | null;
  }>;

  const cappedByQuotation = new Map<string, typeof items>();
  for (const item of items) {
    const bucket = cappedByQuotation.get(item.quotation_id) ?? [];
    if (bucket.length < 4) bucket.push(item);
    cappedByQuotation.set(item.quotation_id, bucket);
  }

  if (cappedByQuotation.size === 0) return previews;

  const previewItems = [...cappedByQuotation.values()].flat();
  const lookup = await resolveUnifiedCreatorsByRefs(supabase, {
    unifiedIds: previewItems.map((item) => item.unified_id),
    influencerIds: previewItems.map((item) => item.influencer_id),
    discoveredProfileIds: previewItems.map((item) => item.profile_id),
  });

  for (const [quotationId, quotationItems] of cappedByQuotation) {
    const rowPreviews: QuotationCreatorPreview[] = [];
    for (const item of quotationItems) {
      const creator = resolveCreatorFromRefLookup(lookup, item);
      const displayName =
        creator?.display_name?.trim() ||
        item.creator_name?.trim() ||
        "Creator";
      rowPreviews.push({
        display_name: displayName,
        profile_image_url: creator?.profile_image_url ?? null,
      });
    }
    previews.set(quotationId, rowPreviews);
  }

  return previews;
}

/** Resolve a route key (UUID, serial, slug, or slug-shortId). */
export async function resolveQuotationIdByRouteKey(
  supabase: SupabaseClient<Database>,
  routeKey: string
): Promise<string | null> {
  const { resolveEntityIdByRouteKey } = await import("@/lib/routing/resolve-entity-route");
  return resolveEntityIdByRouteKey(supabase, "quotations", routeKey);
}

export async function getQuotationDetail(
  supabase: SupabaseClient<Database>,
  idOrSerial: string
): Promise<QuotationDetail | null> {
  const ctx = await getAuthContext(supabase);
  const canManage =
    ctx.roleSlug === "admin" ||
    ctx.roleSlug === "super_admin" ||
    (await hasPermission(supabase, QUOTATION_PERMISSIONS.write));

  const id = await resolveQuotationIdByRouteKey(supabase, idOrSerial);
  if (!id) return null;

  const { data, error } = await supabase
    .from("quotations")
    .select(
      `id, serial_number, name, status, shortlist_id, client_id, brand_id,
       campaign_header_id, owner_id, approved_by, approved_at, currency,
       total_cost_egp, total_revenue_egp, total_gp_value_egp, total_gp_pct,
       total_af_egp, total_agency_margin_egp,
       gp_target_pct, notes, terms, prepared_by_name, reviewed_by_name,
       client_signature_name, client_signed_at, client_visible, shared_with_client,
       issue_date, validity_date, version, department, change_summary,
       is_archived, created_at, updated_at,
       is_temporary_client, is_temporary_brand, temporary_client_name, temporary_brand_name,
       parent_quotation_id, version_number, revision_notes,
       campaign_object_id, source_campaign_object_version, metadata`
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as Record<string, unknown>;
  const clientId = (row.client_id as string | null) ?? null;
  const brandId = (row.brand_id as string | null) ?? null;
  const campaignHeaderId = (row.campaign_header_id as string | null) ?? null;
  const shortlistId = (row.shortlist_id as string | null) ?? null;
  const ownerId = (row.owner_id as string | null) ?? null;

  const [
    itemsResult,
    revisionsResult,
    clientResult,
    brandResult,
    campaignResult,
    shortlistResult,
    ownerResult,
  ] = await Promise.all([
    supabase
      .from("quotation_items")
      .select("*")
      .eq("quotation_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("quotation_revisions")
      .select("id, version, updated_by_name, change_summary, created_at")
      .eq("quotation_id", id)
      .order("created_at", { ascending: false }),
    clientId
      ? supabase
          .from("clients")
          .select("name, legal_name, onboarding_status, agency_or_direct, group_id")
          .eq("id", clientId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    brandId
      ? supabase
          .from("brands")
          .select("name, group_id, client_id")
          .eq("id", brandId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    campaignHeaderId
      ? supabase
          .from("campaign_headers")
          .select("name, document_number, group_id")
          .eq("id", campaignHeaderId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    shortlistId
      ? fetchLinkedShortlistSummary(supabase, shortlistId)
      : Promise.resolve({ data: null, error: null }),
    ownerId
      ? supabase
          .from("profiles")
          .select("full_name")
          .eq("id", ownerId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (itemsResult.error) throw new Error(itemsResult.error.message);
  // Related-entity lookups must not take down the quotation workspace after
  // shortlist → quotation create (client/brand often null; shortlist optional).
  if (revisionsResult.error) {
    console.warn("[quotation-detail] revisions lookup failed", revisionsResult.error.message);
  }
  if (clientResult.error) {
    console.warn("[quotation-detail] client lookup failed", clientResult.error.message);
  }
  if (brandResult.error) {
    console.warn("[quotation-detail] brand lookup failed", brandResult.error.message);
  }
  if (campaignResult.error) {
    console.warn("[quotation-detail] campaign lookup failed", campaignResult.error.message);
  }
  if (shortlistResult.error) {
    console.warn("[quotation-detail] shortlist lookup failed", shortlistResult.error.message);
  }
  if (ownerResult.error) {
    console.warn("[quotation-detail] owner lookup failed", ownerResult.error.message);
  }

  const mappedItems = ((itemsResult.data as Record<string, unknown>[]) ?? []).map(
    mapItem
  );
  let items = mappedItems;
  try {
    items = await enrichQuotationItemsForWorkspace(supabase, mappedItems);
  } catch (error) {
    console.warn(
      "[quotation-detail] workspace enrich failed; rendering bare line data",
      error instanceof Error ? error.message : error
    );
  }

  const revisions = ((revisionsResult.data as Record<string, unknown>[]) ?? [])
    .map(mapRevision)
    .sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  const clientRow = clientResult.data as {
    name: string;
    legal_name: string | null;
    onboarding_status: string | null;
    agency_or_direct: import("@/types/database").AgencyOrDirect | null;
    group_id: string | null;
  } | null;
  const brandRow = brandResult.data as {
    name: string;
    group_id: string | null;
    client_id: string | null;
  } | null;

  const campaignRow = campaignResult.data as {
    name: string;
    document_number: string | null;
    group_id: string | null;
  } | null;

  const groupId =
    brandRow?.group_id ?? clientRow?.group_id ?? campaignRow?.group_id ?? null;
  let groupName: string | null = null;
  if (groupId) {
    const { data: groupRow } = await supabase
      .from("groups")
      .select("name")
      .eq("id", groupId)
      .maybeSingle();
    groupName = (groupRow as { name?: string } | null)?.name ?? null;
  }

  const agencyOrDirect = clientRow?.agency_or_direct ?? null;
  const agencyName =
    agencyOrDirect === "agency"
      ? clientRow?.legal_name?.trim() || clientRow?.name?.trim() || null
      : null;
  const shortlistRow = shortlistResult.data as { serial_number: string | null } | null;
  const ownerRow = ownerResult.data as { full_name: string | null } | null;

  const validityDate = (row.validity_date as string | null) ?? null;
  const issueDate =
    (row.issue_date as string | null) ??
    (row.created_at as string).slice(0, 10);
  const status = row.status as QuotationStatus;
  const isTemporaryClient = Boolean(row.is_temporary_client);
  const isTemporaryBrand = Boolean(row.is_temporary_brand);
  const tempClientName = (row.temporary_client_name as string | null) ?? null;
  const tempBrandName = (row.temporary_brand_name as string | null) ?? null;
  const serialNumber = (row.serial_number as string | null) ?? null;
  const versionNumber = Number(row.version_number ?? 1);

  const baseSerial = stripQuotationVersionSuffix(serialNumber);
  let versionChain: QuotationVersionSummary[] = [];
  if (baseSerial) {
    const { data: siblings } = await supabase
      .from("quotations")
      .select("id, serial_number, version_number, status")
      .ilike("serial_number", `${baseSerial}%`)
      .order("version_number", { ascending: true });
    versionChain = ((siblings ?? []) as Array<Record<string, unknown>>).map((s) => ({
      id: s.id as string,
      serial_number: (s.serial_number as string | null) ?? null,
      version_number: Number(s.version_number ?? 1),
      status: s.status as QuotationStatus,
    }));
  }

  const detail = {
    id: row.id as string,
    serial_number: serialNumber,
    name: row.name as string,
    status,
    shortlist_id: (row.shortlist_id as string | null) ?? null,
    shortlist_serial: shortlistRow?.serial_number ?? null,
    client_id: clientId,
    client_name: isTemporaryClient ? tempClientName : clientRow?.name ?? null,
    client_onboarding_status: isTemporaryClient
      ? null
      : (clientRow?.onboarding_status as import("@/types/database").ClientOnboardingStatus | null) ??
        null,
    is_temporary_client: isTemporaryClient,
    is_temporary_brand: isTemporaryBrand,
    temporary_client_name: tempClientName,
    temporary_brand_name: tempBrandName,
    brand_id: brandId,
    brand_name: isTemporaryBrand ? tempBrandName : brandRow?.name ?? null,
    group_name: groupName,
    agency_or_direct: agencyOrDirect,
    agency_name: agencyName,
    campaign_header_id: campaignHeaderId,
    campaign_name: campaignRow?.name ?? null,
    campaign_document_number: campaignRow?.document_number ?? null,
    campaign_object_id: (row.campaign_object_id as string | null) ?? null,
    source_campaign_object_version:
      row.source_campaign_object_version != null
        ? Number(row.source_campaign_object_version)
        : null,
    parent_quotation_id: (row.parent_quotation_id as string | null) ?? null,
    version_number: versionNumber,
    revision_notes: (row.revision_notes as string | null) ?? null,
    sync_enabled: isCommercialSyncEnabled(status),
    version_chain: versionChain.length
      ? versionChain
      : [
          {
            id: row.id as string,
            serial_number: serialNumber,
            version_number: versionNumber,
            status,
          },
        ],
    owner_id: ownerId,
    owner_name: ownerRow?.full_name ?? null,
    approved_by: (row.approved_by as string | null) ?? null,
    approved_at: (row.approved_at as string | null) ?? null,
    currency: (row.currency as string) ?? "EGP",
    total_cost_egp: Number(row.total_cost_egp ?? 0),
    total_revenue_egp: Number(row.total_revenue_egp ?? 0),
    total_gp_value_egp: Number(row.total_gp_value_egp ?? 0),
    total_gp_pct: Number(row.total_gp_pct ?? 0),
    total_af_egp: Number(row.total_af_egp ?? 0),
    total_agency_margin_egp: Number(row.total_agency_margin_egp ?? 0),
    gp_target_pct: Number(row.gp_target_pct ?? 25),
    notes: (row.notes as string | null) ?? null,
    terms: (row.terms as string | null) ?? null,
    prepared_by_name: (row.prepared_by_name as string | null) ?? null,
    reviewed_by_name: (row.reviewed_by_name as string | null) ?? null,
    client_signature_name: (row.client_signature_name as string | null) ?? null,
    client_signed_at: (row.client_signed_at as string | null) ?? null,
    issue_date: issueDate,
    validity_date: validityDate,
    version: (row.version as string) ?? "v1.0",
    department: (row.department as string | null) ?? null,
    change_summary: (row.change_summary as string | null) ?? null,
    shared_with_client: Boolean(row.shared_with_client ?? row.client_visible),
    client_visible: Boolean(row.client_visible),
    is_archived: Boolean(row.is_archived),
    is_expired: isQuotationOfferExpired({
      validityDate,
      campaignHeaderId,
      status,
    }),
    valid_days_remaining: quotationIsConvertedToCampaign({
      campaignHeaderId,
      status,
    })
      ? null
      : validDaysRemaining(validityDate),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    items,
    revisions,
    canManage,
    audience_size: 0,
    estimated_reach: 0,
    estimated_engagement_rate: null as number | null,
    showOriginalCurrency: readShowOriginalCurrency(row.metadata),
    hideCostAndFees: readHideCostAndFees(row.metadata),
  };

  try {
    return {
      ...detail,
      audience_size: aggregateQuotationAudienceSize(items),
      estimated_reach: aggregateQuotationReach(items),
      estimated_engagement_rate: aggregateQuotationEngagementRate(items),
    };
  } catch (error) {
    console.warn(
      "[quotation-detail] forecast aggregate failed; workspace still loads",
      error instanceof Error ? error.message : error
    );
    return detail;
  }
}
