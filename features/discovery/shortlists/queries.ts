import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { browseUnifiedCreators } from "@/lib/creators/unified-browse";
import type { Database, ShortlistItemStatus } from "@/types/database";
import {
  getAuthContext,
  hasPermission,
} from "@/lib/auth/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { SHORTLIST_PERMISSIONS } from "./constants";
import type {
  ShortlistBrandOption,
  ShortlistCampaignOption,
  ShortlistCreatorItem,
  ShortlistDetail,
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

  const [ownerNames, clientNames, brandNames, counts] = await Promise.all([
    nameMap(supabase, "profiles", rows.map((r) => r.owner_id), "full_name"),
    nameMap(supabase, "clients", rows.map((r) => r.client_id), "name"),
    nameMap(supabase, "brands", rows.map((r) => r.brand_id), "name"),
    countItemsByShortlist(
      supabase,
      rows.map((r) => r.id)
    ),
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
    approved_at: row.approved_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
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

async function loadShortlistCreators(
  supabase: Supabase,
  shortlistId: string
): Promise<ShortlistCreatorItem[]> {
  const { data: items, error } = await supabase
    .from("discovery_shortlist_items")
    .select("id, profile_id, influencer_id, unified_id, notes, match_score, sort_order, item_status")
    .eq("shortlist_id", shortlistId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  if (!items || items.length === 0) return [];

  const browse = await browseUnifiedCreators(supabase, { pageSize: 400 });
  const byUnifiedId = new Map(browse.creators.map((c) => [c.unified_id, c]));
  const byDiscoveryId = new Map(
    browse.creators
      .filter((c) => c.discovered_profile_id)
      .map((c) => [c.discovered_profile_id!, c])
  );
  const byInfluencerId = new Map(
    browse.creators
      .filter((c) => c.influencer_id)
      .map((c) => [c.influencer_id!, c])
  );

  return items.map((item) => {
    const creator =
      (item.unified_id ? byUnifiedId.get(item.unified_id as string) : null) ??
      (item.profile_id ? byDiscoveryId.get(item.profile_id as string) : null) ??
      (item.influencer_id ? byInfluencerId.get(item.influencer_id as string) : null) ??
      null;

    return {
      item_id: item.id as string,
      item_status: ((item.item_status as ShortlistItemStatus) ?? "draft"),
      notes: (item.notes as string) ?? null,
      match_score: (item.match_score as number) ?? null,
      unified_id: (item.unified_id as string) ?? creator?.unified_id ?? null,
      profile_id: (item.profile_id as string) ?? null,
      influencer_id: (item.influencer_id as string) ?? null,
      creator,
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

  const [auth, isAdmin, creators, movements, movedAssignments] = await Promise.all([
    getAuthContext(supabase),
    hasPermission(supabase, SHORTLIST_PERMISSIONS.admin),
    loadShortlistCreators(supabase, shortlistId),
    loadShortlistMovements(supabase, shortlistId),
    loadMovedAssignments(supabase, shortlistId),
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

export async function getShortlistBrandOptions(): Promise<ShortlistBrandOption[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("brands")
    .select("id, name, client:clients(name)")
    .order("name", { ascending: true })
    .limit(500);

  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as Array<{
    id: string;
    name: string;
    client: { name: string | null } | null;
  }>).map((row) => ({
    id: row.id,
    name: row.name,
    client_name: row.client?.name ?? null,
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
