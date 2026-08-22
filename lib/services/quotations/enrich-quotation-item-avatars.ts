import type { SupabaseClient } from "@supabase/supabase-js";

import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import {
  avatarStorageQualityRank,
  sortPlatformsStable,
} from "@/lib/creators/creator-centric";
import { resolveQuotationCreatorDisplayCategories } from "@/lib/quotations/quotation-creator-categories";
import {
  isPositiveNumericMetric,
  normalizeCountryCode,
  resolveCreatorEngagementRate,
  resolveCreatorFollowersCount,
} from "@/lib/creators/creator-display-utils";
import { resolveCreatorCountryCodes } from "@/lib/creators/country-inference";
import {
  creatorProfileSourceFromUnified,
  type CreatorProfileSource,
} from "@/lib/creators/creator-profile-source";
import { loadCanonicalDnaByInfluencerIds } from "@/lib/creators/dna-browse-hydration";
import {
  extractDnaAvatarUrl,
  isDurableStoredAvatarUrl,
  readDnaAvatarEnvelopeValue,
  resolveCreatorAvatarWithDnaFallback,
} from "@/lib/creators/dna-avatar";
import { normalizeThinkwayStoredAvatarUrl } from "@/lib/performance/creator-avatar";
import { resolveEnrichmentDisplayStatus } from "@/lib/creator-enrichment/enrichment-metrics";
import type { CreatorEnrichmentStatus } from "@/lib/creators/types";
import { buildQuotationCreatorProfileSource } from "@/lib/quotations/quotation-creator-source";
import type { CreatorDNADocument } from "@/features/creator-dna/types";
import {
  resolveCreatorFromRefLookup,
  resolveUnifiedCreatorsByRefs,
} from "@/lib/creators/unified-browse";
import { resolveCreatorProfileUrl } from "@/lib/discovery/profile-url";
import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";
import {
  isDisplayableAvatarUrl,
  isUsableAvatarUrl,
} from "@/lib/performance/avatar-sync-policy";
import { formatCreatorDisplayName } from "@/lib/text/decode-html-entities";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service-role-client";
import type { Database } from "@/types/database";

/** True when the line still needs a durable creator-avatars upload (CDN/null). */
export function needsWorkspaceAvatarStabilize(
  url: string | null | undefined
): boolean {
  const trimmed = url?.trim() ?? "";
  if (!trimmed) return true;
  return !isDurableStoredAvatarUrl(trimmed);
}

/** Exported for tests — prefers usable + higher storage quality (enrichment > imports). */
export function pickBestDisplayableAvatarUrl(
  ...candidates: Array<string | null | undefined>
): string | null {
  let best: string | null = null;
  let bestUsable = false;
  let bestRank = -1;

  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (!trimmed || !isDisplayableAvatarUrl(trimmed)) continue;
    const usable = isUsableAvatarUrl(trimmed);
    const rank = avatarStorageQualityRank(trimmed);
    if (
      !best ||
      (usable && !bestUsable) ||
      (usable === bestUsable && rank > bestRank)
    ) {
      best = trimmed;
      bestUsable = usable;
      bestRank = rank;
    }
  }

  return best;
}

function resolveDnaCanonicalAvatarUrl(
  dnaDocument: CreatorDNADocument | undefined
): string | null {
  const raw = readDnaAvatarEnvelopeValue(dnaDocument);
  if (!raw) return extractDnaAvatarUrl(dnaDocument);
  const normalized = normalizeThinkwayStoredAvatarUrl(raw) ?? raw;
  if (!isDisplayableAvatarUrl(normalized)) return extractDnaAvatarUrl(dnaDocument);
  return normalized;
}

