import type { SupabaseClient } from "@supabase/supabase-js";

import type { CreatorEnrichmentStatus } from "@/lib/creator-enrichment/types";
import { resolveCountryCode } from "@/lib/creators/country-code";
import { applyInfluencerCountryBrowseFilter } from "@/lib/creators/country-inference";
import { normalizeCountryCode } from "@/lib/creators/creator-display-utils";
import { compareBrowseRecencyDesc } from "@/lib/creators/last-enriched-sort";
import type { UnifiedCreatorBrowseFilters } from "@/lib/creators/types";

/** PostgREST `.in()` filters blow up URL size with large discovery link sets. */
const IN_FILTER_BATCH_SIZE = 80;

/** PostgREST default page size — paginate active scans instead of one giant select. */
const RECENCY_SCAN_PAGE_SIZE = 1000;

type InfluencerRecencyRow = {
  id: string;
  last_enriched_at: string | null;
  updated_at: string | null;
  thinkway_score: number | null;
  country_code: string | null;
  enrichment_status: CreatorEnrichmentStatus | null;
};

type BrowseRecencyIdRow = {
  id: string;
  total_count: number | string | null;
};

export type BrowsableInfluencerIdPage = {
  ids: string[];
  total: number;
  /** `rpc` when served by browse_influencer_ids_by_recency; `legacy` when falling back. */
  source?: "rpc" | "legacy";
};

function chunkValues<T>(values: T[], size: number): T[][] {
  if (values.length === 0) return [];
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

/** Influencer ids linked from `discovered_profiles` (shortlist/quotation promotion path). */
export async function fetchDiscoveryLinkedInfluencerIds(
  supabase: SupabaseClient
): Promise<string[]> {
  const ids = new Set<string>();
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("discovered_profiles")
      .select("influencer_id")
      .not("influencer_id", "is", null)
      .range(from, from + RECENCY_SCAN_PAGE_SIZE - 1);

    if (error) throw new Error(error.message);

    const rows = data ?? [];
    for (const row of rows) {
      const id = row.influencer_id as string | null;
      if (id) ids.add(id);
    }

    if (rows.length < RECENCY_SCAN_PAGE_SIZE) break;
    from += RECENCY_SCAN_PAGE_SIZE;
  }

  return [...ids];
}

function applyInfluencerBrowseFilters<
  Q extends {
    eq: (column: string, value: string) => Q;
    contains: (column: string, value: string[]) => Q;
    or: (filters: string) => Q;
  },
>(query: Q, filters: UnifiedCreatorBrowseFilters): Q {
  query = applyInfluencerCountryBrowseFilter(query, filters.country);
  if (filters.language) query = query.contains("languages", [filters.language]);
  return query;
}

async function fetchInfluencerRecencyRows(
  supabase: SupabaseClient,
  filters: UnifiedCreatorBrowseFilters,
  options: { status: "active" | "prospect"; ids?: string[] }
): Promise<InfluencerRecencyRow[]> {
  let query = supabase
    .from("influencers")
    .select("id, last_enriched_at, updated_at, thinkway_score, country_code, enrichment_status")
    .eq("status", options.status);

  query = applyInfluencerBrowseFilters(query, filters);

  if (options.ids?.length) {
    query = query.in("id", options.ids);
  } else if (options.status === "prospect") {
    return [];
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as InfluencerRecencyRow[];
}

async function fetchInfluencerRecencyRowsBatched(
  supabase: SupabaseClient,
  filters: UnifiedCreatorBrowseFilters,
  options: { status: "active" | "prospect"; ids?: string[] }
): Promise<InfluencerRecencyRow[]> {
  if (options.ids?.length) {
    const rows: InfluencerRecencyRow[] = [];
    for (const chunk of chunkValues(options.ids, IN_FILTER_BATCH_SIZE)) {
      const batch = await fetchInfluencerRecencyRows(supabase, filters, {
        status: options.status,
        ids: chunk,
      });
      rows.push(...batch);
    }
    return rows;
  }

  const rows: InfluencerRecencyRow[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from("influencers")
      .select("id, last_enriched_at, updated_at, thinkway_score, country_code, enrichment_status")
      .eq("status", options.status);

    query = applyInfluencerBrowseFilters(query, filters);

    const { data, error } = await query.range(from, from + RECENCY_SCAN_PAGE_SIZE - 1);
    if (error) throw new Error(error.message);

    const batch = (data ?? []) as InfluencerRecencyRow[];
    rows.push(...batch);
    if (batch.length < RECENCY_SCAN_PAGE_SIZE) break;
    from += RECENCY_SCAN_PAGE_SIZE;
  }

  return rows;
}

async function countActiveInfluencers(
  supabase: SupabaseClient,
  filters: UnifiedCreatorBrowseFilters
): Promise<number> {
  let query = supabase
    .from("influencers")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  query = applyInfluencerBrowseFilters(query, filters);

  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function countLinkedProspectInfluencers(
  supabase: SupabaseClient,
  filters: UnifiedCreatorBrowseFilters,
  linkedProspectIds: string[]
): Promise<number> {
  if (linkedProspectIds.length === 0) return 0;

  let total = 0;
  for (const chunk of chunkValues(linkedProspectIds, IN_FILTER_BATCH_SIZE)) {
    let query = supabase
      .from("influencers")
      .select("id", { count: "exact", head: true })
      .eq("status", "prospect")
      .in("id", chunk);

    query = applyInfluencerBrowseFilters(query, filters);

    const { count, error } = await query;
    if (error) throw new Error(error.message);
    total += count ?? 0;
  }

  return total;
}

function isMissingRpcError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("browse_influencer_ids_by_recency") &&
    (normalized.includes("could not find") ||
      normalized.includes("does not exist") ||
      normalized.includes("schema cache") ||
      normalized.includes("404"))
  );
}

