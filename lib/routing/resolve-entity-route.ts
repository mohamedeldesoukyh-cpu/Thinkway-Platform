import type { SupabaseClient } from "@supabase/supabase-js";

import { documentNumberLookupCandidates } from "@/lib/documents/format-document-number";
import { isUuid } from "@/lib/validation/uuid";
import type { Database } from "@/types/database";

import { entityShortId, parseEntityRouteKey, slugifyDisplayName } from "./entity-slug";

export type RoutableEntityTable =
  | "campaign_headers"
  | "clients"
  | "influencers"
  | "groups"
  | "quotations"
  | "discovery_shortlists";

type ResolveEntityRouteOptions = {
  documentNumberColumn?: string;
  serialNumberColumn?: string;
  nameColumn?: string;
};

type EntityIdRow = { id: string };

type SlugMatchRow = EntityIdRow & {
  slug?: string | null;
  name?: string | null;
  display_name?: string | null;
};

function isMissingSlugColumnError(message: string): boolean {
  return /slug|route_short_id/i.test(message);
}

function rowSlug(row: SlugMatchRow, nameColumn: string): string {
  const nameKey = nameColumn === "display_name" ? "display_name" : "name";
  return row.slug?.trim() || slugifyDisplayName(row[nameKey] ?? "");
}

/** Pick a single entity id from rows that share a route slug (and optional short id). */
export function pickEntityIdBySlugMatch(
  rows: SlugMatchRow[],
  slug: string,
  shortId: string | null,
  nameColumn: string
): string | null {
  const slugMatches = rows.filter((row) => {
    if (rowSlug(row, nameColumn) !== slug) return false;
    if (shortId) return entityShortId(row.id) === shortId.toLowerCase();
    return true;
  });

  if (slugMatches.length === 1) return slugMatches[0]!.id;

  // Stable short-id wins after renames (slug text in the URL may be stale).
  if (shortId) {
    const byShortId = rows.filter(
      (row) => entityShortId(row.id) === shortId.toLowerCase()
    );
    if (byShortId.length === 1) return byShortId[0]!.id;
  }

  return null;
}

/**
 * Resolve `{slug}-{shortId}` via UUID prefix range.
 * Works without slug / route_short_id columns (migration may be unapplied).
 */
export async function queryByUuidShortIdPrefix(
  supabase: SupabaseClient<Database>,
  table: RoutableEntityTable,
  shortId: string
): Promise<string | null> {
  const normalized = shortId.toLowerCase();
  if (!/^[0-9a-f]{8}$/.test(normalized)) return null;

  const lower = `${normalized}-0000-0000-0000-000000000000`;
  const upper = `${normalized}-ffff-ffff-ffff-ffffffffffff`;

  const { data, error } = await supabase
    .from(table)
    .select("id")
    .gte("id", lower)
    .lte("id", upper)
    .limit(2);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as EntityIdRow[];
  if (rows.length === 0) return null;
  if (rows.length === 1) return rows[0]!.id;

  const exact = rows.find((row) => entityShortId(row.id) === normalized);
  return exact?.id ?? null;
}

async function loadSlugMatchRows(
  supabase: SupabaseClient<Database>,
  table: RoutableEntityTable,
  nameColumn: string,
  offset: number,
  pageSize: number
): Promise<SlugMatchRow[]> {
  const nameKey = nameColumn === "display_name" ? "display_name" : "name";

  const runSelect = async (columns: string) => {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as SlugMatchRow[];
  };

  try {
    return await runSelect(`id, ${nameKey}, slug`);
  } catch (error) {
    if (!(error instanceof Error) || !isMissingSlugColumnError(error.message)) {
      throw error;
    }
    return runSelect(`id, ${nameKey}`);
  }
}