function resolveQuotationLineAvatarUrl(
  creator: NonNullable<ReturnType<typeof resolveCreatorFromRefLookup>> | null,
  candidates: Array<string | null | undefined>,
  dnaDocument: CreatorDNADocument | undefined
): string | null {
  const dnaAvatar = resolveDnaCanonicalAvatarUrl(dnaDocument);
  const enriched =
    creator?.enrichment_status === "enriched" || creator?.enrichment_status === "partial";
  // Same ranking shortlist/unified browse uses (primary + platform + line).
  // Do not let a stale DNA envelope replace the shortlist face.
  const primary = pickBestDisplayableAvatarUrl(...candidates);
  if (primary && (isUsableAvatarUrl(primary) || isDurableStoredAvatarUrl(primary))) {
    return primary;
  }

  return (
    resolveCreatorAvatarWithDnaFallback({
      primaryAvatarUrl: primary,
      dnaAvatarUrl: dnaAvatar,
      preferEnrichedDna: Boolean(dnaAvatar) && (enriched || Boolean(primary && !isUsableAvatarUrl(primary))),
    }) ?? dnaAvatar ?? primary ?? null
  );
}

function resolveDnaOnlyCreatorProfileSource(
  item: QuotationItemRow,
  dnaDocument: CreatorDNADocument | undefined
): CreatorProfileSource | null {
  const avatarUrl = resolveQuotationLineAvatarUrl(null, [item.profile_image_url], dnaDocument);
  if (!avatarUrl) return null;

  const profileUrl =
    item.profile_url?.trim() ||
    (item.platform
      ? resolveCreatorProfileUrl({ platform: item.platform, handle: item.handle })
      : null);

  return {
    displayName:
      formatCreatorDisplayName(item.creator_name) ||
      formatCreatorDisplayName(item.handle) ||
      "Creator",
    avatarUrl,
    platform: item.platform,
    handle: item.handle,
    profile_url: profileUrl,
    countryCode: normalizeCountryCode(item.country_code),
    linkedPlatforms: item.platform ? [canonicalPlatformKey(item.platform)] : [],
  };
}

function resolveMetricsPlatformAccount(
  creator: NonNullable<ReturnType<typeof resolveCreatorFromRefLookup>>
) {
  const platforms = sortPlatformsStable(creator.platforms);
  return (
    platforms.find((account) => account.id === creator.default_metrics_platform_account_id) ??
    platforms[0] ??
    null
  );
}

function resolveLineCreatorProfileSource(
  item: QuotationItemRow,
  creator: NonNullable<ReturnType<typeof resolveCreatorFromRefLookup>>,
  dnaDocument: CreatorDNADocument | undefined
): CreatorProfileSource {
  const source = creatorProfileSourceFromUnified(creator);
  const linePlatform = item.platform ? canonicalPlatformKey(item.platform) : null;
  const platformAccount =
    linePlatform != null
      ? creator.platforms.find(
          (account) => canonicalPlatformKey(account.platform) === linePlatform
        )
      : resolveMetricsPlatformAccount(creator);

  const profileUrl =
    resolveCreatorProfileUrl(
      platformAccount
        ? {
            platform: platformAccount.platform,
            handle: platformAccount.handle ?? item.handle,
            profile_url: platformAccount.profile_url,
          }
        : item.platform
          ? {
              platform: item.platform,
              handle: item.handle,
            }
          : null
    ) ??
    source.profile_url ??
    null;

  const dnaAvatar = resolveDnaCanonicalAvatarUrl(dnaDocument);
  const avatarUrl =
    normalizeThinkwayStoredAvatarUrl(
      resolveCreatorAvatarWithDnaFallback({
        primaryAvatarUrl: source.avatarUrl,
        dnaAvatarUrl: dnaAvatar,
        preferEnrichedDna: Boolean(dnaAvatar),
      }) ?? source.avatarUrl
    ) ?? source.avatarUrl;
  const normalizedAvatarUrl = avatarUrl;

  const linkedPlatforms = source.linkedPlatforms ?? [];
  const platform =
    linePlatform ??
    (linkedPlatforms.length === 1 ? linkedPlatforms[0]! : null);

  return {
    ...source,
    displayName:
      source.displayName ||
      formatCreatorDisplayName(item.creator_name) ||
      formatCreatorDisplayName(item.handle) ||
      "Creator",
    avatarUrl: normalizedAvatarUrl,
    profile_url: profileUrl,
    platform,
    linkedPlatforms,
    handle: platformAccount?.handle ?? item.handle ?? source.handle,
    ...(() => {
      const countryCodes = resolveCreatorCountryCodes({
        country_codes: source.countryCodes,
        country_code: source.countryCode ?? normalizeCountryCode(item.country_code),
        estimated_country: creator.estimated_country,
        platformAudienceCountries: creator.platforms.map(
          (platform) => platform.audience_country
        ),
      });
      return {
        countryCode: countryCodes[0] ?? null,
        countryCodes: countryCodes.length > 0 ? countryCodes : null,
      };
    })(),
    isVerified: source.isVerified,
    thinkwayScore: creator.thinkway_score ?? source.thinkwayScore ?? null,
    enrichmentDisplayStatus: resolveEnrichmentDisplayStatus(
      creator.enrichment_status,
      creator
    ),
  };
}

