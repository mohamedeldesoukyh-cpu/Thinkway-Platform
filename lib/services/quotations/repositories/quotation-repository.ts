import type { SupabaseClient } from "@supabase/supabase-js";

import { REPORTING_CURRENCY } from "@/lib/commercial/fx-aggregation";
import { resolveRateToEgp } from "@/lib/commercial/fx-server";
import { formatQuotationTermsText } from "@/lib/commercial/quotation-default-terms";
import { defaultValidityDateFromIssue } from "@/lib/commercial/quotation-validity";
import { NEW_QUOTATION_VERSION_STATUS } from "@/lib/commercial-sync/rules";
import { normalizeCommercialLine } from "@/lib/commercial/quotation-engine";
import { DEFAULT_QUOTATION_LINE_COMMERCIAL_MODE } from "@/lib/domains/commercial/quotation-constants";
import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";
import { buildQuotationOptionRenumberPlan, isSameQuotationCreator, nextQuotationOptionNumber, type QuotationCreatorRef } from "@/lib/quotations/quotation-creator-options";
import {
  buildCollapsePackageOptionRenumberPlan,
  isFullCollapsePackageSelection,
  nextCollapsePackageOptionNumber,
} from "@/lib/quotations/quotation-collapse-package";
import type { CommercialInputMode, Database } from "@/types/database";
import {
  collapseFieldsFromRow,
  COLLAPSE_MIGRATION_HINT,
  isMissingCollapseColumnsError,
  queryShortlistSeedItemsWithCollapseFallback,
} from "@/lib/discovery/shortlist-item-collapse-select";

import { maybeActivateCommercialCreatorForAssignment } from "@/lib/campaigns/campaign-influencer-commercial";

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
    const mode: CommercialInputMode =
      seed.commercial_input_mode ?? DEFAULT_QUOTATION_LINE_COMMERCIAL_MODE;
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
      profile_image_url: seed.profile_image_url ?? null,
      profile_url: seed.profile_url ?? null,
      deliverables: (seed.deliverables ?? []) as unknown as Database["public"]["Tables"]["quotation_items"]["Insert"]["deliverables"],
      option_number: seed.option_number ?? 1,
      service_description: seed.service_description ?? null,
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
      ...(seed.collapse_group_id
        ? {
            collapse_group_id: seed.collapse_group_id,
            collapse_label: seed.collapse_label ?? null,
          }
        : {}),
    });
  }
  return rows;
}

