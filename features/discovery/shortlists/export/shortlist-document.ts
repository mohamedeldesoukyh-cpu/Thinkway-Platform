import { creatorProfileSourceFromUnified } from "@/lib/creators/creator-profile-source";
import {
  brandSafetyMeta,
  formatCreatorCount,
  formatEngagementRate,
  normalizeCountryCode,
} from "@/features/discovery/components/creator-search/creator-search-utils";
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
import { fetchCreatorAvatarImage } from "@/lib/creators/creator-avatar-proxy";
import { detectImageContentType } from "@/lib/performance/screenshot-capture/storage";
import { embedReportImageDataUri } from "@/lib/performance/report/report-embed-images";
import type { UnifiedCreatorResult } from "@/lib/creators/types";

import { isShowcaseTemplate } from "./shortlist-template";

import {
  SHORTLIST_ITEM_STATUS_LABELS,
  SHORTLIST_STATUS_LABELS,
  SHORTLIST_VISIBILITY_LABELS,
} from "../constants";
import type { ShortlistCreatorItem, ShortlistDetail } from "../types";
import type { ShortlistTemplateVariant } from "./shortlist-template";

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
  profileUrl: string | null;
  platformLinks: ShortlistPlatformLink[];
  followers: string;
  engagementRate: string;
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
  totalFollowers: number;
  totalFollowersLabel: string;
  avgEngagementRate: number | null;
  avgEngagementRateLabel: string;
  platformBreakdown: ShortlistSummaryBreakdownItem[];
  countryBreakdown: ShortlistSummaryBreakdownItem[];
  categoryBreakdown: ShortlistSummaryBreakdownItem[];
  avgMatchScore: number | null;
  avgMatchScoreLabel: string;
  brandSafetyBreakdown: ShortlistSummaryBreakdownItem[];
  statusBreakdown: ShortlistSummaryBreakdownItem[];
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
  template: ShortlistTemplateVariant
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

    const country =
      normalizeCountryCode(creator.country_code) ?? creator.country_code ?? null;
    incrementBreakdown(countryMap, country);

    for (const category of creatorStoredCategoriesForDisplay(creator).slice(0, 3)) {
      incrementBreakdown(categoryMap, category);
    }

    if (template === "detailed") {
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

  return {
    creatorKey,
    rank: row.rank,
    creator: row.creator,
    handle: row.handle,
    avatarUrl: row.avatarUrl,
    avatarProfileUrl: row.avatarProfileUrl,
    profileUrl,
    platformLinks: row.platformLinks,
    followers: row.followers,
    engagementRate: row.engagementRate,
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
  const country = normalizeCountryCode(creator.country_code) ?? creator.country_code ?? "—";
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
  publicationShotsByCreatorKey?: Map<string, ShortlistDocPublicationShot[]>;
};

export function buildShortlistDocument(
  detail: ShortlistDetail,
  options: BuildShortlistDocumentOptions = {}
): ShortlistDocument {
  const template = options.template ?? "summary";
  const itemIdSet =
    options.itemIds && options.itemIds.length > 0 ? new Set(options.itemIds) : null;

  const items = itemIdSet
    ? detail.creators.filter((item) => itemIdSet.has(item.item_id))
    : detail.creators;

  const rows = items
    .map((item, index) => buildRow(item, index + 1))
    .filter((row): row is ShortlistDocRow => row != null);

  const publicationShotsByCreatorKey = isShowcaseTemplate(template)
    ? options.publicationShotsByCreatorKey
    : undefined;

  const creatorGroups = isShowcaseTemplate(template)
    ? items
        .map((item, index) =>
          buildCreatorGroup(item, index + 1, publicationShotsByCreatorKey)
        )
        .filter((group): group is ShortlistDocCreatorGroup => group != null)
    : [];

  const generatedAt = new Date();
  const summaryTemplate = template === "showcase" ? "summary" : template;
  const summary = computeShortlistSummary(items, summaryTemplate);

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
    creatorCount: rows.length,
    generatedAt,
    generatedDateLabel: formatShortlistDateLabel(generatedAt),
    summary,
    rows,
    creatorGroups,
  };
}

export function shortlistDocumentBaseName(doc: ShortlistDocument): string {
  return doc.serial.replace(/[^\w-]+/g, "-");
}

async function embedShortlistAvatarDataUri(
  src: string | null,
  profileUrl: string | null
): Promise<string | null> {
  const trimmedSrc = src?.trim() || null;
  const trimmedProfile = profileUrl?.trim() || null;
  if (!trimmedSrc && !trimmedProfile) return null;
  if (trimmedSrc?.startsWith("data:")) return trimmedSrc;

  const result = await fetchCreatorAvatarImage({
    src: trimmedSrc,
    profileUrl: trimmedProfile,
  });

  if (result.ok) {
    const buffer = Buffer.from(result.buffer);
    const contentType =
      result.contentType || detectImageContentType(buffer);
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  }

  if (trimmedSrc) {
    const embedded = await embedReportImageDataUri(trimmedSrc);
    return embedded?.startsWith("data:") ? embedded : null;
  }

  return null;
}

/** Embed avatars as data URIs so preview iframe and PDF/Word exports render profile images. */
export async function embedShortlistDocumentAvatars(
  doc: ShortlistDocument
): Promise<ShortlistDocument> {
  const rows = await Promise.all(
    doc.rows.map(async (row) => ({
      ...row,
      avatarUrl: await embedShortlistAvatarDataUri(row.avatarUrl, row.avatarProfileUrl),
    }))
  );

  const creatorGroups = doc.creatorGroups?.length
    ? await Promise.all(
        doc.creatorGroups.map(async (group) => ({
          ...group,
          avatarUrl: await embedShortlistAvatarDataUri(
            group.avatarUrl,
            group.avatarProfileUrl
          ),
        }))
      )
    : doc.creatorGroups;

  return { ...doc, rows, creatorGroups };
}