function resolveLinePlatformAccount(
  item: QuotationItemRow,
  creator: NonNullable<ReturnType<typeof resolveCreatorFromRefLookup>>
) {
  const linePlatform = item.platform ? canonicalPlatformKey(item.platform) : null;
  return linePlatform != null
    ? creator.platforms.find(
        (account) => canonicalPlatformKey(account.platform) === linePlatform
      )
    : resolveMetricsPlatformAccount(creator);
}

function resolveLineFollowers(
  item: QuotationItemRow,
  creator: NonNullable<ReturnType<typeof resolveCreatorFromRefLookup>>
): number | null {
  if (isPositiveNumericMetric(item.followers)) return item.followers;
  const platformAccount = resolveLinePlatformAccount(item, creator);
  return (
    resolveCreatorFollowersCount(creator, platformAccount?.platform ?? item.platform) ??
    item.followers ??
    null
  );
}

function resolveLineEngagementRate(
  item: QuotationItemRow,
  creator: NonNullable<ReturnType<typeof resolveCreatorFromRefLookup>>
): number | null {
  if (item.engagement_rate != null && Number.isFinite(item.engagement_rate)) {
    return item.engagement_rate;
  }
  const platformAccount = resolveLinePlatformAccount(item, creator);
  return (
    resolveCreatorEngagementRate(creator, platformAccount?.platform ?? item.platform) ??
    item.engagement_rate ??
    null
  );
}

function resolveLineAvgViews(
  item: QuotationItemRow,
  creator: NonNullable<ReturnType<typeof resolveCreatorFromRefLookup>>
): number | null {
  const existing = (item as QuotationItemRow & { avg_views?: number | null }).avg_views;
  if (isPositiveNumericMetric(existing)) return existing;

  const platformAccount = resolveLinePlatformAccount(item, creator);
  if (isPositiveNumericMetric(platformAccount?.avg_views)) {
    return platformAccount.avg_views;
  }

  let best: number | null = null;
  for (const account of creator.platforms) {
    if (!isPositiveNumericMetric(account.avg_views)) continue;
    if (best == null || account.avg_views > best) best = account.avg_views;
  }
  if (best != null) return best;

  const metric = creator.metrics?.avg_views?.value;
  return isPositiveNumericMetric(metric) ? metric : null;
}

function resolveLineCreatorCategories(
  item: QuotationItemRow,
  creator: NonNullable<ReturnType<typeof resolveCreatorFromRefLookup>>
): string[] {
  const platformAccount = resolveLinePlatformAccount(item, creator);
  return resolveQuotationCreatorDisplayCategories({
    itemCategories: item.creator_categories,
    creator,
    creatorName: item.creator_name,
    handle: item.handle ?? platformAccount?.handle,
    linePlatform: item.platform,
    followers: resolveLineFollowers(item, creator),
    countryCode: item.country_code,
  });
}

