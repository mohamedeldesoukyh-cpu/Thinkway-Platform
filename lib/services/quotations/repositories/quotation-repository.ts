import type { SupabaseClient } from "@supabase/supabase-js";

import { REPORTING_CURRENCY } from "@/lib/commercial/fx-aggregation";
import { resolveRateToEgp } from "@/lib/commercial/fx-server";
import { formatQuotationTermsText } from "@/lib/commercial/quotation-default-terms";
import { defaultValidityDateFromIssue } from "@/lib/commercial/quotation-validity";
import { normalizeCommercialLine } from "@/lib/commercial/quotation-engine";
import type { CommercialInputMode, Database } from "@/types/database";

import type { QuotationItemSeed } from "../quotation-helpers";

export async function buildItemInsertRows(
  supabase: SupabaseClient<Database>,
  quotationId: string,
  seeds: QuotationItemSeed[],
  startSort: number
) {
  const rateCache = new Map<string, number>();
  const rows = [];
  let sort = startSort;
  for (const seed of seeds) {
    const currency = (seed.cost_currency || REPORTING_CURRENCY).toUpperCase();
    let rate = rateCache.get(currency);
    if (rate == null) {
      rate = await resolveRateToEgp(supabase, currency);
      rateCache.set(currency, rate);
    }
    const mode: CommercialInputMode = seed.commercial_input_mode ?? "cost_markup_pct";
    const line = normalizeCommercialLine({
      mode,
      cost: seed.cost,
      costCurrency: currency,
      gpPct: seed.gp_pct,
      revenue: seed.revenue,
      gpValue: seed.gp_value,
      afPct: seed.af_pct,
      fxRateToEgp: rate,
    });
    rows.push({
      quotation_id: quotationId,
      influencer_id: seed.influencer_id ?? null,
      profile_id: seed.profile_id ?? null,
      unified_id: seed.unified_id ?? null,
      source_shortlist_item_id: seed.source_shortlist_item_id ?? null,
      creator_name: seed.creator_name ?? null,
      platform: seed.platform ?? null,
      handle: seed.handle ?? null,
      followers: seed.followers ?? null,
      engagement_rate: seed.engagement_rate ?? null,
      country_code: seed.country_code ?? null,
      deliverables: (seed.deliverables ?? []) as unknown as Database["public"]["Tables"]["quotation_items"]["Insert"]["deliverables"],
      commercial_input_mode: line.commercial_input_mode,
      cost: line.cost,
      cost_currency: line.cost_currency,
      revenue: line.revenue,
      gp_pct: line.gp_pct,
      gp_value: line.gp_value,
      af_pct: line.af_pct,
      af_value: line.af_value,
      fx_rate_to_egp: line.fx_rate_to_egp,
      cost_egp: line.cost_egp,
      revenue_egp: line.revenue_egp,
      gp_value_egp: line.gp_value_egp,
      af_value_egp: line.af_value_egp,
      sort_order: sort++,
    });
  }
  return rows;
}

export async function insertQuotationItems(
  supabase: SupabaseClient<Database>,
  rows: Record<string, unknown>[]
) {
  return supabase.from("quotation_items").insert(rows as never);
}

export async function deleteQuotationItem(
  supabase: SupabaseClient<Database>,
  itemId: string
) {
  return supabase.from("quotation_items").delete().eq("id", itemId);
}

export async function fetchQuotationItemEgpTotals(
  supabase: SupabaseClient<Database>,
  quotationId: string
) {
  return supabase
    .from("quotation_items")
    .select("cost_egp, revenue_egp, gp_value_egp, af_value_egp")
    .eq("quotation_id", quotationId);
}

