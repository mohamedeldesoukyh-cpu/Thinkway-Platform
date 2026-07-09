/**
 * Creator-centric Discovery utilities — stable identity, platform ordering, avatar priority.
 */

import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { avatarSourceFromDnaUrl } from "@/lib/creators/dna-avatar";
import { detectAvatarCdn } from "@/lib/performance/creator-avatar";
import {
  isDisplayableAvatarUrl,
  isSameProviderAvatarUrl,
  isUsableAvatarUrl,
  normalizeAvatarSource,
} from "@/lib/performance/avatar-sync-policy";
import {
  metricWithConfidence,
  resolveInternalMetricConfidence,
} from "@/lib/creators/confidence";
import type {
  UnifiedCreatorMetrics,
  UnifiedCreatorPlatform,
  UnifiedCreatorResult,
} from "@/lib/domains/creator/types";
import { resolveCreatorContactFields } from "@/lib/creators/contact-info";

/** Display order for platform icons in Discovery rows (stable, not is_primary). */
export const DISCOVERY_PLATFORM_ORDER = [
  "instagram",
  "tiktok",
  "youtube",
  "snapchat",
  "facebook",
  "twitter",
  "x",
  "linkedin",
] as const;

export type PrimaryAvatarSource =
  | "manual"
  | "uploaded"
  | "imported"
  | "instagram"
  | "tiktok"
  | "youtube"
  | "opengraph"
  | "placeholder";

export type AvatarCandidate = {
  url: string | null | undefined;
  source: PrimaryAvatarSource;
  platform?: string | null;
};

export type PlatformAccountAvatarInput = {
  id: string;
  platform: string;
  profile_picture_url?: string | null;
  avatar_source?: string | null;
  metadata?: Record<string, unknown> | null;
};

const AVATAR_SOURCE_PRIORITY: Record<PrimaryAvatarSource, number> = {
  manual: 0,
  uploaded: 1,
  imported: 2,
  instagram: 3,
  tiktok: 4,
  youtube: 5,
  opengraph: 6,
  placeholder: 7,
};

const PLATFORM_METRICS_PRIORITY: Record<string, number> = {
  instagram: 0,
  tiktok: 1,
  youtube: 2,
  snapchat: 3,
  facebook: 4,
  twitter: 5,
  x: 5,
  linkedin: 6,
};

function platformSortKey(platform: string): number {
  const key = canonicalPlatformKey(platform);
  return PLATFORM_METRICS_PRIORITY[key] ?? 99;
}

/**
 * Prefer durable enrichment uploads over PDF import crops when both are
 * `uploaded` (imports are position-cropped and frequently mis-assigned).
 */
export function avatarStorageQualityRank(url: string | null | undefined): number {
  const lower = url?.trim().toLowerCase() ?? "";
  if (!lower) return 0;
  if (lower.includes("/creator-avatars/enrichment/")) return 3;
  if (lower.includes("/creator-avatars/imports/")) return 1;
  if (lower.includes("/creator-avatars/")) return 2;
  return 2;
}

/** Stable platform ordering for multi-platform creators (never depends on is_primary). */
export function sortPlatformsStable<T extends { platform: string }>(platforms: T[]): T[] {
  return [...platforms].sort(
    (a, b) =>
      platformSortKey(a.platform) - platformSortKey(b.platform) ||
      a.platform.localeCompare(b.platform)
  );
}

/** Platforms to show in Discovery rows — stable order, optionally scoped to active filter. */
export function filterPlatformsForDisplay<T extends { platform: string }>(
  platforms: T[],
  selectedPlatforms?: string[] | null
): T[] {
  const sorted = sortPlatformsStable(platforms);
  if (!selectedPlatforms?.length) return sorted;
  const keys = new Set(selectedPlatforms.map((platform) => canonicalPlatformKey(platform)));
  return sorted.filter((platform) => keys.has(canonicalPlatformKey(platform.platform)));
}

function avatarSourceFromAccount(account: PlatformAccountAvatarInput): PrimaryAvatarSource {
  const raw = account.avatar_source?.trim().toLowerCase();
  if (raw === "manual") return "manual";
  if (raw === "uploaded") return "uploaded";
  if (raw === "discovery") return "imported";

  const platformKey = canonicalPlatformKey(account.platform);
  if (platformKey === "instagram") return "instagram";
  if (platformKey === "tiktok") return "tiktok";
  if (platformKey === "youtube") return "youtube";

  const metadata = account.metadata ?? {};
  if (typeof metadata.imported_avatar === "string" && metadata.imported_avatar.trim()) {
    return "imported";
  }
  if (typeof metadata.avatar_url === "string" && metadata.avatar_url.trim()) {
    return "imported";
  }

  // apify / null / unknown — platform priority, never manual (null must not beat IG).
  return "opengraph";
}

