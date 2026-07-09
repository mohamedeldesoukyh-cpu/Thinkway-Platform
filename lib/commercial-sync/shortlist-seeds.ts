import type { SupabaseClient } from "@supabase/supabase-js";

import {
  resolveCreatorFromRefLookup,
  resolveUnifiedCreatorsByRefs,
} from "@/lib/creators/unified-browse";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import type { CommercialInputMode, Database } from "@/types/database";

import type { QuotationItemSeed } from "@/lib/domains/commercial/quotation-types";

import { sortPlatformsStable } from "@/lib/creators/creator-centric";
import { resolveCreatorFollowersCount } from "@/lib/creators/creator-display-utils";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { creatorProfileSourceFromUnified } from "@/lib/creators/creator-profile-source";
import { resolveCreatorProfileUrl } from "@/lib/discovery/profile-url";
import { resolveBrowseCreatorProfileImageUrl } from "@/lib/performance/creator-avatar";

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

function resolveQuotationSeedPlatformAccount(creator: UnifiedCreatorResult) {
  const platforms = sortPlatformsStable(creator.platforms);
  return (
    platforms.find((account) => account.id === creator.default_metrics_platform_account_id) ??
    platforms[0] ??
    null
  );
}

/** Line-level platform snapshot — null when creator has multiple linked accounts. */
export function resolveQuotationSeedPlatform(creator: UnifiedCreatorResult): string | null {
  const linked = sortPlatformsStable(creator.platforms).map((account) =>
    canonicalPlatformKey(account.platform)
  );
  return linked.length === 1 ? linked[0]! : null;
}

export function buildQuotationSeedFromCreator(
  creator: UnifiedCreatorResult,
  overrides?: Partial<QuotationItemSeed>
): QuotationItemSeed {
  const metricsAccount = resolveQuotationSeedPlatformAccount(creator);
  const source = creatorProfileSourceFromUnified(creator);
  const profileUrl =
    resolveCreatorProfileUrl(metricsAccount ?? undefined) ?? source.profile_url ?? null;
  const profileImageUrl =
    source.avatarUrl ??
    creator.primaryAvatarUrl ??
    creator.profile_image_url ??
    resolveBrowseCreatorProfileImageUrl({
      platform: metricsAccount?.platform,
      platformPictureUrl: metricsAccount?.profile_picture_url,
      discoveryProfileImageUrl: creator.profile_image_url,
      influencerAvatarUrl: creator.primaryAvatarUrl ?? source.avatarUrl,
    }) ??
    null;

  return {
    influencer_id: creator.influencer_id ?? null,
    profile_id: creator.discovered_profile_id ?? null,
    unified_id: creator.unified_id,
    creator_name: creator.display_name,
    platform: resolveQuotationSeedPlatform(creator),
    handle: metricsAccount?.handle ?? null,
    followers:
      resolveCreatorFollowersCount(creator, metricsAccount?.platform ?? null) ??
      metricsAccount?.follower_count ??
      null,
    engagement_rate:
      creator.metrics.engagement_rate.value ?? metricsAccount?.engagement_rate ?? null,
    country_code: creator.country_code ?? creator.estimated_country ?? null,
    profile_image_url: profileImageUrl,
    profile_url: profileUrl,
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

/** Resolve unified creator profiles for shortlist items by explicit refs. */
export async function resolveCreatorsForShortlistItems(
  supabase: Supabase,
  items: ShortlistItemForSeed[]
): Promise<Map<string, UnifiedCreatorResult>> {
  if (items.length === 0) return new Map();

  const lookup = await resolveUnifiedCreatorsByRefs(supabase, {
    unifiedIds: items.map((item) => item.unified_id),
    influencerIds: items.map((item) => item.influencer_id),
    discoveredProfileIds: items.map((item) => item.profile_id),
  });

  const resolved = new Map<string, UnifiedCreatorResult>();
  for (const item of items) {
    const creator = resolveCreatorFromRefLookup(lookup, item);
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
