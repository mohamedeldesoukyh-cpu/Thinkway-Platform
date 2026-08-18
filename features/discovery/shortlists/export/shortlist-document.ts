import { creatorProfileSourceFromUnified } from "@/lib/creators/creator-profile-source";
import {
  brandSafetyMeta,
  formatCreatorCount,
  formatEngagementRate,
  normalizeCountryCode,
} from "@/features/discovery/components/creator-search/creator-search-utils";
import { formatCreatorCountryLabels } from "@/lib/creators/creator-display-utils";
import { resolveCreatorCountryCodes } from "@/lib/creators/country-inference";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { filterPlatformsForDisplay, sortPlatformsStable } from "@/lib/creators/creator-centric";
import { creatorStoredCategoriesForDisplay } from "@/lib/creators/category-filter";
import {
  resolveCreatorTierFromUnified,
  type CreatorTierLabel,
} from "@/lib/creators/creator-tier";
import { platformLabel } from "@/features/campaigns/line-assignment";
import {
  resolveCreatorProfileUrl,
  type ProfileUrlSource,
} from "@/lib/discovery/profile-url";
import { creatorAvatarBrowserDisplayUrl } from "@/lib/performance/creator-avatar";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { COLLAPSE_CONTENT_LABEL, collapseContentPreviewLabel } from "@/lib/discovery/collapse-content";
import {
  computeCampaignForecastFromProfiles,
  shortlistGroupsToForecastProfiles,
} from "@/lib/campaign-forecast";
import { optimizeShortlistCampaign } from "@/lib/discovery/shortlists/shortlist-optimization";
import { evaluateShortlistDecision } from "@/lib/discovery/shortlists/shortlist-decision";

import type { ShortlistTemplateVariant } from "./shortlist-template";
import {
  SHORTLIST_ITEM_STATUS_LABELS,
  SHORTLIST_STATUS_LABELS,
  SHORTLIST_VISIBILITY_LABELS,
} from "../constants";
import type { ShortlistCreatorItem, ShortlistDetail } from "../types";

export type ShortlistPlatformLink = {
  platform: string;
  url: string;
  label: string;
};

export type ShortlistDocPublicationShot = {
  imageUrl: string;
  postUrl: string | null;
  caption: string | null;
  isVideo: boolean;
  imageProxyUrl?: string | null;
};

export type ShortlistDocPlatformMetric = {
  platform: string;
  followers: string;
  engagement: string;
  views: string;
  profileUrl: string | null;
  avatarUrl: string | null;
};

export function shortlistCreatorKey(item: ShortlistCreatorItem): string {
  return item.unified_id ?? item.influencer_id ?? item.profile_id ?? item.item_id;
}

export type ShortlistDocCreatorGroup = {
  creatorKey: string;
  rank: number;
  creator: string;
  handle: string;
  avatarUrl: string | null;
  avatarProfileUrl: string | null;
  avatarProxyUrl: string | null;
  profileUrl: string | null;
  platformLinks: ShortlistPlatformLink[];
  platform: string;
  platformMetrics: ShortlistDocPlatformMetric[];
  followers: string;
  followersNumeric: number | null;
  engagementRate: string;
  engagementRateNumeric: number | null;
  country: string;
  tier: CreatorTierLabel;
  categories: string[];
  isVerified: boolean;
  interests: string;
  brandSafety: string;
  status: string;
  notes: string;
  matchScore: string;
  publicationShots: ShortlistDocPublicationShot[];
};

export type ShortlistDocRow = {
  rank: number;
  creator: string;
  handle: string;
  avatarUrl: string | null;
  /** Social profile URL for server-side avatar fetch when CDN src is blocked. */
  avatarProfileUrl: string | null;
  platformLinks: ShortlistPlatformLink[];
  platform: string;
  followers: string;
  engagementRate: string;
  country: string;
  interests: string;
  brandSafety: string;
  status: string;
  notes: string;
  matchScore: string;
};

export type ShortlistSummaryBreakdownItem = {
  label: string;
  count: number;
};