function metadataAvatarUrl(metadata: Record<string, unknown> | null | undefined): string | null {
  if (typeof metadata?.avatar_url === "string" && metadata.avatar_url.trim()) {
    return metadata.avatar_url.trim();
  }
  if (typeof metadata?.profile_image_url === "string" && metadata.profile_image_url.trim()) {
    return metadata.profile_image_url.trim();
  }
  if (typeof metadata?.opengraph_image === "string" && metadata.opengraph_image.trim()) {
    return metadata.opengraph_image.trim();
  }
  return null;
}

export type StoredPrimaryAvatarMode = "operator" | "all" | "none";

/** Collect avatar candidates from influencer + platform accounts for priority resolution. */
export function collectAvatarCandidates(input: {
  storedPrimaryAvatarUrl?: string | null;
  storedPrimaryAvatarSource?: string | null;
  influencerMetadata?: Record<string, unknown> | null;
  discoveryProfileImageUrl?: string | null;
  dnaAvatarUrl?: string | null;
  accounts: PlatformAccountAvatarInput[];
  /**
   * operator (default): trust persisted manual/uploaded only — re-derive platform avatars live.
   * all: include persisted primary for persist/backfill diffing.
   */
  storedPrimaryMode?: StoredPrimaryAvatarMode;
}): AvatarCandidate[] {
  const candidates: AvatarCandidate[] = [];
  const storedMode = input.storedPrimaryMode ?? "operator";
  const storedUrl = input.storedPrimaryAvatarUrl?.trim();
  const storedSource = input.storedPrimaryAvatarSource as PrimaryAvatarSource | undefined;

  const apifyPlatformAvatar = input.accounts.find(
    (account) =>
      normalizeAvatarSource(account.avatar_source) === "apify" &&
      isUsableAvatarUrl(account.profile_picture_url)
  );
  const storedUploadedSupersededByApify =
    storedSource === "uploaded" &&
    Boolean(storedUrl) &&
    Boolean(apifyPlatformAvatar?.profile_picture_url?.trim()) &&
    !isSameProviderAvatarUrl(storedUrl, apifyPlatformAvatar!.profile_picture_url!);

  const storedPrimaryStale =
    Boolean(storedUrl) &&
    storedSource !== "manual" &&
    storedSource !== "uploaded" &&
    !isUsableAvatarUrl(storedUrl);

  const includeStoredPrimary =
    storedMode !== "none" &&
    storedUrl &&
    storedSource &&
    storedSource in AVATAR_SOURCE_PRIORITY &&
    !storedPrimaryStale &&
    (storedMode === "all" ||
      storedSource === "manual" ||
      (storedSource === "uploaded" && !storedUploadedSupersededByApify) ||
      (storedMode === "operator" &&
        storedSource !== "placeholder" &&
        storedSource !== "uploaded" &&
        isDisplayableAvatarUrl(storedUrl)));

  if (includeStoredPrimary) {
    candidates.push({ url: storedUrl, source: storedSource });
  }

  const dnaAvatar = input.dnaAvatarUrl?.trim();
  if (dnaAvatar && isDisplayableAvatarUrl(dnaAvatar)) {
    candidates.push({ url: dnaAvatar, source: avatarSourceFromDnaUrl(dnaAvatar) });
  }

  const influencerMetaAvatar = metadataAvatarUrl(input.influencerMetadata);
  if (influencerMetaAvatar) {
    const manualSource = input.influencerMetadata?.avatar_source;
    if (manualSource === "manual") {
      candidates.push({ url: influencerMetaAvatar, source: "manual" });
    } else {
      candidates.push({ url: influencerMetaAvatar, source: "imported" });
    }
  }

  for (const account of sortPlatformsStable(input.accounts)) {
    const url = account.profile_picture_url?.trim() || metadataAvatarUrl(account.metadata);
    if (!url) continue;
    candidates.push({
      url,
      source: avatarSourceFromAccount(account),
      platform: account.platform,
    });
  }

  if (input.discoveryProfileImageUrl?.trim()) {
    candidates.push({
      url: input.discoveryProfileImageUrl,
      source: "opengraph",
    });
  }

  candidates.push({ url: null, source: "placeholder" });
  return candidates;
}