function resolveLineAvatarFields(
  item: QuotationItemRow,
  creator: NonNullable<ReturnType<typeof resolveCreatorFromRefLookup>>,
  dnaDocument: CreatorDNADocument | undefined
): {
  profile_image_url: string | null;
  profile_url: string | null;
  platform: string | null;
  followers: number | null;
  engagement_rate: number | null;
  avg_views: number | null;
  country_code: string | null;
  creator_profile_source: CreatorProfileSource;
  creator_categories: string[];
} {
  const creatorProfileSource = resolveLineCreatorProfileSource(item, creator, dnaDocument);
  const resolvedPlatform =
    item.platform?.trim() ||
    creatorProfileSource.platform?.trim() ||
    (creatorProfileSource.linkedPlatforms?.length === 1
      ? creatorProfileSource.linkedPlatforms[0]!
      : null);
  return {
    profile_image_url: normalizeThinkwayStoredAvatarUrl(creatorProfileSource.avatarUrl) ??
      creatorProfileSource.avatarUrl ??
      null,
    profile_url: creatorProfileSource.profile_url ?? null,
    platform: resolvedPlatform,
    followers: resolveLineFollowers(item, creator),
    engagement_rate: resolveLineEngagementRate(item, creator),
    avg_views: resolveLineAvgViews(item, creator),
    country_code:
      creatorProfileSource.countryCode ??
      normalizeCountryCode(item.country_code) ??
      null,
    creator_profile_source: {
      ...creatorProfileSource,
      avatarUrl:
        normalizeThinkwayStoredAvatarUrl(creatorProfileSource.avatarUrl) ??
        creatorProfileSource.avatarUrl ??
        null,
    },
    creator_categories: resolveLineCreatorCategories(item, creator),
  };
}

function fallbackAvatarFields(item: QuotationItemRow): {
  profile_image_url: string | null;
  profile_url: string | null;
} {
  const profileUrl = item.platform
    ? resolveCreatorProfileUrl({ platform: item.platform, handle: item.handle })
    : null;
  return {
    profile_image_url: item.profile_image_url ?? null,
    profile_url: item.profile_url ?? profileUrl,
  };
}

async function resolveInfluencerIdsByHandles(
  supabase: SupabaseClient<Database>,
  handles: Array<string | null | undefined>
): Promise<Map<string, string>> {
  const normalized = [
    ...new Set(
      handles
        .map((handle) => handle?.trim().replace(/^@+/, "").toLowerCase() ?? "")
        .filter(Boolean)
    ),
  ];
  const byHandle = new Map<string, string>();
  if (!normalized.length) return byHandle;

  const BATCH = 40;
  for (let offset = 0; offset < normalized.length; offset += BATCH) {
    const batch = normalized.slice(offset, offset + BATCH);
    const orFilter = batch.map((handle) => `handle.ilike.${handle}`).join(",");
    const { data, error } = await supabase
      .from("influencer_platform_accounts")
      .select("influencer_id, handle")
      .or(orFilter)
      .limit(batch.length * 5);
    if (error) throw new Error(error.message);

    for (const row of data ?? []) {
      const key = row.handle?.trim().replace(/^@+/, "").toLowerCase();
      if (key && row.influencer_id && !byHandle.has(key)) {
        byHandle.set(key, row.influencer_id);
      }
    }
  }

  return byHandle;
}

function resolveCreatorForQuotationItem(
  lookup: Awaited<ReturnType<typeof resolveUnifiedCreatorsByRefs>>,
  item: QuotationItemRow,
  influencerIdsByHandle: Map<string, string>
) {
  const byRef = resolveCreatorFromRefLookup(lookup, item);
  if (byRef) return byRef;

  const handle = item.handle?.trim().replace(/^@+/, "").toLowerCase();
  if (!handle) return null;
  const influencerId = influencerIdsByHandle.get(handle);
  if (!influencerId) return null;
  return lookup.byInfluencerId.get(influencerId) ?? null;
}

