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
import { resolveCreatorCountryCodes } from "@/lib/creators/country-inference";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { creatorProfileSourceFromUnified } from "@/lib/creators/creator-profile-source";
import { resolveCreatorProfileUrl } from "@/lib/discovery/profile-url";
import { isDurableStoredAvatarUrl } from "@/lib/creators/dna-avatar";
import { resolveBrowseCreatorProfileImageUrl } from "@/lib/performance/creator-avatar";
import {
  isDisplayableAvatarUrl,
  isUsableAvatarUrl,
} from "@/lib/performance/avatar-sync-policy";
import { COLLAPSE_CONTENT_LABEL } from "@/lib/discovery/collapse-content";

type Supabase = SupabaseClient<Database>;

/** Prefer durable storage, then fresh usable CDN, then any displayable URL. */
export function pickBestQuotationSeedAvatarUrl(
  ...candidates: Array<string | null | undefined>
): string | null {
  let bestDurable: string | null = null;
  let bestUsable: string | null = null;
  let bestDisplayable: string | null = null;

  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (!trimmed || !isDisplayableAvatarUrl(trimmed)) continue;
    if (isDurableStoredAvatarUrl(trimmed)) {
      bestDurable ??= trimmed;
      continue;
    }
    if (isUsableAvatarUrl(trimmed)) {
      bestUsable ??= trimmed;
      continue;
    }
    bestDisplayable ??= trimmed;
  }

  return bestDurable ?? bestUsable ?? bestDisplayable;
}

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
  option_number?: number | null;
  service_description?: string | null;
  collapse_group_id?: string | null;
  collapse_label?: string | null;
};

function resolveQuotationSeedPlatformAccount(creator: UnifiedCreatorResult) {
  const platforms = sortPlatformsStable(creator.platforms);
  return (
    platforms.find((account) => account.id === creator.default_metrics_platform_account_id) ??
    platforms[0] ??
    null
  );
}

/**
 * Line-level platform snapshot.
 * Prefer the default metrics account when the creator has multiple linked platforms
 * (null platforms break quotation workspace editors that call canonicalPlatformKey).
 */
export function resolveQuotationSeedPlatform(creator: UnifiedCreatorResult): string | null {
  const metricsAccount = resolveQuotationSeedPlatformAccount(creator);
  if (metricsAccount?.platform) {
    const key = canonicalPlatformKey(metricsAccount.platform);
    if (key) return key;
  }
  const linked = sortPlatformsStable(creator.platforms)
    .map((account) => canonicalPlatformKey(account.platform))
    .filter(Boolean);
  return linked[0] ?? null;
}