/** Pick best avatar by business priority. Manual always wins over platform refresh. */
export function resolvePrimaryAvatar(candidates: AvatarCandidate[]): {
  url: string | null;
  source: PrimaryAvatarSource;
} {
  let best: AvatarCandidate = { url: null, source: "placeholder" };

  for (const candidate of candidates) {
    const url = candidate.url?.trim();
    if (candidate.source !== "placeholder" && !isDisplayableAvatarUrl(url)) continue;

    if (candidate.source === "placeholder") {
      if (best.source === "placeholder") best = candidate;
      continue;
    }

    const candidatePriority = AVATAR_SOURCE_PRIORITY[candidate.source];
    const bestPriority = AVATAR_SOURCE_PRIORITY[best.source];
    const candidateUsable = isUsableAvatarUrl(url);
    const bestUsable = isUsableAvatarUrl(best.url);
    const candidateStorage = avatarStorageQualityRank(url);
    const bestStorage = avatarStorageQualityRank(best.url);

    if (
      candidatePriority < bestPriority ||
      (candidatePriority === bestPriority && best.source === "placeholder") ||
      (candidatePriority === bestPriority && candidateUsable && !bestUsable) ||
      (candidatePriority === bestPriority &&
        candidateUsable === bestUsable &&
        candidateStorage > bestStorage)
    ) {
      best = { url: url ?? null, source: candidate.source };
    }
  }

  return { url: best.url ?? null, source: best.source };
}

/** Resolve stable creator-level avatar from influencer + linked platform accounts. */
export function resolveCreatorPrimaryAvatar(
  input: Parameters<typeof collectAvatarCandidates>[0]
): { url: string | null; source: PrimaryAvatarSource } {
  return resolvePrimaryAvatar(collectAvatarCandidates(input));
}

/** Platform hint for `<img>` normalization — matches avatar CDN, not metrics platform. */
export function primaryAvatarDisplayPlatform(
  source: PrimaryAvatarSource | null | undefined,
  avatarUrl: string | null | undefined
): string | null {
  if (source === "instagram" || source === "tiktok" || source === "youtube") {
    return source;
  }
  const cdn = detectAvatarCdn(avatarUrl);
  if (cdn !== "unknown") return cdn;
  return null;
}

export type MetricsPlatformAccount = {
  id: string;
  platform: string;
  follower_count?: number | null;
  engagement_rate?: number | null;
  avg_likes?: number | null;
  avg_comments?: number | null;
  avg_views?: number | null;
  metrics_source?: string | null;
  sync_status?: string | null;
  metrics_is_manual_override?: boolean | null;
  profile_bio?: string | null;
  hashtags?: string[];
  mentions?: string[];
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_links?: string[];
  recent_publications?: unknown;
  audience_country?: string | null;
  metadata?: Record<string, unknown> | null;
  interest_categories?: string[] | null;
};

/** Default metrics platform: stored preference → Instagram → TikTok → YouTube → highest followers. */
export function resolveDefaultMetricsPlatformAccountId(
  accounts: MetricsPlatformAccount[],
  storedAccountId?: string | null
): string | null {
  if (accounts.length === 0) return null;

  if (storedAccountId && accounts.some((a) => a.id === storedAccountId)) {
    return storedAccountId;
  }

  const sorted = sortPlatformsStable(accounts);
  for (const preferred of ["instagram", "tiktok", "youtube"] as const) {
    const match = sorted.find((a) => canonicalPlatformKey(a.platform) === preferred);
    if (match) return match.id;
  }

  const byFollowers = [...accounts].sort(
    (a, b) => (b.follower_count ?? 0) - (a.follower_count ?? 0)
  );
  return byFollowers[0]?.id ?? sorted[0]?.id ?? null;
}

export function findPlatformAccountById<T extends { id: string }>(
  accounts: T[],
  accountId: string | null | undefined
): T | null {
  if (!accountId) return null;
  return accounts.find((a) => a.id === accountId) ?? null;
}

/** Merge interest/category tags from all linked platform accounts + influencer categories. */
export function mergeCreatorInterestTags(input: {
  influencerCategories?: string[] | null;
  accounts: Array<{
    interest_categories?: string[] | null;
    metadata?: Record<string, unknown> | null;
  }>;
}): string[] {
  const raw: string[] = [...(input.influencerCategories ?? [])];

  for (const account of input.accounts) {
    raw.push(...(account.interest_categories ?? []));
    const metadata = account.metadata ?? {};
    for (const key of [
      "categories",
      "audience_interests",
      "ai_categories",
      "brand_fit_categories",
      "niche",
    ] as const) {
      const value = metadata[key];
      if (Array.isArray(value)) {
        raw.push(...value.map(String));
      } else if (typeof value === "string" && value.trim()) {
        raw.push(value.trim());
      }
    }
  }

  const seen = new Set<string>();
  const merged: string[] = [];
  for (const part of raw) {
    const trimmed = part?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(trimmed);
  }
  return merged;
}