export async function fetchMaxItemSortOrder(
  supabase: SupabaseClient<Database>,
  quotationId: string
) {
  return supabase
    .from("quotation_items")
    .select("sort_order")
    .eq("quotation_id", quotationId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
}

export async function fetchExistingShortlistSourceIds(
  supabase: SupabaseClient<Database>,
  quotationId: string
) {
  return supabase
    .from("quotation_items")
    .select("source_shortlist_item_id")
    .eq("quotation_id", quotationId);
}

export async function fetchQuotationItemsByIds(
  supabase: SupabaseClient<Database>,
  quotationId: string,
  itemIds: string[]
) {
  return supabase
    .from("quotation_items")
    .select("*")
    .eq("quotation_id", quotationId)
    .in("id", itemIds);
}

export async function duplicateQuotationItemRows(
  supabase: SupabaseClient<Database>,
  quotationId: string,
  itemIds: string[]
) {
  const { data: existing, error: loadError } = await fetchQuotationItemsByIds(
    supabase,
    quotationId,
    itemIds
  );
  if (loadError) return { ok: false as const, message: loadError.message, inserts: [] as Record<string, unknown>[] };

  const rows = (existing ?? []) as Array<Record<string, unknown>>;
  if (rows.length === 0) {
    return { ok: false as const, message: "No matching creators found.", inserts: [] as Record<string, unknown>[] };
  }

  const { data: maxSortRow } = await fetchMaxItemSortOrder(supabase, quotationId);
  let sort = Number((maxSortRow as { sort_order?: number } | null)?.sort_order ?? -1) + 1;

  const inserts = rows.map((row) => {
    const {
      id: _id,
      created_at: _created,
      updated_at: _updated,
      ...rest
    } = row;
    return { ...rest, quotation_id: quotationId, sort_order: sort++ };
  });

  const { error } = await insertQuotationItems(supabase, inserts);
  if (error) return { ok: false as const, message: error.message, inserts: [] as Record<string, unknown>[] };

  return { ok: true as const, inserts };
}

export async function fetchQuotationItemsForCampaign(
  supabase: SupabaseClient<Database>,
  quotationId: string
) {
  return supabase
    .from("quotation_items")
    .select("id, influencer_id, profile_id, unified_id, source_shortlist_item_id")
    .eq("quotation_id", quotationId);
}

export async function copyQuotationItems(
  supabase: SupabaseClient<Database>,
  sourceQuotationId: string,
  targetQuotationId: string
) {
  const { data: items } = await supabase
    .from("quotation_items")
    .select("*")
    .eq("quotation_id", sourceQuotationId)
    .order("sort_order", { ascending: true });

  if (!items?.length) return;

  const inserts = (items as Array<Record<string, unknown>>).map((row) => {
    const {
      id: _id,
      quotation_id: _q,
      created_at: _c,
      updated_at: _u,
      source_shortlist_item_id: _s,
      ...rest
    } = row;
    return { ...rest, quotation_id: targetQuotationId, source_shortlist_item_id: null };
  });

  await insertQuotationItems(supabase, inserts);
}

export async function copyQuotationItemsToShortlist(
  supabase: SupabaseClient<Database>,
  quotationId: string,
  shortlistId: string,
  userId: string
) {
  const { data: items } = await supabase
    .from("quotation_items")
    .select("*")
    .eq("quotation_id", quotationId)
    .order("sort_order", { ascending: true });

  for (const raw of (items ?? []) as Array<Record<string, unknown>>) {
    const { data: slItem, error } = await supabase
      .from("discovery_shortlist_items")
      .insert({
        shortlist_id: shortlistId,
        influencer_id: raw.influencer_id ?? null,
        profile_id: raw.profile_id ?? null,
        unified_id: raw.unified_id ?? null,
        notes: null,
        added_by: userId,
        commercial_input_mode: raw.commercial_input_mode,
        cost: raw.cost,
        cost_currency: raw.cost_currency,
        revenue: raw.revenue,
        gp_pct: raw.gp_pct,
        gp_value: raw.gp_value,
        cost_egp: raw.cost_egp,
        revenue_egp: raw.revenue_egp,
        gp_value_egp: raw.gp_value_egp,
        deliverables: raw.deliverables,
        sort_order: raw.sort_order,
      } as never)
      .select("id")
      .single();

    if (error || !slItem) continue;

    await supabase
      .from("quotation_items")
      .update({ source_shortlist_item_id: (slItem as { id: string }).id } as never)
      .eq("id", raw.id as string);
  }
}

export async function loadShortlistItemsForSeeds(
  supabase: SupabaseClient<Database>,
  shortlistId: string,
  itemIds?: string[]
) {
  let query = supabase
    .from("discovery_shortlist_items")
    .select(
      "id, influencer_id, profile_id, unified_id, commercial_input_mode, cost, cost_currency, gp_pct, revenue, gp_value, deliverables, sort_order"
    )
    .eq("shortlist_id", shortlistId)
    .order("sort_order", { ascending: true });

  if (itemIds?.length) {
    query = query.in("id", itemIds);
  }

  return query;
}

export async function fetchShortlistHeader(
  supabase: SupabaseClient<Database>,
  shortlistId: string
) {
  return supabase
    .from("discovery_shortlists")
    .select("id, name, client_id, brand_id, campaign_header_id")
    .eq("id", shortlistId)
    .maybeSingle();
}

export async function fetchCampaignAssignmentsByIds(
  supabase: SupabaseClient<Database>,
  assignmentIds: string[]
) {
  return supabase
    .from("campaign_influencers")
    .select("id, influencer_id")
    .in("id", assignmentIds);
}

export async function fetchCampaignImportCreators(
  supabase: SupabaseClient<Database>,
  campaignHeaderId: string
) {
  return supabase
    .from("campaign_influencers")
    .select("id, influencer_id, influencers: influencer_id(display_name)")
    .eq("campaign_header_id", campaignHeaderId);
}

export async function listShortlistsForImportQuery(supabase: SupabaseClient<Database>) {
  return supabase
    .from("discovery_shortlists")
    .select("id, name, discovery_shortlist_items(count)")
    .eq("is_archived", false)
    .order("created_at", { ascending: false })
    .limit(200);
}

export async function listCampaignsForImportQuery(supabase: SupabaseClient<Database>) {
  return supabase
    .from("campaign_headers")
    .select("id, name, document_number")
    .order("created_at", { ascending: false })
    .limit(300);
}

export async function appendQuotationRevision(
  supabase: SupabaseClient<Database>,
  input: {
    quotationId: string;
    userId: string;
    version: string;
    changeSummary: string;
    updatedByName?: string | null;
  }
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", input.userId)
    .maybeSingle();

  return supabase.from("quotation_revisions").insert({
    quotation_id: input.quotationId,
    version: input.version,
    updated_by: input.userId,
    updated_by_name:
      input.updatedByName ??
      (profile as { full_name: string } | null)?.full_name ??
      null,
    change_summary: input.changeSummary,
  } as never);
}

export async function insertQuotationHeaderRecord(
  supabase: SupabaseClient<Database>,
  userId: string,
  patch: Partial<Database["public"]["Tables"]["quotations"]["Insert"]> & { name: string }
) {
  const issueDate = patch.issue_date ?? new Date().toISOString().slice(0, 10);
  const validityDate =
    patch.validity_date ?? defaultValidityDateFromIssue(issueDate);

  return supabase
    .from("quotations")
    .insert({
      owner_id: userId,
      created_by: userId,
      currency: REPORTING_CURRENCY,
      issue_date: issueDate,
      validity_date: validityDate,
      terms: patch.terms ?? formatQuotationTermsText(),
      version: patch.version ?? "v1.0",
      department: patch.department ?? "Influencer Marketing",
      ...patch,
    } as never)
    .select("id")
    .single();
}

export async function updateQuotationHeaderRecord(
  supabase: SupabaseClient<Database>,
  id: string,
  patch: Record<string, unknown>
) {
  return supabase.from("quotations").update(patch as never).eq("id", id);
}

export async function archiveQuotationRecord(
  supabase: SupabaseClient<Database>,
  id: string
) {
  return supabase
    .from("quotations")
    .update({ is_archived: true, status: "archived" } as never)
    .eq("id", id);
}

export async function findOpenQuotationForShortlistQuery(
  supabase: SupabaseClient<Database>,
  shortlistId: string
) {
  return supabase
    .from("quotations")
    .select("id")
    .eq("shortlist_id", shortlistId)
    .eq("is_archived", false)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

export async function listQuotationsByShortlistQuery(
  supabase: SupabaseClient<Database>,
  shortlistId: string
) {
  return supabase
    .from("quotations")
    .select("id, serial_number, name, status, version_number, created_at")
    .eq("shortlist_id", shortlistId)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });
}