export type ShortlistDocumentSummary = {
  creatorCount: number;
  /** Deduplicated sum of creator followers (audience size). */
  totalFollowers: number;
  totalFollowersLabel: string;
  /** Expected unique people reached (Campaign Forecast Engine). */
  estimatedReach: number;
  estimatedReachLabel: string;
  estimatedImpressions: number;
  estimatedViews: number;
  estimatedEngagements: number;
  avgEngagementRate: number | null;
  avgEngagementRateLabel: string;
  platformBreakdown: ShortlistSummaryBreakdownItem[];
  countryBreakdown: ShortlistSummaryBreakdownItem[];
  categoryBreakdown: ShortlistSummaryBreakdownItem[];
  avgMatchScore: number | null;
  avgMatchScoreLabel: string;
  brandSafetyBreakdown: ShortlistSummaryBreakdownItem[];
  statusBreakdown: ShortlistSummaryBreakdownItem[];
  /** Campaign optimization health from Forecast Engine output. */
  campaignHealthScore?: number;
  campaignDecisionScore?: number;
  launchReadiness?: string | null;
  topDecisionRecommendation?: string | null;
  topOptimizationRecommendation?: string | null;
};

export type ShortlistDocCollapseContentGroup = {
  collapseGroupId: string;
  label: string;
  previewLabel: string;
  creators: ShortlistDocCreatorGroup[];
};

export type ShortlistDocument = {
  template: ShortlistTemplateVariant;
  serial: string;
  name: string;
  description: string | null;
  statusLabel: string;
  visibilityLabel: string;
  ownerName: string;
  brandName: string;
  clientName: string;
  creatorCount: number;
  generatedAt: Date;
  generatedDateLabel: string;
  summary: ShortlistDocumentSummary;
  rows: ShortlistDocRow[];
  creatorGroups: ShortlistDocCreatorGroup[];
  collapseContentGroups: ShortlistDocCollapseContentGroup[];
};

function resolveEngagementRate(
  creator: UnifiedCreatorResult,
  displayPlatforms: UnifiedCreatorResult["platforms"]
): string {
  if (displayPlatforms.length === 1) {
    return formatEngagementRate(displayPlatforms[0]?.engagement_rate ?? null);
  }
  return formatEngagementRate(creator.metrics.engagement_rate.value);
}

function resolvePlatformLabel(creator: UnifiedCreatorResult): string {
  const displayPlatforms = filterPlatformsForDisplay(creator.platforms);
  if (displayPlatforms.length === 0) return "—";
  if (displayPlatforms.length === 1) {
    return platformLabel(displayPlatforms[0]!.platform);
  }
  return displayPlatforms.map((p) => platformLabel(p.platform)).join(", ");
}

function resolveFollowersNumeric(creator: UnifiedCreatorResult): number | null {
  const displayPlatforms = filterPlatformsForDisplay(creator.platforms);
  if (displayPlatforms.length === 1) {
    return displayPlatforms[0]?.follower_count ?? null;
  }
  return creator.metrics.followers.value ?? null;
}

function resolveEngagementRateNumeric(creator: UnifiedCreatorResult): number | null {
  const displayPlatforms = filterPlatformsForDisplay(creator.platforms);
  if (displayPlatforms.length === 1) {
    return displayPlatforms[0]?.engagement_rate ?? null;
  }
  return creator.metrics.engagement_rate.value ?? null;
}

function resolveFollowers(creator: UnifiedCreatorResult): string {
  return formatCreatorCount(resolveFollowersNumeric(creator));
}

function incrementBreakdown(map: Map<string, number>, label: string | null | undefined): void {
  if (!label?.trim() || label === "—") return;
  map.set(label, (map.get(label) ?? 0) + 1);
}