export function buildQuotationSeedFromCreator(
  creator: UnifiedCreatorResult,
  overrides?: Partial<QuotationItemSeed>
): QuotationItemSeed {
  const metricsAccount = resolveQuotationSeedPlatformAccount(creator);
  const source = creatorProfileSourceFromUnified(creator);
  const profileUrl =
    resolveCreatorProfileUrl(metricsAccount ?? undefined) ?? source.profile_url ?? null;
  // Prefer durable Thinkway storage over ephemeral IG/TikTok CDN snapshots.
  const browseFallback =
    resolveBrowseCreatorProfileImageUrl({
      platform: metricsAccount?.platform,
      platformPictureUrl: metricsAccount?.profile_picture_url,
      discoveryProfileImageUrl: creator.profile_image_url,
      influencerAvatarUrl: creator.primaryAvatarUrl ?? source.avatarUrl,
    }) ?? null;
  const profileImageUrl =
    pickBestQuotationSeedAvatarUrl(
      source.avatarUrl,
      creator.primaryAvatarUrl,
      metricsAccount?.profile_picture_url,
      creator.profile_image_url,
      browseFallback
    ) ?? null;

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
    country_code:
      resolveCreatorCountryCodes({
        country_codes: creator.country_codes,
        country_code: creator.country_code,
        estimated_country: creator.estimated_country,
        platformAudienceCountries: creator.platforms.map((platform) => platform.audience_country),
      })[0] ?? null,
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
    collapse_group_id: item.collapse_group_id ?? null,
    collapse_label: item.collapse_label ?? null,
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

export type ShortlistImportSeedPlanEntry = {
  item: ShortlistItemForSeed;
  /** Fresh quotation collapse group id; null for standalone lines. */
  collapseGroupId: string | null;
  collapseLabel: string | null;
  /** Drop source link so an existing standalone priced line stays untouched. */
  detachSourceLink: boolean;
  /** Identity-only seat (no package commercials) — followers + already-quoted members. */
  identityOnly: boolean;
};

/**
 * Plan shortlist → quotation inserts.
 * Standalone: skip rows already linked by source_shortlist_item_id.
 * Collap: always insert the full selected package as a new group; already-quoted
 * members are duplicated as detached identity seats so priced standalone lines remain.
 */
export function planShortlistItemsForQuotationImport(
  items: ShortlistItemForSeed[],
  existingSourceItemIds: Iterable<string>,
  options?: { newCollapseGroupId?: () => string }
): ShortlistImportSeedPlanEntry[] {
  const existing = new Set(existingSourceItemIds);
  const newCollapseGroupId = options?.newCollapseGroupId ?? (() => crypto.randomUUID());
  const plan: ShortlistImportSeedPlanEntry[] = [];

  const standalone: ShortlistItemForSeed[] = [];
  const byGroup = new Map<string, ShortlistItemForSeed[]>();

  for (const item of items) {
    const groupId = item.collapse_group_id?.trim() || null;
    if (!groupId) {
      standalone.push(item);
      continue;
    }
    const members = byGroup.get(groupId) ?? [];
    members.push(item);
    byGroup.set(groupId, members);
  }

  for (const item of standalone) {
    if (existing.has(item.id)) continue;
    plan.push({
      item,
      collapseGroupId: null,
      collapseLabel: null,
      detachSourceLink: false,
      identityOnly: false,
    });
  }

  for (const members of byGroup.values()) {
    if (members.length === 0) continue;
    const collapseGroupId = newCollapseGroupId();
    const collapseLabel =
      members.find((member) => member.collapse_label?.trim())?.collapse_label?.trim() ||
      COLLAPSE_CONTENT_LABEL;
    const sorted = [...members].sort((a, b) => a.id.localeCompare(b.id));
    const leader = sorted.find((member) => !existing.has(member.id)) ?? sorted[0]!;

    for (const item of sorted) {
      const detachSourceLink = existing.has(item.id);
      const isLeader = item.id === leader.id;
      plan.push({
        item,
        collapseGroupId,
        collapseLabel,
        detachSourceLink,
        identityOnly: !isLeader || detachSourceLink,
      });
    }
  }

  return plan;
}

export function buildQuotationSeedsFromImportPlan(
  plan: ShortlistImportSeedPlanEntry[],
  creators: Map<string, UnifiedCreatorResult>
): QuotationItemSeed[] {
  return plan.map((entry) => {
    const seed = buildQuotationSeedFromShortlistItem(
      entry.item,
      creators.get(entry.item.id) ?? null
    );
    return {
      ...seed,
      collapse_group_id: entry.collapseGroupId,
      collapse_label: entry.collapseLabel,
      ...(entry.detachSourceLink ? { source_shortlist_item_id: null } : {}),
      ...(entry.identityOnly
        ? {
            deliverables: [],
            service_description: null,
            cost: null,
            revenue: null,
            gp_pct: null,
            gp_value: null,
          }
        : {}),
    };
  });
}

export async function buildSeedsForShortlistQuotationImport(
  supabase: Supabase,
  items: ShortlistItemForSeed[],
  existingSourceItemIds: Iterable<string>,
  options?: { newCollapseGroupId?: () => string }
): Promise<QuotationItemSeed[]> {
  const plan = planShortlistItemsForQuotationImport(
    items,
    existingSourceItemIds,
    options
  );
  if (plan.length === 0) return [];
  const creators = await resolveCreatorsForShortlistItems(
    supabase,
    plan.map((entry) => entry.item)
  );
  return buildQuotationSeedsFromImportPlan(plan, creators);
}
