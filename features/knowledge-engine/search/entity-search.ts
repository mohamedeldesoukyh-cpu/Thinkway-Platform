import type { SupabaseClient } from "@supabase/supabase-js";

import { isUuid } from "@/lib/validation/uuid";
import { searchCreators } from "@/lib/creators/fts-search";

import type { EntitySearchHit, EntityType, MatchMethod } from "../types";
import { entitySearchCache } from "../cache/memory-cache";
import { escapeIlikePattern, fuzzyConfidence, normalizeSearchTerm } from "./fuzzy-match";
import { inferEntityTypeFromDocumentNumber } from "./patterns";

const SEARCH_LIMIT = 8;

type UntypedDb = SupabaseClient;

type RowHit = {
  id: string;
  label: string;
  subtitle?: string;
  metadata?: Record<string, unknown>;
};

function cacheKey(type: string, query: string, method: string): string {
  return `search:${type}:${method}:${normalizeSearchTerm(query)}`;
}

function toHit(
  type: EntityType,
  row: RowHit,
  matchedBy: MatchMethod,
  confidence: number
): EntitySearchHit {
  return {
    id: row.id,
    type,
    label: row.label,
    subtitle: row.subtitle,
    confidence,
    matchedBy,
    metadata: row.metadata,
  };
}

async function searchByDocumentNumber(
  supabase: SupabaseClient,
  query: string,
  table: string,
  type: EntityType,
  labelField = "name"
): Promise<EntitySearchHit[]> {
  const doc = query.trim().toUpperCase();
  const db = supabase as UntypedDb;
  const { data, error } = await db
    .from(table)
    .select("id, document_number, name")
    .eq("document_number", doc)
    .limit(SEARCH_LIMIT);

  if (error || !data?.length) return [];

  return (data as unknown as Record<string, unknown>[]).map((row) =>
    toHit(
      type,
      {
        id: row.id as string,
        label: (row[labelField] as string) ?? (row.name as string) ?? (row.document_number as string),
        subtitle: row.document_number as string,
      },
      "document_number",
      99
    )
  );
}

async function searchByUuid(
  supabase: SupabaseClient,
  query: string,
  table: string,
  type: EntityType,
  labelField = "name"
): Promise<EntitySearchHit[]> {
  if (!isUuid(query)) return [];

  const db = supabase as UntypedDb;
  const { data, error } = await db
    .from(table)
    .select("id, document_number, name")
    .eq("id", query.trim())
    .limit(1);

  if (error || !data?.length) return [];

  const row = data[0] as unknown as Record<string, unknown>;
  return [
    toHit(
      type,
      {
        id: row.id as string,
        label: (row[labelField] as string) ?? (row.name as string) ?? query,
        subtitle: (row.document_number as string) ?? undefined,
      },
      "uuid",
      100
    ),
  ];
}

async function searchByExactName(
  supabase: SupabaseClient,
  query: string,
  table: string,
  type: EntityType,
  fields: string[]
): Promise<EntitySearchHit[]> {
  const norm = normalizeSearchTerm(query);
  if (!norm) return [];

  const db = supabase as UntypedDb;

  for (const field of fields) {
    const { data, error } = await db
      .from(table)
      .select("id, document_number, name, legal_name")
      .ilike(field, query.trim())
      .limit(SEARCH_LIMIT);

    if (error || !data?.length) continue;

    const exact = (data as unknown as Record<string, unknown>[]).filter((row) =>
      fields.some((f) => normalizeSearchTerm(String(row[f] ?? row.name ?? "")) === norm)
    );

    if (exact.length) {
      return exact.map((row) =>
        toHit(
          type,
          {
            id: row.id as string,
            label: (row.name as string) ?? (row[fields[0]!] as string),
            subtitle: (row.document_number as string) ?? undefined,
          },
          "exact_name",
          96
        )
      );
    }
  }

  return [];
}

async function searchByPartial(
  supabase: SupabaseClient,
  query: string,
  table: string,
  type: EntityType,
  orFilters: (pattern: string) => string,
  labelField = "name"
): Promise<EntitySearchHit[]> {
  const pattern = `%${escapeIlikePattern(query.trim())}%`;
  const db = supabase as UntypedDb;
  const { data, error } = await db
    .from(table)
    .select("id, document_number, name")
    .or(orFilters(pattern))
    .limit(SEARCH_LIMIT);

  if (error || !data?.length) return [];

  return (data as unknown as Record<string, unknown>[]).map((row) =>
    toHit(
      type,
      {
        id: row.id as string,
        label: (row[labelField] as string) ?? (row.name as string) ?? query,
        subtitle: (row.document_number as string) ?? undefined,
      },
      "partial",
      82
    )
  );
}