/** Audience interests for Discovery UI — platform account tags only (not stored categories). */
export function audienceInterestListFromCreator(creator: UnifiedCreatorResult): string[] {
  const parts = [
    creator.ai_category,
    creator.ai_niche,
    ...(creator.audience_interests ?? []),
  ]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  const seen = new Set<string>();
  return parts.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Project list-row / detail metrics from a specific platform account. */
export function buildMetricsFromPlatformAccount(
  account: MetricsPlatformAccount | null | undefined,
  buildMetrics: (account: MetricsPlatformAccount | undefined) => UnifiedCreatorMetrics
): UnifiedCreatorMetrics {
  return buildMetrics(account ?? undefined);
}

/** Build unified metrics from a platform account row (Discovery detail switcher). */
export function buildInternalMetricsFromPlatform(
  account: UnifiedCreatorPlatform | null | undefined
): UnifiedCreatorMetrics {
  const metricConf = (has: boolean) =>
    resolveInternalMetricConfidence({
      has_value: has,
      is_manual_override: false,
    });

  return {
    followers: metricWithConfidence(account?.follower_count, metricConf(account?.follower_count != null)),
    engagement_rate: metricWithConfidence(
      account?.engagement_rate,
      metricConf(account?.engagement_rate != null)
    ),
    avg_likes: metricWithConfidence(account?.avg_likes, metricConf(account?.avg_likes != null)),
    avg_comments: metricWithConfidence(
      account?.avg_comments,
      metricConf(account?.avg_comments != null)
    ),
    avg_views: metricWithConfidence(account?.avg_views, metricConf(account?.avg_views != null)),
    posting_frequency_per_week: metricWithConfidence(null, "estimated"),
  };
}

/** Switch metrics/publications view to a platform without changing creator identity. */
export function projectCreatorPlatformView(
  creator: UnifiedCreatorResult,
  platformAccountId: string | null | undefined
): UnifiedCreatorResult {
  const account = findPlatformAccountById(creator.platforms, platformAccountId);
  if (!account) return creator;

  return {
    ...creator,
    metrics: buildInternalMetricsFromPlatform(account),
    estimated_country: account.audience_country ?? creator.estimated_country,
    bio: account.profile_bio ?? creator.bio,
    hashtags: account.hashtags ?? creator.hashtags,
    mentions: account.mentions ?? creator.mentions,
    ...resolveCreatorContactFields({
      contact_email: account.contact_email ?? creator.contact_email,
      contact_phone: account.contact_phone ?? creator.contact_phone,
      contact_links: account.contact_links ?? creator.contact_links,
    }),
    recent_publications: account.recent_publications ?? creator.recent_publications,
    is_platform_verified: account.is_verified ?? creator.is_platform_verified,
  };
}

/** Apply platform-specific view to a creator without changing identity fields. */
export function applyPlatformMetricsView(
  creator: UnifiedCreatorResult,
  platformAccountId: string | null | undefined,
  buildMetrics: (account: MetricsPlatformAccount | undefined) => UnifiedCreatorMetrics
): UnifiedCreatorResult {
  const account = findPlatformAccountById(
    creator.platforms as MetricsPlatformAccount[],
    platformAccountId
  );
  if (!account) return creator;

  const platformAccount = account as MetricsPlatformAccount;
  return {
    ...creator,
    metrics: buildMetricsFromPlatformAccount(platformAccount, buildMetrics),
    estimated_country: platformAccount.audience_country ?? creator.estimated_country,
    bio: platformAccount.profile_bio ?? creator.bio,
    hashtags: platformAccount.hashtags ?? creator.hashtags,
    mentions: platformAccount.mentions ?? creator.mentions,
    ...resolveCreatorContactFields({
      contact_email: platformAccount.contact_email ?? creator.contact_email,
      contact_phone: platformAccount.contact_phone ?? creator.contact_phone,
      contact_links: platformAccount.contact_links ?? creator.contact_links,
    }),
    default_metrics_platform_account_id:
      platformAccountId ?? creator.default_metrics_platform_account_id,
  };
}
