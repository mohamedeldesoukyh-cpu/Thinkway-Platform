import type { SupabaseClient } from "@supabase/supabase-js";

import { browseUnifiedCreators } from "@/lib/creators/unified-browse";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import type { CommercialInputMode, Database } from "@/types/database";

import type { QuotationItemSeed } from "@/lib/services/quotations/quotation-helpers";

type Supabase = SupabaseClient<Database>;

export type ShortlistItemForSeed = {
  id: string;
  influencer_id: string | null;
  profile_id: string | null;
  unified_id: string | null;
  commercial_input_mode?: CommercialInputMode | null;
  cost?: number | null;
  cost_currency?: string | null;
  gp_pct?: number | null;
  revenue?: number | null;
  gp_value?: number | null;
  deliverables?: unknown;
};

export function buildQuotationSeedFromCreator(
  creator: UnifiedCreatorResult,
  overrides?: Partial<QuotationItemSeed>
): QuotationItemSeed {
  const primary = creator.platforms[0];
  return {
    influencer_id: creator.influencer_id ?? null,
    profile_id: creator.discovered_profile_id ?? null,
    unified_id: creator.unified_id,
    creator_name: creator.display_name,
    platform: primary?.platform ?? null,
    handle: primary?.handle ?? null,
    followers: creator.metrics.followers.value ?? primary?.follower_count ?? null,
    engagement_rate: creator.metrics.engagement_rate.value ?? primary?.engagement_rate ?? null,
    country_code: creator.country_code ?? creator.estimated_country ?? null,
    cost_currency: creator.suggested_currency ?? "EGP",
    ...overrides,
  };
}

export function buildQuotationSeedFromShortlistItem(
  item: ShortlistItemForSeed,
  creator: UnifiedCreatorResult | null
): QuotationItemSeed {
  const deliverables = Array.isArray(item.deliverables) ? item.deliverables : [];
  const base = creator
    ? buildQuotationSeedFromCreator(creator, {
        influencer_id: item.influencer_id ?? creator.influencer_id ?? null,
        profile_id: item.profile_id ?? creator.discovered_profile_id ?? null,
        unified_id: item.unified_id ?? creator.unified_id,
      })
    : {
        influencer_id: item.influencer_id,
        profile_id: item.profile_id,
        unified_id: item.unified_id,
        creator_name: null,
        platform: null,
        handle: null,
        followers: null,
        engagement_rate: null,
        country_code: null,
        cost_currency: "EGP",
      };

  return {
    ...base,
    source_shortlist_item_id: item.id,
    deliverables: deliverables as QuotationItemSeed["deliverables"],
    commercial_input_mode: item.commercial_input_mode ?? "cost_gp_pct",
    cost: item.cost ?? null,
    cost_currency: item.cost_currency ?? base.cost_currency ?? "EGP",
    gp_pct: item.gp_pct ?? null,
    revenue: item.revenue ?? null,
    gp_value: item.gp_value ?? null,
  };
}

/** Resolve unified creator profiles for shortlist items (same lookup order as shortlist queries). */
export async function resolveCreatorsForShortlistItems(
  supabase: Supabase,
  items: ShortlistItemForSeed[]
): Promise<Map<string, UnifiedCreatorResult>> {
  if (items.length === 0) return new Map();

  const browse = await browseUnifiedCreators(supabase, {
    pageSize: Math.max(400, items.length + 50),
  });

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

  const resolved = new Map<string, UnifiedCreatorResult>();
  for (const item of items) {
    const creator =
      (item.unified_id ? byUnifiedId.get(item.unified_id) : null) ??
      (item.profile_id ? byDiscoveryId.get(item.profile_id) : null) ??
      (item.influencer_id ? byInfluencerId.get(item.influencer_id) : null) ??
      null;
    if (creator) resolved.set(item.id, creator);
  }
  return resolved;
}

export async function buildSeedsFromShortlistItems(
  supabase: Supabase,
  items: ShortlistItemForSeed[]
): Promise<QuotationItemSeed[]> {
  const creators = await resolveCreatorsForShortlistItems(supabase, items);
  return items.map((item) =>
    buildQuotationSeedFromShortlistItem(item, creators.get(item.id) ?? null)
  );
}

/** Filter shortlist items not already linked on a quotation (by source_shortlist_item_id). */
export function filterNewShortlistImportItems(
  items: ShortlistItemForSeed[],
  existingSourceItemIds: Iterable<string>
): ShortlistItemForSeed[] {
  const existing = new Set(existingSourceItemIds);
  return items.filter((item) => !existing.has(item.id));
}