type InfluencerWorkspaceMeta = {
  thinkway_score: number | null;
  enrichment_status: string | null;
  primary_avatar_url: string | null;
  /** Platform account photos — same sources Creator Details uses for avatar pick. */
  platform_avatar_urls: string[];
};

/** Resolve influencer UUID from line refs (`influencer_id` or `unified_id` = `inf:…`). */
function resolveWorkspaceInfluencerId(item: QuotationItemRow): string | null {
  if (item.influencer_id?.trim()) return item.influencer_id.trim();
  const unified = item.unified_id?.trim();
  if (unified?.startsWith("inf:") && unified.length > 4) {
    return unified.slice(4);
  }
  return null;
}

async function loadInfluencerPlatformAvatarUrlsByIds(
  supabase: SupabaseClient<Database>,
  influencerIds: string[]
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!influencerIds.length) return map;

  const { data, error } = await supabase
    .from("influencer_platform_accounts")
    .select("influencer_id, profile_picture_url")
    .in("influencer_id", influencerIds);

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const url = row.profile_picture_url?.trim();
    if (!url || !row.influencer_id) continue;
    const list = map.get(row.influencer_id) ?? [];
    list.push(url);
    map.set(row.influencer_id, list);
  }

  return map;
}

async function loadInfluencerWorkspaceMetaByIds(
  supabase: SupabaseClient<Database>,
  influencerIds: string[]
): Promise<Map<string, InfluencerWorkspaceMeta>> {
  const map = new Map<string, InfluencerWorkspaceMeta>();
  if (!influencerIds.length) return map;

  const [influencerResult, platformAvatars] = await Promise.all([
    supabase
      .from("influencers")
      .select("id, thinkway_score, enrichment_status, primary_avatar_url")
      .in("id", influencerIds),
    loadInfluencerPlatformAvatarUrlsByIds(supabase, influencerIds),
  ]);

  if (influencerResult.error) throw new Error(influencerResult.error.message);

  for (const row of influencerResult.data ?? []) {
    const score = row.thinkway_score == null ? null : Number(row.thinkway_score);
    map.set(row.id, {
      thinkway_score: score != null && Number.isFinite(score) ? score : null,
      enrichment_status: row.enrichment_status,
      primary_avatar_url: row.primary_avatar_url?.trim() || null,
      platform_avatar_urls: platformAvatars.get(row.id) ?? [],
    });
  }

  return map;
}

async function loadDiscoveredProfileScoresByIds(
  supabase: SupabaseClient<Database>,
  profileIds: string[]
): Promise<Map<string, number | null>> {
  const map = new Map<string, number | null>();
  if (!profileIds.length) return map;

  const { data, error } = await supabase
    .from("discovered_profiles")
    .select("id, thinkway_score")
    .in("id", profileIds);

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const score = row.thinkway_score == null ? null : Number(row.thinkway_score);
    map.set(row.id, score != null && Number.isFinite(score) ? score : null);
  }

  return map;
}

/**
 * Quotation workspace enrich — must match export-quality avatar resolution.
 * Loads DNA + platform photos, prefers durable storage, persists recovered URLs,
 * and queues background stabilize for creators still missing a usable avatar.
 */