async function queryBrowsableInfluencerIdsByRecencyRpc(
  supabase: SupabaseClient,
  filters: UnifiedCreatorBrowseFilters,
  page: number,
  pageSize: number
): Promise<BrowsableInfluencerIdPage | null> {
  const country =
    normalizeCountryCode(resolveCountryCode(filters.country)) || null;
  const language = filters.language?.trim() || null;
  const offset = (Math.max(page, 1) - 1) * Math.max(pageSize, 0);

  const { data, error } = await supabase.rpc("browse_influencer_ids_by_recency", {
    p_country: country,
    p_language: language,
    p_limit: Math.max(pageSize, 0),
    p_offset: offset,
  });

  if (error) {
    if (isMissingRpcError(error.message)) return null;
    throw new Error(error.message);
  }

  const rows = (data ?? []) as BrowseRecencyIdRow[];
  return {
    ids: rows.map((row) => row.id).filter(Boolean),
    total: Number(rows[0]?.total_count ?? 0),
    source: "rpc",
  };
}

/**
 * Legacy full-catalog path — kept as fallback when the RPC migration is not applied.
 * Do not use in production once browse_influencer_ids_by_recency exists.
 */
export async function queryBrowsableInfluencerIdsByRecencyLegacy(
  supabase: SupabaseClient,
  filters: UnifiedCreatorBrowseFilters,
  page: number,
  pageSize: number
): Promise<BrowsableInfluencerIdPage> {
  const linkedProspectIds = await fetchDiscoveryLinkedInfluencerIds(supabase);
  const [activeRows, prospectRows] = await Promise.all([
    fetchInfluencerRecencyRowsBatched(supabase, filters, { status: "active" }),
    linkedProspectIds.length > 0
      ? fetchInfluencerRecencyRowsBatched(supabase, filters, {
          status: "prospect",
          ids: linkedProspectIds,
        })
      : Promise.resolve([]),
  ]);

  const byId = new Map<string, InfluencerRecencyRow>();
  for (const row of [...activeRows, ...prospectRows]) {
    byId.set(row.id, row);
  }

  const sorted = [...byId.values()].sort((a, b) =>
    compareBrowseRecencyDesc(
      {
        last_enriched_at: a.last_enriched_at,
        updated_at: a.updated_at,
        thinkway_score: a.thinkway_score ?? 0,
        unified_id: a.id,
        country_code: a.country_code,
        enrichment_status: a.enrichment_status,
      },
      {
        last_enriched_at: b.last_enriched_at,
        updated_at: b.updated_at,
        thinkway_score: b.thinkway_score ?? 0,
        unified_id: b.id,
        country_code: b.country_code,
        enrichment_status: b.enrichment_status,
      }
    )
  );

  const offset = (page - 1) * pageSize;
  return {
    ids: sorted.slice(offset, offset + pageSize).map((row) => row.id),
    total: sorted.length,
    source: "legacy",
  };
}

/**
 * Default Discovery browse pool: active influencers plus discovery-linked prospects
 * (still `prospect` until backfill/ensure runs). Sorted by ID-stage recency, then paginated
 * in PostgreSQL via browse_influencer_ids_by_recency.
 */
export async function queryBrowsableInfluencerIdsByRecency(
  supabase: SupabaseClient,
  filters: UnifiedCreatorBrowseFilters,
  page: number,
  pageSize: number
): Promise<BrowsableInfluencerIdPage> {
  const rpcPage = await queryBrowsableInfluencerIdsByRecencyRpc(
    supabase,
    filters,
    page,
    pageSize
  );
  if (rpcPage) return rpcPage;

  if (process.env.NODE_ENV === "development" || process.env.DISCOVERY_SEARCH_PERF === "1") {
    // eslint-disable-next-line no-console -- migration fallback visibility
    console.warn(
      "[discovery-browse-pool] browse_influencer_ids_by_recency missing; using legacy full-catalog path"
    );
  }

  return queryBrowsableInfluencerIdsByRecencyLegacy(supabase, filters, page, pageSize);
}

export async function countBrowsableInfluencers(
  supabase: SupabaseClient,
  filters: UnifiedCreatorBrowseFilters
): Promise<number> {
  const rpcPage = await queryBrowsableInfluencerIdsByRecencyRpc(supabase, filters, 1, 1);
  if (rpcPage) return rpcPage.total;

  const linkedProspectIds = await fetchDiscoveryLinkedInfluencerIds(supabase);
  const [activeTotal, prospectTotal] = await Promise.all([
    countActiveInfluencers(supabase, filters),
    countLinkedProspectInfluencers(supabase, filters, linkedProspectIds),
  ]);

  return activeTotal + prospectTotal;
}