function topBreakdownItems(
  map: Map<string, number>,
  limit = 5
): ShortlistSummaryBreakdownItem[] {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

function formatShortlistDateLabel(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function computeShortlistSummary(
  items: ShortlistCreatorItem[],
  includeInternalFields: boolean
): ShortlistDocumentSummary {
  let totalFollowers = 0;
  let erSum = 0;
  let erCount = 0;
  let matchSum = 0;
  let matchCount = 0;
  let creatorCount = 0;

  const platformMap = new Map<string, number>();
  const countryMap = new Map<string, number>();
  const categoryMap = new Map<string, number>();
  const brandSafetyMap = new Map<string, number>();
  const statusMap = new Map<string, number>();

  for (const item of items) {
    const creator = item.creator;
    if (!creator) continue;
    creatorCount++;

    const followers = resolveFollowersNumeric(creator);
    if (followers != null) totalFollowers += followers;

    const er = resolveEngagementRateNumeric(creator);
    if (er != null) {
      erSum += er;
      erCount++;
    }

    if (item.match_score != null) {
      matchSum += item.match_score;
      matchCount++;
    }

    for (const account of filterPlatformsForDisplay(creator.platforms)) {
      incrementBreakdown(platformMap, platformLabel(account.platform));
    }

    const countryCodes = resolveCreatorCountryCodes({
      country_codes: creator.country_codes,
      country_code: creator.country_code,
      estimated_country: creator.estimated_country,
      platformAudienceCountries: creator.platforms.map((platform) => platform.audience_country),
    });
    for (const code of countryCodes) {
      incrementBreakdown(countryMap, code);
    }

    for (const category of creatorStoredCategoriesForDisplay(creator).slice(0, 3)) {
      incrementBreakdown(categoryMap, category);
    }

    if (includeInternalFields) {
      incrementBreakdown(brandSafetyMap, brandSafetyMeta(creator.authenticity_score).label);
      incrementBreakdown(statusMap, SHORTLIST_ITEM_STATUS_LABELS[item.item_status]);
    }
  }

  const avgEngagementRate = erCount > 0 ? erSum / erCount : null;
  const avgMatchScore = matchCount > 0 ? matchSum / matchCount : null;

  return {
    creatorCount,
    totalFollowers,
    totalFollowersLabel: formatCreatorCount(totalFollowers > 0 ? totalFollowers : null),
    estimatedReach: 0,
    estimatedReachLabel: "—",
    estimatedImpressions: 0,
    estimatedViews: 0,
    estimatedEngagements: 0,
    avgEngagementRate,
    avgEngagementRateLabel: formatEngagementRate(avgEngagementRate),
    platformBreakdown: topBreakdownItems(platformMap),
    countryBreakdown: topBreakdownItems(countryMap),
    categoryBreakdown: topBreakdownItems(categoryMap),
    avgMatchScore,
    avgMatchScoreLabel:
      avgMatchScore != null ? `${Math.round(avgMatchScore)}%` : "—",
    brandSafetyBreakdown: topBreakdownItems(brandSafetyMap),
    statusBreakdown: topBreakdownItems(statusMap),
  };
}

function resolvePlatformMetrics(
  creator: UnifiedCreatorResult,
  avatarUrl: string | null
): ShortlistDocPlatformMetric[] {
  return filterPlatformsForDisplay(creator.platforms).map((account) => ({
    platform: account.platform,
    followers: formatCreatorCount(account.follower_count ?? null),
    engagement: formatEngagementRate(account.engagement_rate ?? null),
    views: "—",
    profileUrl: resolveCreatorProfileUrl({
      platform: account.platform,
      handle: account.handle,
      profile_url: account.profile_url,
    }),
    avatarUrl,
  }));
}

function resolvePlatformLinks(creator: UnifiedCreatorResult): ShortlistPlatformLink[] {
  return filterPlatformsForDisplay(creator.platforms)
    .map((account) => {
      const url = resolveCreatorProfileUrl({
        platform: account.platform,
        handle: account.handle,
        profile_url: account.profile_url,
      });
      if (!url) return null;

      return {
        platform: account.platform,
        url,
        label: platformLabel(account.platform),
      };
    })
    .filter((link): link is ShortlistPlatformLink => link != null);
}

export function formatShortlistPlatformLinksForExport(
  links: ShortlistPlatformLink[]
): string {
  if (links.length === 0) return "—";
  return links.map((link) => `${link.label}: ${link.url}`).join("; ");
}

/** Profile link source: single visible platform account, else default metrics platform. */
function resolveShortlistProfileSource(creator: UnifiedCreatorResult): ProfileUrlSource | null {
  const displayPlatforms = filterPlatformsForDisplay(creator.platforms);
  if (displayPlatforms.length === 1) {
    const account = displayPlatforms[0]!;
    return {
      platform: account.platform,
      handle: account.handle,
      profile_url: account.profile_url,
    };
  }

  const metricsPlatform =
    creator.platforms.find((p) => p.id === creator.default_metrics_platform_account_id) ??
    sortPlatformsStable(creator.platforms)[0];
  if (!metricsPlatform) return null;

  return {
    platform: metricsPlatform.platform,
    handle: metricsPlatform.handle,
    profile_url: metricsPlatform.profile_url,
  };
}

function resolveShortlistTier(creator: UnifiedCreatorResult): CreatorTierLabel {
  return resolveCreatorTierFromUnified(creator);
}

function buildCreatorGroup(
  item: ShortlistCreatorItem,
  rank: number,
  publicationShotsByCreatorKey?: Map<string, ShortlistDocPublicationShot[]>
): ShortlistDocCreatorGroup | null {
  const row = buildRow(item, rank);
  if (!row) return null;

  const creator = item.creator!;
  const source = creatorProfileSourceFromUnified(creator);
  const profileSource = resolveShortlistProfileSource(creator);
  const profileUrl =
    (profileSource ? resolveCreatorProfileUrl(profileSource) : null) ??
    row.platformLinks[0]?.url ??
    null;
  const categories = creatorStoredCategoriesForDisplay(creator).slice(0, 5);
  const creatorKey = shortlistCreatorKey(item);
  const avatarProxyUrl =
    row.avatarUrl && row.avatarProfileUrl
      ? creatorAvatarBrowserDisplayUrl(row.avatarUrl, row.avatarProfileUrl)
      : null;

  return {
    creatorKey,
    rank: row.rank,
    creator: row.creator,
    handle: row.handle,
    avatarUrl: row.avatarUrl,
    avatarProfileUrl: row.avatarProfileUrl,
    avatarProxyUrl,
    profileUrl,
    platformLinks: row.platformLinks,
    platform: row.platform,
    platformMetrics: resolvePlatformMetrics(creator, row.avatarUrl),
    followers: row.followers,
    followersNumeric: resolveFollowersNumeric(creator),
    engagementRate: row.engagementRate,
    engagementRateNumeric: resolveEngagementRateNumeric(creator),
    country: row.country,
    tier: resolveShortlistTier(creator),
    categories,
    isVerified: Boolean(source.isVerified ?? creator.is_platform_verified),
    interests: row.interests,
    brandSafety: row.brandSafety,
    status: row.status,
    notes: row.notes,
    matchScore: row.matchScore,
    publicationShots: publicationShotsByCreatorKey?.get(creatorKey) ?? [],
  };
}

function buildRow(item: ShortlistCreatorItem, rank: number): ShortlistDocRow | null {
  const creator = item.creator;
  if (!creator) return null;

  const source = creatorProfileSourceFromUnified(creator);
  const profileSource = resolveShortlistProfileSource(creator);
  const handle =
    profileSource?.handle != null
      ? profileSource.handle.startsWith("@")
        ? profileSource.handle
        : `@${profileSource.handle}`
      : source.handle != null
        ? source.handle.startsWith("@")
          ? source.handle
          : `@${source.handle}`
        : "—";
  const safety = brandSafetyMeta(creator.authenticity_score);
  const interests = creatorStoredCategoriesForDisplay(creator).slice(0, 3).join(", ") || "—";
  const country = formatCreatorCountryLabels(creator);
  const platformLinks = resolvePlatformLinks(creator);
  const avatarProfileUrl =
    (profileSource ? resolveCreatorProfileUrl(profileSource) : null) ??
    platformLinks[0]?.url ??
    null;

  return {
    rank,
    creator: source.displayName,
    handle,
    avatarUrl: source.avatarUrl?.trim() || null,
    avatarProfileUrl,
    platformLinks,
    platform: resolvePlatformLabel(creator),
    followers: resolveFollowers(creator),
    engagementRate: resolveEngagementRate(creator, filterPlatformsForDisplay(creator.platforms)),
    country,
    interests,
    brandSafety: safety.label,
    status: SHORTLIST_ITEM_STATUS_LABELS[item.item_status],
    notes: item.notes?.trim() || "—",
    matchScore: item.match_score != null ? `${Math.round(item.match_score)}%` : "—",
  };
}

export type BuildShortlistDocumentOptions = {
  template?: ShortlistTemplateVariant;
  itemIds?: string[];
  /** Optional platform subset for icons / profile links. */
  platforms?: string[] | null;
  publicationShotsByCreatorKey?: Map<string, ShortlistDocPublicationShot[]>;
};

function applyShortlistPlatformFilter<T extends {
  platformLinks: ShortlistPlatformLink[];
  platform: string;
  platformMetrics?: ShortlistDocPlatformMetric[];
}>(
  entry: T,
  platformFilterKeys: Set<string> | null
): T {
  if (!platformFilterKeys) return entry;
  const platformLinks = entry.platformLinks.filter((link) =>
    platformFilterKeys.has(canonicalPlatformKey(link.platform))
  );
  const platform =
    platformLinks.length === 0
      ? "—"
      : platformLinks.length === 1
        ? platformLinks[0]!.label
        : platformLinks.map((link) => link.label).join(", ");
  const platformMetrics = entry.platformMetrics?.filter((metric) =>
    platformFilterKeys.has(canonicalPlatformKey(metric.platform))
  );
  return { ...entry, platformLinks, platform, ...(platformMetrics ? { platformMetrics } : {}) };
}

export function buildShortlistDocument(
  detail: ShortlistDetail,
  options: BuildShortlistDocumentOptions = {}
): ShortlistDocument {
  const template = options.template ?? "detailed";
  const itemIdSet =
    options.itemIds && options.itemIds.length > 0 ? new Set(options.itemIds) : null;

  const items = itemIdSet
    ? detail.creators.filter((item) => itemIdSet.has(item.item_id))
    : detail.creators;

  const rows = items
    .map((item, index) => buildRow(item, index + 1))
    .filter((row): row is ShortlistDocRow => row != null);

  const publicationShotsByCreatorKey = options.publicationShotsByCreatorKey;

  const creatorGroups = items
    .map((item, index) =>
      buildCreatorGroup(item, index + 1, publicationShotsByCreatorKey)
    )
    .filter((group): group is ShortlistDocCreatorGroup => group != null);

  const groupByItemId = new Map<string, ShortlistDocCreatorGroup>();
  items.forEach((item, index) => {
    const group = buildCreatorGroup(item, index + 1, publicationShotsByCreatorKey);
    if (group) groupByItemId.set(item.item_id, group);
  });

  const collapseContentGroups: ShortlistDocCollapseContentGroup[] = [];
  const seenCollapse = new Set<string>();
  for (const item of items) {
    const collapseId = item.collapse_group_id;
    if (!collapseId || seenCollapse.has(collapseId)) continue;
    seenCollapse.add(collapseId);
    const members = items.filter((row) => row.collapse_group_id === collapseId);
    const label = members.find((row) => row.collapse_label)?.collapse_label?.trim() || COLLAPSE_CONTENT_LABEL;
    collapseContentGroups.push({
      collapseGroupId: collapseId,
      label,
      previewLabel: collapseContentPreviewLabel(label),
      creators: members
        .map((row) => groupByItemId.get(row.item_id))
        .filter((group): group is ShortlistDocCreatorGroup => group != null),
    });
  }

  const generatedAt = new Date();
  const baseSummary = computeShortlistSummary(items, template === "detailed");
  const rosterForecast = computeCampaignForecastFromProfiles(
    shortlistGroupsToForecastProfiles(creatorGroups)
  );
  const optimization = optimizeShortlistCampaign(creatorGroups);
  const decision = evaluateShortlistDecision(creatorGroups);
  const summary: ShortlistDocumentSummary = {
    ...baseSummary,
    totalFollowers: rosterForecast.audienceSize,
    totalFollowersLabel: formatCreatorCount(
      rosterForecast.audienceSize > 0 ? rosterForecast.audienceSize : null
    ),
    estimatedReach: rosterForecast.estimatedReach,
    estimatedReachLabel: formatCreatorCount(
      rosterForecast.estimatedReach > 0 ? rosterForecast.estimatedReach : null
    ),
    estimatedImpressions: rosterForecast.estimatedImpressions,
    estimatedViews: rosterForecast.estimatedViews,
    estimatedEngagements: rosterForecast.estimatedEngagements,
    campaignHealthScore: optimization.healthScore.overall,
    campaignDecisionScore: decision.decisionScore.overall,
    launchReadiness: decision.readinessLabel,
    topDecisionRecommendation: decision.approvalSummary.recommendation,
    topOptimizationRecommendation: optimization.recommendations[0]?.action ?? null,
  };

  const platformFilterKeys = options.platforms?.length
    ? new Set(
        options.platforms
          .map((platform) => canonicalPlatformKey(platform))
          .filter(Boolean)
      )
    : null;
  const filteredRows = rows.map((row) =>
    applyShortlistPlatformFilter(row, platformFilterKeys)
  );
  const filteredCreatorGroups = creatorGroups.map((group) =>
    applyShortlistPlatformFilter(group, platformFilterKeys)
  );
  const filteredCollapseGroups = collapseContentGroups.map((group) => ({
    ...group,
    creators: group.creators.map((creator) =>
      applyShortlistPlatformFilter(creator, platformFilterKeys)
    ),
  }));

  return {
    template,
    serial: detail.serial_number ?? "SL-PENDING",
    name: detail.name,
    description: detail.description,
    statusLabel: SHORTLIST_STATUS_LABELS[detail.status],
    visibilityLabel: SHORTLIST_VISIBILITY_LABELS[detail.visibility],
    ownerName: detail.owner_name ?? "—",
    brandName: detail.brand_name ?? "—",
    clientName: detail.client_name ?? "—",
    creatorCount: filteredRows.length,
    generatedAt,
    generatedDateLabel: formatShortlistDateLabel(generatedAt),
    summary,
    rows: filteredRows,
    creatorGroups: filteredCreatorGroups,
    collapseContentGroups: filteredCollapseGroups,
  };
}

export function shortlistDocumentBaseName(doc: ShortlistDocument): string {
  return doc.serial.replace(/[^\w-]+/g, "-");
}

export { embedShortlistDocumentAvatars } from "./shortlist-export-avatars";