export async function enrichQuotationItemsForWorkspace(
  supabase: SupabaseClient<Database>,
  items: QuotationItemRow[]
): Promise<QuotationItemRow[]> {
  if (items.length === 0) return items;

  const linkedInfluencerIds = [
    ...new Set(
      items
        .map((item) => resolveWorkspaceInfluencerId(item))
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const profileIds = [
    ...new Set(
      items
        .map((item) => item.profile_id?.trim())
        .filter((id): id is string => Boolean(id))
    ),
  ];

  // Resolve handle → influencer when the quotation line snapshot omitted influencer_id.
  const needsHandleLookup = items.some(
    (item) => !resolveWorkspaceInfluencerId(item) && item.handle?.trim()
  );
  const influencerIdsByHandle = needsHandleLookup
    ? await resolveInfluencerIdsByHandles(
        supabase,
        items.map((item) => item.handle)
      )
    : new Map<string, string>();

  const influencerIds = [
    ...new Set([
      ...linkedInfluencerIds,
      ...influencerIdsByHandle.values(),
    ]),
  ];

  const [influencerMeta, profileScores, dnaByInfluencer] = await Promise.all([
    loadInfluencerWorkspaceMetaByIds(supabase, influencerIds),
    loadDiscoveredProfileScoresByIds(supabase, profileIds),
    loadCanonicalDnaByInfluencerIds(supabase, influencerIds),
  ]);

  const enriched = items.map((item) => {
    const creatorProfileSource = buildQuotationCreatorProfileSource(item);
    const handle = item.handle?.trim().replace(/^@+/, "").toLowerCase() ?? "";
    const influencerId =
      resolveWorkspaceInfluencerId(item) ??
      (handle ? influencerIdsByHandle.get(handle) ?? null : null);
    const meta = influencerId ? influencerMeta.get(influencerId) : undefined;
    const dnaDocument = influencerId
      ? dnaByInfluencer.get(influencerId)
      : undefined;
    const profileScore = item.profile_id
      ? profileScores.get(item.profile_id)
      : undefined;

    const thinkwayScore =
      meta?.thinkway_score ??
      profileScore ??
      creatorProfileSource.thinkwayScore ??
      null;

    // Prefer settled DB status for the green ring. Do not require thinkway_score —
    // enrichment can complete (or stage as awaiting_profile_details) without a score.
    const rawStatus = meta?.enrichment_status as CreatorEnrichmentStatus | null | undefined;
    const enrichmentDisplayStatus: CreatorEnrichmentStatus =
      rawStatus === "failed"
        ? "failed"
        : rawStatus === "partial"
          ? "partial"
          : rawStatus === "queued" || rawStatus === "running"
            ? rawStatus
            : rawStatus === "enriched" ||
                rawStatus === "skipped" ||
                rawStatus === "awaiting_profile_details"
              ? rawStatus
              : thinkwayScore != null
                ? "enriched"
                : "never";

    // Align with shortlist/unified browse: influencer primary, then line/source, then platforms.
    const resolvedAvatar =
      resolveQuotationLineAvatarUrl(
        null,
        [
          meta?.primary_avatar_url,
          creatorProfileSource.avatarUrl,
          item.profile_image_url,
          ...(meta?.platform_avatar_urls ?? []),
        ],
        dnaDocument
      ) ??
      pickBestDisplayableAvatarUrl(
        meta?.primary_avatar_url,
        creatorProfileSource.avatarUrl,
        item.profile_image_url,
        ...(meta?.platform_avatar_urls ?? [])
      );

    const enrichedProfileSource = {
      ...creatorProfileSource,
      avatarUrl: resolvedAvatar,
      thinkwayScore,
      enrichmentDisplayStatus,
    };

    return {
      ...item,
      influencer_id: item.influencer_id ?? influencerId,
      profile_image_url: resolvedAvatar ?? item.profile_image_url,
      creator_profile_source: enrichedProfileSource,
      // Prefer stored line categories; skip expensive bio inference on workspace paint.
      creator_categories:
        item.creator_categories?.length
          ? item.creator_categories.slice(0, 3)
          : resolveQuotationCreatorDisplayCategories({
              itemCategories: item.creator_categories,
              creatorName: item.creator_name,
              handle: item.handle,
              linePlatform: item.platform,
              followers: item.followers,
              countryCode: item.country_code,
            }),
    };
  });

  // Persist recovered durable/DNA avatars onto the line so the next load is instant.
  await persistQuotationItemAvatars(supabase, enriched, items);
  // Background: upload CDN/profile photos into creator-avatars for lines still missing.
  void stabilizeMissingWorkspaceAvatars(supabase, enriched);

  return enriched;
}

/**
 * Fire-and-forget durable avatar recovery for workspace lines still on CDN / null.
 * Uses the service-role client — creator-avatars uploads are service_role-only.
 * Falls back to Apify when Instagram CDN + OpenGraph are dead.
 */
async function stabilizeMissingWorkspaceAvatars(
  _userSupabase: SupabaseClient<Database>,
  items: QuotationItemRow[]
): Promise<void> {
  const missing = items.filter((item) => {
    if (!needsWorkspaceAvatarStabilize(item.profile_image_url)) return false;
    return Boolean(resolveWorkspaceInfluencerId(item) || item.handle?.trim());
  });
  if (!missing.length) return;

  let admin: SupabaseClient<Database>;
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    admin = createSupabaseAdminClient();
  } catch (error) {
    console.warn(
      "[quotation-avatars] admin client unavailable; cannot persist durable avatars",
      error instanceof Error ? error.message : error
    );
    return;
  }

  const { repairCreatorAvatarDurably } = await import(
    "@/lib/creators/stabilize-creator-avatar"
  );

  // Cap concurrency — Apify avatar refresh can take ~60s per creator.
  const queue = missing.slice(0, 40);
  const concurrency = 2;
  let cursor = 0;

  async function worker() {
    while (cursor < queue.length) {
      const item = queue[cursor++];
      if (!item) return;
      const influencerId = resolveWorkspaceInfluencerId(item);
      if (!influencerId) continue;
      try {
        const result = await repairCreatorAvatarDurably(admin, influencerId, {
          preferredHandle: item.handle?.replace(/^@+/, "") ?? undefined,
          preferredPlatform: item.platform ?? undefined,
          allowApifyFallback: true,
        });
        if (!result.ok || !result.url) {
          console.warn(
            "[quotation-avatars] durable repair failed",
            item.handle,
            result.reason
          );
          continue;
        }
        if (result.url === item.profile_image_url) continue;
        await admin
          .from("quotation_items")
          .update({ profile_image_url: result.url } as never)
          .eq("id", item.id);
      } catch (error) {
        console.warn(
          "[quotation-avatars] durable repair error",
          item.handle,
          error instanceof Error ? error.message : error
        );
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, queue.length) }, () => worker())
  );
}