export async function loadQuotationRow(
  supabase: SupabaseClient<Database>,
  id: string
) {
  const { data, error } = await supabase
    .from("quotations")
    .select(
      `id, name, status, serial_number, shortlist_id, client_id, brand_id, campaign_header_id,
       notes, terms, issue_date, validity_date, version, department, currency,
       is_temporary_client, is_temporary_brand, temporary_client_name, temporary_brand_name,
       parent_quotation_id, version_number, revision_notes, total_cost_egp, total_revenue_egp,
       total_gp_value_egp, total_gp_pct, total_af_egp, total_agency_margin_egp, gp_target_pct`
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Record<string, unknown> | null;
}

export async function linkQuotationToShortlist(
  supabase: SupabaseClient<Database>,
  quotationId: string,
  shortlistId: string
) {
  return supabase
    .from("quotations")
    .update({ shortlist_id: shortlistId } as never)
    .eq("id", quotationId);
}

export async function linkQuotationToCampaign(
  supabase: SupabaseClient<Database>,
  quotationId: string,
  campaignId: string
) {
  return supabase
    .from("quotations")
    .update({ campaign_header_id: campaignId } as never)
    .eq("id", quotationId);
}

export async function linkShortlistToCampaign(
  supabase: SupabaseClient<Database>,
  shortlistId: string,
  campaignId: string
) {
  return supabase
    .from("discovery_shortlists")
    .update({ campaign_header_id: campaignId } as never)
    .eq("id", shortlistId);
}

export async function createLinkedShortlist(
  supabase: SupabaseClient<Database>,
  input: {
    name: string;
    ownerId: string;
    clientId: string | null;
    brandId: string | null;
    quotationId: string;
    description: string | null;
  }
) {
  return supabase
    .from("discovery_shortlists")
    .insert({
      name: input.name,
      owner_id: input.ownerId,
      created_by: input.ownerId,
      status: "draft",
      visibility: "private",
      client_id: input.clientId,
      brand_id: input.brandId,
      quotation_id: input.quotationId,
      description: input.description,
    } as never)
    .select("id, serial_number")
    .single();
}

export async function createCampaignHeaderFromBrand(
  supabase: SupabaseClient<Database>,
  userId: string,
  input: { name: string; brandId: string; quotationId: string; shortlistId: string | null }
) {
  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select(
      "id, client_id, group_id, category_id, subcategory_id, vr_rate_id, currency_code, client:clients(agency_or_direct)"
    )
    .eq("id", input.brandId)
    .maybeSingle();

  if (brandError || !brand) {
    return { ok: false as const, message: brandError?.message ?? "Brand not found." };
  }

  const brandRow = brand as unknown as {
    id: string;
    client_id: string;
    group_id: string | null;
    category_id: string | null;
    subcategory_id: string | null;
    vr_rate_id: string | null;
    currency_code: string;
    client: { agency_or_direct: string | null } | null;
  };

  const { data: header, error: headerError } = await supabase
    .from("campaign_headers")
    .insert({
      name: input.name.trim(),
      brand_id: brandRow.id,
      client_id: brandRow.client_id,
      group_id: brandRow.group_id,
      status: "draft",
      currency_code: brandRow.currency_code,
      category_id: brandRow.category_id,
      subcategory_id: brandRow.subcategory_id,
      agency_or_direct: brandRow.client?.agency_or_direct ?? null,
      vr_rate_id: brandRow.vr_rate_id,
      shortlist_id: input.shortlistId,
      quotation_id: input.quotationId,
      created_by: userId,
    } as never)
    .select("id, document_number")
    .single();

  if (headerError || !header) {
    return { ok: false as const, message: headerError?.message ?? "Failed to create campaign." };
  }

  return {
    ok: true as const,
    id: (header as { id: string }).id,
    document_number: (header as { document_number: string }).document_number,
  };
}

export async function findExistingCampaignAssignment(
  supabase: SupabaseClient<Database>,
  campaignHeaderId: string,
  influencerId: string
) {
  return supabase
    .from("campaign_influencers")
    .select("id")
    .eq("campaign_header_id", campaignHeaderId)
    .eq("influencer_id", influencerId)
    .maybeSingle();
}

export async function insertCampaignAssignment(
  supabase: SupabaseClient<Database>,
  input: {
    campaignId: string;
    influencerId: string;
    shortlistId: string;
    sourceShortlistItemId: string | null;
    userId: string;
  }
) {
  return supabase.from("campaign_influencers").insert({
    campaign_id: input.campaignId,
    campaign_header_id: input.campaignId,
    influencer_id: input.influencerId,
    status: "invited",
    source_shortlist_id: input.shortlistId,
    source_shortlist_item_id: input.sourceShortlistItemId,
    shortlist_assignment_status: "suggested",
    created_by: input.userId,
  } as never);
}

export async function resolveMaxVersionNumber(
  supabase: SupabaseClient<Database>,
  baseSerial: string,
  rootId: string,
  stripVersionSuffix: (serial: string | null) => string
) {
  const { data } = await supabase
    .from("quotations")
    .select("version_number, serial_number")
    .or(`id.eq.${rootId},parent_quotation_id.eq.${rootId}`);

  let max = 1;
  for (const row of (data ?? []) as Array<{ version_number: number; serial_number: string | null }>) {
    if (stripVersionSuffix(row.serial_number) === baseSerial) {
      max = Math.max(max, row.version_number ?? 1);
    }
  }
  return max;
}

export async function insertVersionedQuotation(
  supabase: SupabaseClient<Database>,
  row: Record<string, unknown>,
  input: {
    userId: string;
    nextVersion: number;
    versionSerial: string;
    revisionNotes?: string | null;
    issueDate: string;
    validityDate: string;
  }
) {
  return supabase
    .from("quotations")
    .insert({
      serial_number: input.versionSerial,
      name: `${row.name} (V${input.nextVersion})`,
      status: "draft",
      parent_quotation_id: row.id as string,
      version_number: input.nextVersion,
      revision_notes: input.revisionNotes?.trim() || null,
      shortlist_id: row.shortlist_id ?? null,
      client_id: row.client_id ?? null,
      brand_id: row.brand_id ?? null,
      campaign_header_id: row.campaign_header_id ?? null,
      is_temporary_client: row.is_temporary_client ?? false,
      is_temporary_brand: row.is_temporary_brand ?? false,
      temporary_client_name: row.temporary_client_name ?? null,
      temporary_brand_name: row.temporary_brand_name ?? null,
      owner_id: input.userId,
      created_by: input.userId,
      currency: row.currency ?? "EGP",
      notes: row.notes ?? null,
      terms: row.terms ?? formatQuotationTermsText(),
      issue_date: input.issueDate,
      validity_date: input.validityDate,
      version: `v${input.nextVersion}.0`,
      department: row.department ?? "Influencer Marketing",
      gp_target_pct: row.gp_target_pct ?? 25,
    } as never)
    .select("id, serial_number")
    .single();
}
