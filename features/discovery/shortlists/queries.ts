import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  resolveCreatorFromRefLookup,
  resolveUnifiedCreatorsByRefs,
} from "@/lib/creators/unified-browse";
import type { Database, ShortlistItemStatus } from "@/types/database";
import { getAuthContext } from "@/lib/auth/permissions-server";
import { hasPermission } from "@/lib/auth/permissions";
import { getBrandsForSelect, getClientsForSelect } from "@/lib/master-data/queries";
import { buildClientSelectOptions } from "@/lib/clients/client-select-options";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listQuotationsByShortlistQuery } from "@/lib/services/quotations/repositories/quotation-repository";
import type { QuotationStatus } from "@/types/database";

import { SHORTLIST_PERMISSIONS } from "./constants";
import type {
  ShortlistBrandOption,
  ShortlistCampaignOption,
  ShortlistClientOption,
  ShortlistCreatorItem,
  ShortlistCreatorQuotationRef,
  ShortlistDetail,
  ShortlistLinkedQuotation,
  ShortlistListRow,
  ShortlistMovedAssignment,
  ShortlistMovementRow,
} from "./types";

type Supabase = SupabaseClient<Database>;

const SHORTLIST_SELECT =
  "id, serial_number, name, description, status, visibility, owner_id, created_by, client_id, brand_id, approved_by, approved_at, submitted_at, cancelled_at, cancellation_reason, is_archived, created_at, updated_at";

async function nameMap(
  supabase: Supabase,
  table: "profiles" | "clients" | "brands" | "influencers",
  ids: Array<string | null | undefined>,
  nameColumn: string
): Promise<Map<string, string>> {
  const unique = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
  if (unique.length === 0) return new Map();
  // Dynamic select column requires the untyped client surface.
  const client = supabase as unknown as SupabaseClient;
  const { data } = await client.from(table).select(`id, ${nameColumn}`).in("id", unique);
  const map = new Map<string, string>();
  for (const row of (data ?? []) as unknown as Array<Record<string, unknown>>) {
    map.set(row.id as string, (row[nameColumn] as string) ?? "");
  }
  return map;
}