export async function enrichQuotationItemsWithCreatorAvatars(
  supabase: SupabaseClient<Database>,
  items: QuotationItemRow[]
): Promise<QuotationItemRow[]> {
  if (items.length === 0) return items;

  const allDisplayReady = items.every((item) => {
    const hasCountry = Boolean(
      normalizeCountryCode(item.country_code) ||
        normalizeCountryCode(item.creator_profile_source?.countryCode) ||
        (item.creator_profile_source?.countryCodes?.length ?? 0) > 0
    );
    return (
      isDisplayableAvatarUrl(item.profile_image_url) &&
      item.creator_name?.trim() &&
      (item.followers != null || item.handle?.trim()) &&
      (item.creator_categories?.length ?? 0) > 0 &&
      // Details sheet loads live creator country — line must enrich when missing.
      hasCountry
    );
  });
  if (allDisplayReady) return items;

  const influencerIdsByHandle = await resolveInfluencerIdsByHandles(
    supabase,
    items.map((item) => item.handle)
  );

  const lookup = await resolveUnifiedCreatorsByRefs(supabase, {
    unifiedIds: items.map((item) => item.unified_id),
    influencerIds: [
      ...items.map((item) => item.influencer_id),
      ...influencerIdsByHandle.values(),
    ],
    discoveredProfileIds: items.map((item) => item.profile_id),
  });

  const influencerIdsForDna = [
    ...new Set([
      ...influencerIdsByHandle.values(),
      ...items
        .map((item) => item.influencer_id)
        .filter((id): id is string => Boolean(id)),
      ...[...lookup.byInfluencerId.keys()],
    ]),
  ];

  const dnaByInfluencer = await loadCanonicalDnaByInfluencerIds(supabase, influencerIdsForDna);

  const enriched = items.map((item) => {
    const creator = resolveCreatorForQuotationItem(lookup, item, influencerIdsByHandle);
    const handle = item.handle?.trim().replace(/^@+/, "").toLowerCase() ?? "";
    const influencerId =
      creator?.influencer_id ??
      item.influencer_id ??
      (handle ? influencerIdsByHandle.get(handle) : null) ??
      null;
    const dnaDocument = influencerId ? dnaByInfluencer.get(influencerId) : undefined;

    if (!creator) {
      const dnaProfileSource = resolveDnaOnlyCreatorProfileSource(item, dnaDocument);
      return {
        ...item,
        profile_image_url: dnaProfileSource?.avatarUrl ?? item.profile_image_url ?? null,
        profile_url:
          dnaProfileSource?.profile_url ??
          fallbackAvatarFields(item).profile_url,
        avg_views: (item as QuotationItemRow & { avg_views?: number | null }).avg_views ?? null,
        creator_profile_source: dnaProfileSource,
        creator_categories: resolveQuotationCreatorDisplayCategories({
          itemCategories: item.creator_categories,
          creatorName: item.creator_name,
          handle: item.handle,
          linePlatform: item.platform,
          followers: item.followers,
          countryCode: item.country_code,
        }),
      };
    }

    const enrichedFields = resolveLineAvatarFields(item, creator, dnaDocument);
    return { ...item, ...enrichedFields };
  });

  void persistQuotationItemAvatars(supabase, enriched, items);
  return enriched;
}