/** Scan visible rows and match slug / short id in memory (works without slug migration). */
async function resolveBySlugScan(
  supabase: SupabaseClient<Database>,
  table: RoutableEntityTable,
  slug: string,
  shortId: string | null,
  nameColumn: string
): Promise<string | null> {
  const pageSize = 1000;
  let offset = 0;

  while (offset < 20000) {
    const rows = await loadSlugMatchRows(supabase, table, nameColumn, offset, pageSize);
    if (rows.length === 0) break;

    const match = pickEntityIdBySlugMatch(rows, slug, shortId, nameColumn);
    if (match) return match;

    if (shortId) {
      const shortIdMatch = rows.find(
        (row) => entityShortId(row.id) === shortId.toLowerCase()
      );
      if (shortIdMatch) return shortIdMatch.id;
    }

    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  return null;
}

async function querySlugMatch(
  supabase: SupabaseClient<Database>,
  table: RoutableEntityTable,
  slug: string,
  shortId?: string
): Promise<EntityIdRow | EntityIdRow[] | null> {
  const client = supabase as unknown as SupabaseClient;
  let builder = client.from(table).select("id").eq("slug", slug);

  if (shortId) {
    builder = builder.eq("route_short_id", shortId);
    const { data, error } = await builder.maybeSingle();
    if (error) throw new Error(error.message);
    return data as EntityIdRow | null;
  }

  const { data, error } = await builder.limit(2);
  if (error) throw new Error(error.message);
  return (data ?? []) as EntityIdRow[];
}

/** Stable id suffix survives slug renames (e.g. after editing an entity name). */
async function queryByRouteShortId(
  supabase: SupabaseClient<Database>,
  table: RoutableEntityTable,
  shortId: string
): Promise<EntityIdRow | null> {
  const client = supabase as unknown as SupabaseClient;
  const { data, error } = await client
    .from(table)
    .select("id")
    .eq("route_short_id", shortId)
    .maybeSingle();
  if (error) {
    if (isMissingSlugColumnError(error.message)) return null;
    throw new Error(error.message);
  }
  return (data as EntityIdRow | null) ?? null;
}

/**
 * Resolve a dynamic route segment to an entity UUID.
 * Accepts UUID, document/serial numbers, slug, or slug-shortId forms.
 */
export async function resolveEntityIdByRouteKey(
  supabase: SupabaseClient<Database>,
  table: RoutableEntityTable,
  routeKey: string,
  options: ResolveEntityRouteOptions = {}
): Promise<string | null> {
  const key = decodeURIComponent(routeKey).trim();
  if (!key) return null;

  const documentNumberColumn = options.documentNumberColumn ?? "document_number";
  const serialNumberColumn = options.serialNumberColumn ?? "serial_number";
  const nameColumn = options.nameColumn ?? "name";

  if (isUuid(key)) {
    const { data, error } = await supabase
      .from(table)
      .select("id")
      .eq("id", key)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as EntityIdRow | null)?.id ?? null;
  }

  const parsed = parseEntityRouteKey(key);

  if (parsed.kind === "documentNumber") {
    const candidates = documentNumberLookupCandidates(parsed.value);
    for (const column of [documentNumberColumn, serialNumberColumn]) {
      for (const candidate of candidates) {
        const { data, error } = await supabase
          .from(table)
          .select("id")
          .eq(column, candidate)
          .maybeSingle();
        if (error) {
          // Shortlists use serial_number; other entities use document_number.
          if (/column|does not exist|schema cache/i.test(error.message)) break;
          throw new Error(error.message);
        }
        if (data) return (data as EntityIdRow).id;
      }
    }
    return null;
  }

  if (parsed.kind === "slugShortId") {
    // Prefer UUID prefix — independent of slug migration / rename drift.
    const byPrefix = await queryByUuidShortIdPrefix(
      supabase,
      table,
      parsed.shortId
    );
    if (byPrefix) return byPrefix;

    try {
      const data = await querySlugMatch(supabase, table, parsed.slug, parsed.shortId);
      if (data && !Array.isArray(data)) return data.id;

      const byShortId = await queryByRouteShortId(supabase, table, parsed.shortId);
      if (byShortId) return byShortId.id;
    } catch (error) {
      if (!(error instanceof Error) || !isMissingSlugColumnError(error.message)) {
        throw error;
      }
    }

    return resolveBySlugScan(supabase, table, parsed.slug, parsed.shortId, nameColumn);
  }

  if (parsed.kind === "slug") {
    try {
      const data = await querySlugMatch(supabase, table, parsed.slug);
      if (Array.isArray(data) && data.length === 1) return data[0]!.id;
    } catch (error) {
      if (!(error instanceof Error) || !isMissingSlugColumnError(error.message)) {
        throw error;
      }
    }
    return resolveBySlugScan(supabase, table, parsed.slug, null, nameColumn);
  }

  return null;
}