export async function getDiscoveryShortlistsV2(options?: {
  includeArchived?: boolean;
}): Promise<ShortlistListRow[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("discovery_shortlists")
    .select(SHORTLIST_SELECT)
    .order("created_at", { ascending: false });

  if (!options?.includeArchived) {
    query = query.eq("is_archived", false);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    serial_number: string | null;
    name: string;
    description: string | null;
    status: ShortlistListRow["status"];
    visibility: ShortlistListRow["visibility"];
    owner_id: string;
    client_id: string | null;
    brand_id: string | null;
    is_archived: boolean;
    approved_at: string | null;
    created_at: string;
    updated_at: string;
  }>;
  if (rows.length === 0) return [];

  const shortlistIds = rows.map((r) => r.id);
  const [ownerNames, clientNames, brandNames, counts, creatorPreviews] =
    await Promise.all([
      nameMap(supabase, "profiles", rows.map((r) => r.owner_id), "full_name"),
      nameMap(supabase, "clients", rows.map((r) => r.client_id), "name"),
      nameMap(supabase, "brands", rows.map((r) => r.brand_id), "name"),
      countItemsByShortlist(supabase, shortlistIds),
      loadCreatorPreviewsByShortlist(supabase, shortlistIds),
    ]);

  return rows.map((row) => ({
    id: row.id,
    serial_number: row.serial_number,
    name: row.name,
    description: row.description,
    status: row.status,
    visibility: row.visibility,
    owner_id: row.owner_id,
    owner_name: ownerNames.get(row.owner_id) ?? null,
    client_id: row.client_id,
    client_name: row.client_id ? clientNames.get(row.client_id) ?? null : null,
    brand_id: row.brand_id,
    brand_name: row.brand_id ? brandNames.get(row.brand_id) ?? null : null,
    is_archived: row.is_archived,
    creator_count: counts.get(row.id) ?? 0,
    creator_previews: creatorPreviews.get(row.id) ?? [],
    approved_at: row.approved_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

async function loadCreatorPreviewsByShortlist(
  supabase: Supabase,
  shortlistIds: string[]
): Promise<Map<string, ShortlistListRow["creator_previews"]>> {
  const previews = new Map<string, ShortlistListRow["creator_previews"]>();
  if (shortlistIds.length === 0) return previews;

  const { data } = await supabase
    .from("discovery_shortlist_items")
    .select("shortlist_id, unified_id, profile_id, influencer_id, sort_order")
    .in("shortlist_id", shortlistIds)
    .order("sort_order", { ascending: true })
    .limit(Math.max(shortlistIds.length * 4, 40));

  const items = (data ?? []) as Array<{
    shortlist_id: string;
    unified_id: string | null;
    profile_id: string | null;
    influencer_id: string | null;
  }>;

  const cappedByShortlist = new Map<string, typeof items>();
  for (const item of items) {
    const bucket = cappedByShortlist.get(item.shortlist_id) ?? [];
    if (bucket.length < 4) bucket.push(item);
    cappedByShortlist.set(item.shortlist_id, bucket);
  }

  if (cappedByShortlist.size === 0) return previews;

  const allItems = [...cappedByShortlist.values()].flat();
  const lookup = await resolveUnifiedCreatorsByRefs(supabase, {
    unifiedIds: allItems.map((item) => item.unified_id),
    influencerIds: allItems.map((item) => item.influencer_id),
    discoveredProfileIds: allItems.map((item) => item.profile_id),
  });

  for (const [shortlistId, shortlistItems] of cappedByShortlist) {
    const rowPreviews: ShortlistListRow["creator_previews"] = [];
    for (const item of shortlistItems) {
      const creator = resolveCreatorFromRefLookup(lookup, item);
      if (!creator) continue;
      rowPreviews.push({
        display_name: creator.display_name,
        profile_image_url: creator.profile_image_url,
      });
    }
    previews.set(shortlistId, rowPreviews);
  }

  return previews;
}

async function countItemsByShortlist(
  supabase: Supabase,
  shortlistIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (shortlistIds.length === 0) return counts;

  const { data } = await supabase
    .from("discovery_shortlist_items")
    .select("shortlist_id")
    .in("shortlist_id", shortlistIds);

  for (const row of (data ?? []) as Array<{ shortlist_id: string }>) {
    counts.set(row.shortlist_id, (counts.get(row.shortlist_id) ?? 0) + 1);
  }
  return counts;
}

type ShortlistItemRef = {
  item_id: string;
  influencer_id: string | null;
  unified_id: string | null;
};

async function loadShortlistCreatorQuotationRefs(
  supabase: Supabase,
  shortlistId: string,
  shortlistItems: ShortlistItemRef[]
): Promise<Map<string, ShortlistCreatorQuotationRef[]>> {
  const refsByItem = new Map<string, ShortlistCreatorQuotationRef[]>();
  if (shortlistItems.length === 0) return refsByItem;

  const { data: quotations, error: quotationsError } =
    await listQuotationsByShortlistQuery(supabase, shortlistId);
  if (quotationsError) throw new Error(quotationsError.message);

  const quotationRows = (quotations ?? []) as Array<{
    id: string;
    serial_number: string | null;
    name: string;
    status: QuotationStatus;
    created_at: string;
  }>;
  if (quotationRows.length === 0) return refsByItem;

  const quotationById = new Map(
    quotationRows.map((row) => [
      row.id,
      {
        quotation_id: row.id,
        serial_number: row.serial_number,
        name: row.name,
        status: row.status,
        created_at: row.created_at,
      },
    ])
  );
  const quotationIds = quotationRows.map((row) => row.id);

  const { data: quotationItems, error: itemsError } = await supabase
    .from("quotation_items")
    .select("quotation_id, source_shortlist_item_id, influencer_id, unified_id")
    .in("quotation_id", quotationIds);

  if (itemsError) throw new Error(itemsError.message);

  const itemIdByInfluencer = new Map<string, string>();
  const itemIdByUnified = new Map<string, string>();
  for (const item of shortlistItems) {
    if (item.influencer_id) itemIdByInfluencer.set(item.influencer_id, item.item_id);
    if (item.unified_id) itemIdByUnified.set(item.unified_id, item.item_id);
  }

  const seen = new Set<string>();

  for (const row of (quotationItems ?? []) as Array<{
    quotation_id: string;
    source_shortlist_item_id: string | null;
    influencer_id: string | null;
    unified_id: string | null;
  }>) {
    const quotation = quotationById.get(row.quotation_id);
    if (!quotation) continue;

    const itemId =
      row.source_shortlist_item_id ??
      (row.influencer_id ? itemIdByInfluencer.get(row.influencer_id) : null) ??
      (row.unified_id ? itemIdByUnified.get(row.unified_id) : null);
    if (!itemId) continue;

    const dedupeKey = `${itemId}:${quotation.quotation_id}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const bucket = refsByItem.get(itemId) ?? [];
    bucket.push({
      quotation_id: quotation.quotation_id,
      serial_number: quotation.serial_number,
      name: quotation.name,
      status: quotation.status,
    });
    refsByItem.set(itemId, bucket);
  }

  for (const [itemId, refs] of refsByItem) {
    refs.sort((a, b) => {
      const aCreated = quotationById.get(a.quotation_id)?.created_at ?? "";
      const bCreated = quotationById.get(b.quotation_id)?.created_at ?? "";
      return bCreated.localeCompare(aCreated);
    });
    refsByItem.set(itemId, refs);
  }

  return refsByItem;
}

async function loadShortlistCreators(
  supabase: Supabase,
  shortlistId: string
): Promise<ShortlistCreatorItem[]> {
  const { data: items, error } = await supabase
    .from("discovery_shortlist_items")
    .select(
      "id, profile_id, influencer_id, unified_id, notes, match_score, sort_order, item_status, platform_account_ids"
    )
    .eq("shortlist_id", shortlistId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  if (!items || items.length === 0) return [];

  const itemRefs = items.map((item) => ({
    item_id: item.id as string,
    influencer_id: (item.influencer_id as string | null) ?? null,
    unified_id: (item.unified_id as string | null) ?? null,
  }));

  const [lookup, quotationRefsByItem] = await Promise.all([
    resolveUnifiedCreatorsByRefs(supabase, {
      unifiedIds: items.map((item) => item.unified_id as string | null),
      influencerIds: items.map((item) => item.influencer_id as string | null),
      discoveredProfileIds: items.map((item) => item.profile_id as string | null),
    }),
    loadShortlistCreatorQuotationRefs(supabase, shortlistId, itemRefs),
  ]);

  return items.map((item) => {
    const creator = resolveCreatorFromRefLookup(lookup, {
      unified_id: item.unified_id as string | null,
      profile_id: item.profile_id as string | null,
      influencer_id: item.influencer_id as string | null,
    });

    return {
      item_id: item.id as string,
      item_status: ((item.item_status as ShortlistItemStatus) ?? "draft"),
      notes: (item.notes as string) ?? null,
      match_score: (item.match_score as number) ?? null,
      unified_id: (item.unified_id as string) ?? creator?.unified_id ?? null,
      profile_id: (item.profile_id as string) ?? null,
      influencer_id: (item.influencer_id as string) ?? null,
      platform_account_ids: ((item.platform_account_ids as string[]) ?? []).filter(Boolean),
      creator,
      quotation_refs: quotationRefsByItem.get(item.id as string) ?? [],
    };
  });
}

async function loadShortlistMovements(
  supabase: Supabase,
  shortlistId: string
): Promise<ShortlistMovementRow[]> {
  const { data } = await supabase
    .from("creator_movements")
    .select(
      "id, action, source_type, destination_type, source_id, destination_id, unified_id, notes, performed_at, performed_by"
    )
    .or(`source_id.eq.${shortlistId},destination_id.eq.${shortlistId}`)
    .order("performed_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as unknown as Array<
    Omit<ShortlistMovementRow, "performed_by_name">
  >;
  const performerNames = await nameMap(
    supabase,
    "profiles",
    rows.map((r) => r.performed_by),
    "full_name"
  );

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    source_type: row.source_type,
    destination_type: row.destination_type,
    source_id: row.source_id,
    destination_id: row.destination_id,
    unified_id: row.unified_id,
    notes: row.notes,
    performed_at: row.performed_at,
    performed_by: row.performed_by,
    performed_by_name: row.performed_by
      ? performerNames.get(row.performed_by) ?? null
      : null,
  }));
}

async function loadMovedAssignments(
  supabase: Supabase,
  shortlistId: string
): Promise<ShortlistMovedAssignment[]> {
  const { data } = await supabase
    .from("campaign_influencers")
    .select(
      "id, campaign_header_id, influencer_id, shortlist_assignment_status"
    )
    .eq("source_shortlist_id", shortlistId);

  const rows = (data ?? []) as Array<{
    id: string;
    campaign_header_id: string | null;
    influencer_id: string;
    shortlist_assignment_status: ShortlistMovedAssignment["assignment_status"];
  }>;
  if (rows.length === 0) return [];

  const headerIds = Array.from(
    new Set(rows.map((r) => r.campaign_header_id).filter((id): id is string => Boolean(id)))
  );
  const influencerIds = Array.from(new Set(rows.map((r) => r.influencer_id)));

  const [headersRes, influencerNames] = await Promise.all([
    headerIds.length
      ? supabase
          .from("campaign_headers")
          .select("id, name, document_number")
          .in("id", headerIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    nameMap(supabase, "influencers", influencerIds, "display_name"),
  ]);

  const headerMap = new Map(
    ((headersRes.data ?? []) as Array<{
      id: string;
      name: string | null;
      document_number: string | null;
    }>).map((h) => [h.id, h])
  );

  return rows.map((row) => {
    const header = row.campaign_header_id ? headerMap.get(row.campaign_header_id) : null;
    return {
      assignment_id: row.id,
      campaign_header_id: row.campaign_header_id ?? "",
      campaign_name: header?.name ?? null,
      campaign_document_number: header?.document_number ?? null,
      influencer_id: row.influencer_id,
      influencer_name: influencerNames.get(row.influencer_id) ?? null,
      assignment_status: row.shortlist_assignment_status,
    };
  });
}

async function loadLinkedQuotations(
  supabase: Supabase,
  shortlistId: string
): Promise<ShortlistLinkedQuotation[]> {
  const { data, error } = await listQuotationsByShortlistQuery(supabase, shortlistId);
  if (error) throw new Error(error.message);

  return ((data ?? []) as Array<{
    id: string;
    serial_number: string | null;
    name: string;
    status: QuotationStatus;
    version_number: number;
    created_at: string;
  }>).map((row) => ({
    id: row.id,
    serial_number: row.serial_number,
    name: row.name,
    status: row.status,
    version_number: row.version_number ?? 1,
    created_at: row.created_at,
  }));
}

export async function getShortlistDetail(
  shortlistId: string
): Promise<ShortlistDetail | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("discovery_shortlists")
    .select(SHORTLIST_SELECT)
    .eq("id", shortlistId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as unknown as {
    id: string;
    serial_number: string | null;
    name: string;
    description: string | null;
    status: ShortlistListRow["status"];
    visibility: ShortlistListRow["visibility"];
    owner_id: string;
    client_id: string | null;
    brand_id: string | null;
    approved_at: string | null;
    is_archived: boolean;
    created_at: string;
    updated_at: string;
    created_by: string | null;
    approved_by: string | null;
    submitted_at: string | null;
    cancelled_at: string | null;
    cancellation_reason: string | null;
  };

  const [auth, isAdmin, creators, movements, movedAssignments, linkedQuotations] =
    await Promise.all([
    getAuthContext(supabase),
    hasPermission(supabase, SHORTLIST_PERMISSIONS.admin),
    loadShortlistCreators(supabase, shortlistId),
    loadShortlistMovements(supabase, shortlistId),
    loadMovedAssignments(supabase, shortlistId),
    loadLinkedQuotations(supabase, shortlistId),
  ]);

  const names = await nameMap(
    supabase,
    "profiles",
    [row.owner_id, row.approved_by],
    "full_name"
  );
  const clientNames = await nameMap(supabase, "clients", [row.client_id], "name");
  const brandNames = await nameMap(supabase, "brands", [row.brand_id], "name");

  const isOwner = auth.userId === row.owner_id;
  const isPrivilegedRole =
    auth.roleSlug === "super_admin" || auth.roleSlug === "admin";

  return {
    id: row.id,
    serial_number: row.serial_number,
    name: row.name,
    description: row.description,
    status: row.status,
    visibility: row.visibility,
    owner_id: row.owner_id,
    owner_name: names.get(row.owner_id) ?? null,
    created_by: row.created_by,
    client_id: row.client_id,
    client_name: row.client_id ? clientNames.get(row.client_id) ?? null : null,
    brand_id: row.brand_id,
    brand_name: row.brand_id ? brandNames.get(row.brand_id) ?? null : null,
    approved_by: row.approved_by,
    approved_by_name: row.approved_by ? names.get(row.approved_by) ?? null : null,
    approved_at: row.approved_at,
    submitted_at: row.submitted_at,
    cancelled_at: row.cancelled_at,
    cancellation_reason: row.cancellation_reason,
    is_archived: row.is_archived,
    created_at: row.created_at,
    updated_at: row.updated_at,
    creators,
    movements,
    movedAssignments,
    linkedQuotations,
    canManage: isOwner || isAdmin || isPrivilegedRole,
    canApprove: isAdmin || isPrivilegedRole,
  };
}

export async function getShortlistCampaignOptions(): Promise<
  ShortlistCampaignOption[]
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("campaign_headers")
    .select("id, name, document_number")
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) throw new Error(error.message);
  return (data as ShortlistCampaignOption[]) ?? [];
}

export async function getShortlistClientOptions(): Promise<ShortlistClientOption[]> {
  const clients = await getClientsForSelect();
  return buildClientSelectOptions(clients).map((client) => ({
    id: client.value,
    name: client.label,
    legal_name: client.description ?? null,
  }));
}

export async function getShortlistBrandOptions(): Promise<ShortlistBrandOption[]> {
  const supabase = await createSupabaseServerClient();
  const brands = await getBrandsForSelect();
  if (brands.length === 0) return [];

  const clientIds = Array.from(new Set(brands.map((brand) => brand.client_id)));
  const { data: clientRows } = await supabase
    .from("clients")
    .select("id, name")
    .in("id", clientIds);
  const clientNames = new Map(
    ((clientRows ?? []) as Array<{ id: string; name: string }>).map((row) => [
      row.id,
      row.name,
    ])
  );

  return brands.map((brand) => ({
    id: brand.id,
    name: brand.name,
    client_id: brand.client_id,
    client_name: clientNames.get(brand.client_id) ?? null,
  }));
}

/** Campaign workspace: shortlist-originated assignments for the Remove flow (spec §10). */
export async function getCampaignShortlistAssignments(
  campaignHeaderId: string
): Promise<ShortlistMovedAssignment[]> {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("campaign_influencers")
    .select("id, campaign_header_id, influencer_id, shortlist_assignment_status, source_shortlist_id")
    .eq("campaign_header_id", campaignHeaderId)
    .not("shortlist_assignment_status", "is", null);

  const rows = (data ?? []) as Array<{
    id: string;
    campaign_header_id: string | null;
    influencer_id: string;
    shortlist_assignment_status: ShortlistMovedAssignment["assignment_status"];
    source_shortlist_id: string | null;
  }>;
  if (rows.length === 0) return [];

  const influencerIds = Array.from(new Set(rows.map((r) => r.influencer_id)));
  const influencerNames = await nameMap(
    supabase,
    "influencers",
    influencerIds,
    "display_name"
  );

  return rows.map((row) => ({
    assignment_id: row.id,
    campaign_header_id: row.campaign_header_id ?? campaignHeaderId,
    campaign_name: null,
    campaign_document_number: null,
    influencer_id: row.influencer_id,
    influencer_name: influencerNames.get(row.influencer_id) ?? null,
    assignment_status: row.shortlist_assignment_status,
  }));
}