async function persistQuotationItemAvatars(
  supabase: SupabaseClient<Database>,
  enriched: QuotationItemRow[],
  original: QuotationItemRow[]
) {
  const originalById = new Map(original.map((item) => [item.id, item]));
  const writer = tryCreateServiceRoleClient().client ?? supabase;

  await Promise.all(
    enriched.map(async (item) => {
      const prev = originalById.get(item.id);
      if (!prev) return;
      const imageChanged =
        (item.profile_image_url ?? null) !== (prev.profile_image_url ?? null);
      const urlChanged = item.profile_url && item.profile_url !== prev.profile_url;
      const followersChanged =
        isPositiveNumericMetric(item.followers) && item.followers !== prev.followers;
      const platformChanged =
        item.platform?.trim() &&
        item.platform.trim() !== (prev.platform?.trim() ?? "");
      const erChanged =
        item.engagement_rate != null &&
        Number.isFinite(item.engagement_rate) &&
        item.engagement_rate !== prev.engagement_rate;
      const categoriesChanged =
        (item.creator_categories?.length ?? 0) > 0 &&
        JSON.stringify(item.creator_categories) !== JSON.stringify(prev.creator_categories ?? []);
      if (
        !imageChanged &&
        !urlChanged &&
        !followersChanged &&
        !platformChanged &&
        !erChanged &&
        !categoriesChanged
      ) {
        return;
      }

      await writer
        .from("quotation_items")
        .update({
          profile_image_url: item.profile_image_url,
          profile_url: item.profile_url,
          ...(categoriesChanged ? { creator_categories: item.creator_categories } : {}),
          ...(followersChanged ? { followers: item.followers } : {}),
          ...(platformChanged ? { platform: item.platform } : {}),
          ...(erChanged ? { engagement_rate: item.engagement_rate } : {}),
        } as never)
        .eq("id", item.id);
    })
  );
}