function applyFuzzyToHits(
  query: string,
  hits: EntitySearchHit[],
  type: EntityType
): EntitySearchHit[] {
  const norm = normalizeSearchTerm(query);
  const scored = hits
    .map((hit) => {
      const score = fuzzyConfidence(norm, normalizeSearchTerm(hit.label));
      return score >= 72
        ? { ...hit, type, confidence: score, matchedBy: "fuzzy" as MatchMethod }
        : null;
    })
    .filter((h): h is EntitySearchHit => h !== null);

  return scored.sort((a, b) => b.confidence - a.confidence).slice(0, SEARCH_LIMIT);
}

export async function searchEntityWithPriority(
  supabase: SupabaseClient,
  query: string,
  type: EntityType,
  options?: { skipCache?: boolean }
): Promise<EntitySearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const key = cacheKey(type, trimmed, "priority");
  if (!options?.skipCache) {
    const cached = entitySearchCache.get(key) as EntitySearchHit[] | undefined;
    if (cached) {
      return cached.map((h) => ({ ...h, metadata: { ...h.metadata, fromCache: true } }));
    }
  }

  const strategies: Array<() => Promise<EntitySearchHit[]>> = [];

  switch (type) {
    case "campaign":
    case "campaign_code":
      strategies.push(
        () => searchByDocumentNumber(supabase, trimmed, "campaign_headers", "campaign"),
        () => searchByUuid(supabase, trimmed, "campaign_headers", "campaign"),
        () =>
          searchByExactName(supabase, trimmed, "campaign_headers", "campaign", ["name"]),
        () =>
          searchByPartial(
            supabase,
            trimmed,
            "campaign_headers",
            "campaign",
            (p) => [`name.ilike.${p}`, `document_number.ilike.${p}`].join(",")
          )
      );
      break;

    case "campaign_line":
      strategies.push(
        () => searchByDocumentNumber(supabase, trimmed, "campaign_lines", "campaign_line"),
        () => searchByUuid(supabase, trimmed, "campaign_lines", "campaign_line"),
        () =>
          searchByPartial(
            supabase,
            trimmed,
            "campaign_lines",
            "campaign_line",
            (p) => [`name.ilike.${p}`, `document_number.ilike.${p}`].join(",")
          )
      );
      break;

    case "client":
      strategies.push(
        () => searchByDocumentNumber(supabase, trimmed, "clients", "client"),
        () => searchByUuid(supabase, trimmed, "clients", "client"),
        () =>
          searchByExactName(supabase, trimmed, "clients", "client", [
            "name",
            "legal_name",
          ]),
        () =>
          searchByPartial(
            supabase,
            trimmed,
            "clients",
            "client",
            (p) =>
              [`name.ilike.${p}`, `legal_name.ilike.${p}`, `document_number.ilike.${p}`].join(
                ","
              )
          )
      );
      break;

    case "brand":
      strategies.push(
        () => searchByDocumentNumber(supabase, trimmed, "brands", "brand"),
        () => searchByUuid(supabase, trimmed, "brands", "brand"),
        () => searchByExactName(supabase, trimmed, "brands", "brand", ["name"]),
        () =>
          searchByPartial(
            supabase,
            trimmed,
            "brands",
            "brand",
            (p) => [`name.ilike.${p}`, `document_number.ilike.${p}`].join(",")
          )
      );
      break;

    case "brand_group":
      strategies.push(
        () => searchByDocumentNumber(supabase, trimmed, "groups", "brand_group"),
        () => searchByUuid(supabase, trimmed, "groups", "brand_group"),
        () => searchByExactName(supabase, trimmed, "groups", "brand_group", ["name"]),
        () =>
          searchByPartial(
            supabase,
            trimmed,
            "groups",
            "brand_group",
            (p) => [`name.ilike.${p}`, `document_number.ilike.${p}`].join(",")
          )
      );
      break;

    case "shortlist":
      strategies.push(
        () => searchByUuid(supabase, trimmed, "discovery_shortlists", "shortlist"),
        () =>
          searchByExactName(supabase, trimmed, "discovery_shortlists", "shortlist", ["name"]),
        () =>
          searchByPartial(
            supabase,
            trimmed,
            "discovery_shortlists",
            "shortlist",
            (p) => [`name.ilike.${p}`].join(",")
          )
      );
      break;

    case "invoice":
      strategies.push(
        () => searchByDocumentNumber(supabase, trimmed, "invoices", "invoice"),
        () => searchByUuid(supabase, trimmed, "invoices", "invoice"),
        () =>
          searchByPartial(
            supabase,
            trimmed,
            "invoices",
            "invoice",
            (p) => [`document_number.ilike.${p}`].join(",")
          )
      );
      break;

    case "purchase_order":
      strategies.push(
        () => searchByDocumentNumber(supabase, trimmed, "vendor_ios", "purchase_order"),
        () =>
          searchByPartial(
            supabase,
            trimmed,
            "vendor_ios",
            "purchase_order",
            (p) => [`document_number.ilike.${p}`].join(",")
          )
      );
      break;

    case "quotation":
      strategies.push(
        () => searchByDocumentNumber(supabase, trimmed, "quotations", "quotation"),
        () => searchByUuid(supabase, trimmed, "quotations", "quotation"),
        () =>
          searchByPartial(
            supabase,
            trimmed,
            "quotations",
            "quotation",
            (p) => [`serial_number.ilike.${p}`, `name.ilike.${p}`].join(",")
          )
      );
      break;

    case "creator":
    case "influencer":
    case "creator_handle":
    case "platform_account":
      strategies.push(async () => {
        try {
          const handle = trimmed.replace(/^@+/, "");
          const { hits } = await searchCreators(supabase, handle, SEARCH_LIMIT, 0);
          return hits.map((hit) =>
            toHit(
              "creator",
              {
                id: hit.creator_id,
                label: handle,
                metadata: { sourceType: hit.source_type, rank: hit.rank },
              },
              handle.startsWith("@") || /^[a-z0-9_.]+$/i.test(handle)
                ? "alias"
                : "partial",
              Math.min(95, 70 + hit.rank * 25)
            )
          );
        } catch {
          return [];
        }
      });
      break;

    case "platform":
      return [
        {
          id: trimmed.toLowerCase(),
          type: "platform",
          label: trimmed,
          confidence: 95,
          matchedBy: "pattern",
          metadata: { platform: trimmed.toLowerCase() },
        },
      ];

    case "hashtag":
      return [
        {
          id: trimmed.replace(/^#+/, "").toLowerCase(),
          type: "hashtag",
          label: `#${trimmed.replace(/^#+/, "")}`,
          confidence: 92,
          matchedBy: "pattern",
        },
      ];

    case "document_number": {
      const hint = inferEntityTypeFromDocumentNumber(trimmed);
      if (hint === "campaign_line") {
        return searchEntityWithPriority(supabase, trimmed, "campaign_line", options);
      }
      if (hint === "campaign") {
        return searchEntityWithPriority(supabase, trimmed, "campaign", options);
      }
      if (hint === "invoice") {
        return searchEntityWithPriority(supabase, trimmed, "invoice", options);
      }
      if (hint === "purchase_order") {
        return searchEntityWithPriority(supabase, trimmed, "purchase_order", options);
      }
      if (hint === "quotation") {
        return searchEntityWithPriority(supabase, trimmed, "quotation", options);
      }
      break;
    }

    default:
      break;
  }

  let partialHits: EntitySearchHit[] = [];

  for (let i = 0; i < strategies.length; i += 1) {
    const hits = await strategies[i]();
    const isPartialStrategy = i === strategies.length - 1;

    if (hits.length > 0 && !isPartialStrategy) {
      entitySearchCache.set(key, hits);
      return hits;
    }

    if (isPartialStrategy) {
      partialHits = hits;
    }
  }

  if (partialHits.length > 0) {
    entitySearchCache.set(key, partialHits);
    return partialHits;
  }

  const fuzzyHits = applyFuzzyToHits(trimmed, partialHits, type);
  if (fuzzyHits.length) {
    entitySearchCache.set(key, fuzzyHits);
    return fuzzyHits;
  }

  entitySearchCache.set(key, []);
  return [];
}

export async function searchCampaignContext(
  supabase: SupabaseClient,
  query: string
): Promise<EntitySearchHit[]> {
  const [campaigns, brands, clients] = await Promise.all([
    searchEntityWithPriority(supabase, query, "campaign"),
    searchEntityWithPriority(supabase, query, "brand"),
    searchEntityWithPriority(supabase, query, "client"),
  ]);

  const merged = [...campaigns, ...brands, ...clients];
  const seen = new Set<string>();
  return merged.filter((hit) => {
    const key = `${hit.type}:${hit.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