export async function insertQuotationItems(
  supabase: SupabaseClient<Database>,
  rows: Record<string, unknown>[]
) {
  return supabase.from("quotation_items").insert(rows as never).select("id");
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

export async function duplicateQuotationCollapsePackage(
  supabase: SupabaseClient<Database>,
  quotationId: string,
  collapseGroupId: string
) {
  const { data: allItemsData, error: loadError } = await supabase
    .from("quotation_items")
    .select("*")
    .eq("quotation_id", quotationId)
    .order("sort_order", { ascending: true });

  if (loadError) {
    return { ok: false as const, message: loadError.message, inserts: [] as Record<string, unknown>[] };
  }

  const allItems = (allItemsData ?? []) as Array<Record<string, unknown>>;
  const members = allItems
    .filter((item) => item.collapse_group_id === collapseGroupId)
    .sort((a, b) => (a.sort_order as number) - (b.sort_order as number));

  if (members.length === 0) {
    return { ok: false as const, message: "Collap package not found.", inserts: [] as Record<string, unknown>[] };
  }

  const lastMember = members[members.length - 1]!;
  const newCollapseGroupId = crypto.randomUUID();
  const nextOption = nextCollapsePackageOptionNumber(
    allItems as unknown as QuotationItemRow[],
    members as unknown as QuotationItemRow[]
  );

  const insertsAfter = members.map((row) => {
    const {
      id: _id,
      created_at: _created,
      updated_at: _updated,
      source_shortlist_item_id: _source,
      ...rest
    } = row;
    const isLeader = (row.id as string) === (members[0]?.id as string);
    return {
      afterItemId: lastMember.id as string,
      payload: {
        ...rest,
        quotation_id: quotationId,
        collapse_group_id: newCollapseGroupId,
        collapse_label: row.collapse_label ?? null,
        source_shortlist_item_id: null,
        option_number: nextOption,
        ...(isLeader
          ? {}
          : {
              deliverables: [],
              service_description: null,
              revenue: 0,
              cost: 0,
              gp_value: 0,
              gp_pct: 0,
            }),
      },
    };
  });

  const insertResult = await insertQuotationRowsAfter(supabase, quotationId, insertsAfter);
  if (!insertResult.ok) return insertResult;

  await syncCollapsePackageOptionNumbers(supabase, quotationId);
  return insertResult;
}

export async function duplicateQuotationItemRows(
  supabase: SupabaseClient<Database>,
  quotationId: string,
  itemIds: string[]
) {
  const uniqueIds = [...new Set(itemIds)];
  const { data: allItemsData, error: loadError } = await supabase
    .from("quotation_items")
    .select("*")
    .eq("quotation_id", quotationId)
    .order("sort_order", { ascending: true });

  if (loadError) {
    return { ok: false as const, message: loadError.message, inserts: [] as Record<string, unknown>[] };
  }

  const allItems = (allItemsData ?? []) as Array<Record<string, unknown>>;
  const collapseGroupId = isFullCollapsePackageSelection(
    allItems as unknown as QuotationItemRow[],
    uniqueIds
  );
  if (collapseGroupId) {
    return duplicateQuotationCollapsePackage(supabase, quotationId, collapseGroupId);
  }

  const sourceIdSet = new Set(uniqueIds);
  const foundSources = allItems.filter((item) => sourceIdSet.has(item.id as string));
  if (!foundSources.length) {
    return { ok: false as const, message: "No matching creators found.", inserts: [] as Record<string, unknown>[] };
  }

  const insertsAfter = foundSources.map((row) => {
    const {
      id: _id,
      created_at: _created,
      updated_at: _updated,
      source_shortlist_item_id: _source,
      ...rest
    } = row;
    const sameCreator = allItems.filter((item) =>
      isSameQuotationCreator(row as QuotationCreatorRef, item as QuotationCreatorRef)
    );
    return {
      afterItemId: row.id as string,
      payload: {
        ...rest,
        quotation_id: quotationId,
        source_shortlist_item_id: null,
        option_number: nextQuotationOptionNumber(sameCreator),
      },
    };
  });

  const insertResult = await insertQuotationRowsAfter(supabase, quotationId, insertsAfter);
  if (!insertResult.ok) return insertResult;

  await renumberQuotationOptionNumbers(supabase, quotationId);
  return insertResult;
}

export async function syncCollapsePackageOptionNumbers(
  supabase: SupabaseClient<Database>,
  quotationId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("quotation_items")
    .select(
      "id, sort_order, option_number, collapse_group_id, collapse_label, unified_id, influencer_id, profile_id, creator_name, handle"
    )
    .eq("quotation_id", quotationId);

  if (error || !data?.length) return;

  const updates = buildCollapsePackageOptionRenumberPlan(data as unknown as QuotationItemRow[]);
  if (updates.length === 0) return;

  await Promise.all(
    updates.map(({ id, option_number }) =>
      supabase.from("quotation_items").update({ option_number } as never).eq("id", id)
    )
  );
}

export async function renumberQuotationOptionNumbers(
  supabase: SupabaseClient<Database>,
  quotationId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("quotation_items")
    .select(
      "id, sort_order, option_number, collapse_group_id, unified_id, influencer_id, profile_id, creator_name, handle"
    )
    .eq("quotation_id", quotationId);

  if (error || !data?.length) return;

  const typed = data as Array<{
    id: string;
    sort_order: number;
    option_number: number | null;
    collapse_group_id: string | null;
    unified_id: string | null;
    influencer_id: string | null;
    profile_id: string | null;
    creator_name: string | null;
    handle: string | null;
  }>;

  const updates = buildQuotationOptionRenumberPlan(typed);

  if (updates.length > 0) {
    await Promise.all(
      updates.map(({ id, option_number }) =>
        supabase.from("quotation_items").update({ option_number } as never).eq("id", id)
      )
    );
  }

  await syncCollapsePackageOptionNumbers(supabase, quotationId);
}

type QuotationRowInsertAfter = {
  afterItemId: string;
  payload: Record<string, unknown>;
};

export async function insertQuotationRowsAfter(
  supabase: SupabaseClient<Database>,
  quotationId: string,
  insertsAfter: QuotationRowInsertAfter[]
): Promise<
  | { ok: true; inserts: Record<string, unknown>[] }
  | { ok: false; message: string; inserts: Record<string, unknown>[] }
> {
  if (insertsAfter.length === 0) {
    return { ok: false, message: "Nothing to insert.", inserts: [] };
  }

  const { data: allItemsData, error: loadError } = await supabase
    .from("quotation_items")
    .select("id, sort_order")
    .eq("quotation_id", quotationId)
    .order("sort_order", { ascending: true });

  if (loadError) {
    return { ok: false, message: loadError.message, inserts: [] };
  }

  const allItems = (allItemsData ?? []) as Array<{ id: string; sort_order: number }>;
  const insertsByAfterId = new Map<string, Record<string, unknown>[]>();
  for (const entry of insertsAfter) {
    const bucket = insertsByAfterId.get(entry.afterItemId) ?? [];
    bucket.push(entry.payload);
    insertsByAfterId.set(entry.afterItemId, bucket);
  }

  type PlannedRow =
    | { kind: "existing"; id: string }
    | { kind: "insert"; row: Record<string, unknown> };

  const plan: PlannedRow[] = [];
  const inserts: Record<string, unknown>[] = [];

  for (const item of allItems) {
    plan.push({ kind: "existing", id: item.id });
    for (const payload of insertsByAfterId.get(item.id) ?? []) {
      plan.push({ kind: "insert", row: payload });
      inserts.push(payload);
    }
  }

  if (inserts.length === 0) {
    return { ok: false, message: "Insert position not found.", inserts: [] };
  }

  let sortOrder = 0;
  const existingUpdates: Array<{ id: string; sort_order: number }> = [];
  const insertsWithSort: Record<string, unknown>[] = [];

  for (const step of plan) {
    if (step.kind === "existing") {
      existingUpdates.push({ id: step.id, sort_order: sortOrder++ });
    } else {
      insertsWithSort.push({ ...step.row, sort_order: sortOrder++ });
    }
  }

  const { data: insertedRows, error: insertError } = await supabase
    .from("quotation_items")
    .insert(insertsWithSort as never)
    .select("id");

  if (insertError) {
    return { ok: false, message: insertError.message, inserts: [] };
  }

  await Promise.all(
    existingUpdates.map(({ id, sort_order }) =>
      supabase.from("quotation_items").update({ sort_order } as never).eq("id", id)
    )
  );

  return { ok: true, inserts: (insertedRows ?? []) as Record<string, unknown>[] };
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
  const { data, error } = await queryShortlistSeedItemsWithCollapseFallback((select) => {
    let query = supabase
      .from("discovery_shortlist_items")
      .select(select)
      .eq("shortlist_id", shortlistId)
      .order("sort_order", { ascending: true });

    if (itemIds?.length) {
      query = query.in("id", itemIds);
    }

    return query;
  });

  if (error) return { data, error };

  // Dynamic select strings are not parseable by the typed client (GenericStringError).
  const mapped = ((data ?? []) as unknown as Array<Record<string, unknown>>).map((row) => ({
    ...row,
    ...collapseFieldsFromRow(row),
  }));

  return { data: mapped, error: null };
}

export async function fetchShortlistHeader(
  supabase: SupabaseClient<Database>,
  shortlistId: string
) {
  // Prefer metadata over a dedicated currency column (may be missing pre-migration).
  return supabase
    .from("discovery_shortlists")
    .select("id, name, client_id, brand_id, campaign_header_id, metadata")
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

export async function findLatestQuotationForShortlistQuery(
  supabase: SupabaseClient<Database>,
  shortlistId: string
) {
  return supabase
    .from("quotations")
    .select("id, status, serial_number, version_number")
    .eq("shortlist_id", shortlistId)
    .eq("is_archived", false)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

export async function findEditableQuotationForShortlistQuery(
  supabase: SupabaseClient<Database>,
  shortlistId: string
) {
  return supabase
    .from("quotations")
    .select("id, status, serial_number, version_number")
    .eq("shortlist_id", shortlistId)
    .eq("is_archived", false)
    .in("status", ["draft", "under_review"])
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
  input: {
    name: string;
    brandId: string;
    quotationId: string;
    shortlistId: string | null;
    /** Override brand currency — quotation invoice/display CCY when converting. */
    currencyCode?: string | null;
    /** Release 2.0 D4 — default `planning` for Assignment convert. */
    status?: Database["public"]["Tables"]["campaign_headers"]["Row"]["status"];
    acceptedQuotationId?: string | null;
    acceptedQuotationVersion?: number | null;
  }
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

  const currencyCode =
    input.currencyCode?.trim().toUpperCase() || brandRow.currency_code;

  const { data: header, error: headerError } = await supabase
    .from("campaign_headers")
    .insert({
      name: input.name.trim(),
      brand_id: brandRow.id,
      client_id: brandRow.client_id,
      group_id: brandRow.group_id,
      // Release 2.0 convert passes `planning` (D4). Legacy callers may omit → draft.
      status: input.status ?? "draft",
      currency_code: currencyCode,
      category_id: brandRow.category_id,
      subcategory_id: brandRow.subcategory_id,
      agency_or_direct: brandRow.client?.agency_or_direct ?? null,
      vr_rate_id: brandRow.vr_rate_id,
      shortlist_id: input.shortlistId,
      quotation_id: input.quotationId,
      ...(input.acceptedQuotationId
        ? {
            accepted_quotation_id: input.acceptedQuotationId,
            accepted_quotation_version: input.acceptedQuotationVersion ?? 1,
          }
        : {}),
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
  const result = await supabase
    .from("campaign_influencers")
    .insert({
      campaign_id: input.campaignId,
      campaign_header_id: input.campaignId,
      influencer_id: input.influencerId,
      status: "invited",
      source_shortlist_id: input.shortlistId,
      source_shortlist_item_id: input.sourceShortlistItemId,
      shortlist_assignment_status: "suggested",
      created_by: input.userId,
    } as never)
    .select("id")
    .single();

  if (!result.error && result.data?.id) {
    await maybeActivateCommercialCreatorForAssignment(supabase, {
      influencerId: input.influencerId,
      campaignInfluencerId: result.data.id as string,
      actorId: input.userId,
      metadata: {
        path: "insertCampaignAssignment",
        campaignId: input.campaignId,
        shortlistId: input.shortlistId,
      },
    });
  }

  return result;
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
      status: NEW_QUOTATION_VERSION_STATUS,
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
