/**
 * Export-only helpers — grouping, labels, and field mapping for quotation templates.
 * Does not affect the quotation workspace UI.
 */
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { resolveCreatorTierLabel } from "@/lib/creators/creator-tier";
import { resolveQuotationCreatorDisplayCategories } from "@/lib/quotations/quotation-creator-categories";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { resolveCreatorProfileUrl } from "@/lib/discovery/profile-url";
import { parseProfileInput } from "@/lib/social/parse-profile-url";
import { isSocialPlatform } from "@/lib/social/platforms";
import type { QuotationDeliverable } from "@/lib/domains/commercial/quotation-types";
import { buildQuotationCreatorProfileSource } from "@/lib/quotations/quotation-creator-source";
import { isUsableAvatarUrl } from "@/lib/performance/avatar-sync-policy";
import {
  deliverableTypeValues,
  platformsFromSelectedPostTypes,
  quotationPostTypeLabel,
  typeLinesIncludeAllPlatforms,
} from "@/lib/quotations/quotation-deliverable-types";
import type { QuotationItemRow } from "@/features/quotations/types";

export type QuotationExportPlatformAccount = {
  platform: string;
  handle: string | null;
  followers: number | null;
  engagement_rate: number | null;
  avg_views: number | null;
  profile_url: string | null;
  /** Live platform CDN avatar (Instagram/TikTok profile picture). */
  avatar_url: string | null;
};

export type QuotationExportItem = QuotationItemRow & {
  profile_image_url?: string | null;
  profile_url?: string | null;
  option_number?: number | null;
  /** Average views from platform account enrichment (export-only). */
  avg_views?: number | null;
  /** All linked platform accounts with metrics (export-only). */
  export_platforms?: QuotationExportPlatformAccount[];
};

type DeliverableJson = QuotationDeliverable &
  Record<string, unknown> & {
    service_description?: string | null;
    type_lines?: Array<{ type: string; quantity: number }> | null;
    types?: string[] | null;
  };

const POST_TYPE_LABELS: Record<string, string> = {
  video: "Video",
  stories: "Stories",
  instagram_post: "IG Post",
  instagram_story: "IG Story",
  instagram_reel: "IG Reel",
  tiktok_video: "TT Video",
  tiktok_photo_post: "TikTok Photo Post",
  tiktok_live: "TikTok LIVE",
  tiktok_story: "TikTok Story",
  facebook_post: "FB Post",
  facebook_reel: "FB Reel",
  ugc: "UGC",
  cross_posting: "Cross-Posting",
  all_platforms: "All Platforms",
  visit: "Visit",
  event_coverage: "Event Coverage",
};

function postTypeLabel(code: string): string {
  const trimmed = code.trim();
  if (!trimmed) return "";
  return POST_TYPE_LABELS[trimmed] ?? quotationPostTypeLabel(trimmed);
}

export function quotationCreatorDuplicateKey(
  item: Pick<
    QuotationItemRow,
    "id" | "unified_id" | "influencer_id" | "profile_id" | "creator_name" | "handle"
  >
): string {
  if (item.unified_id) return `u:${item.unified_id}`;
  if (item.influencer_id) return `i:${item.influencer_id}`;
  if (item.profile_id) return `p:${item.profile_id}`;
  const name = item.creator_name?.trim().toLowerCase() ?? "";
  const handle = item.handle?.trim().toLowerCase().replace(/^@/, "") ?? "";
  if (name || handle) return `n:${name}|${handle}`;
  return `id:${item.id}`;
}

export function countUniqueQuotationCreators(items: QuotationItemRow[]): number {
  return new Set(items.map((item) => quotationCreatorDuplicateKey(item))).size;
}

export type QuotationExportCreatorGroup = {
  creatorKey: string;
  items: QuotationExportItem[];
};

export function groupQuotationExportItems(
  items: QuotationExportItem[]
): QuotationExportCreatorGroup[] {
  const sorted = [...items].sort((a, b) => a.sort_order - b.sort_order);
  const byCreator = new Map<string, QuotationExportItem[]>();

  for (const item of sorted) {
    const key = quotationCreatorDuplicateKey(item);
    const bucket = byCreator.get(key) ?? [];
    bucket.push(item);
    byCreator.set(key, bucket);
  }

  const groups: QuotationExportCreatorGroup[] = [];
  const seen = new Set<string>();

  for (const item of sorted) {
    const creatorKey = quotationCreatorDuplicateKey(item);
    if (seen.has(creatorKey)) continue;
    seen.add(creatorKey);

    const creatorItems = [...(byCreator.get(creatorKey) ?? [])].sort(
      (a, b) => a.sort_order - b.sort_order
    );

    creatorItems.forEach((row, index) => {
      if (row.option_number == null || row.option_number < 1) {
        row.option_number = index + 1;
      }
    });

    groups.push({ creatorKey, items: creatorItems });
  }

  return groups;
}

export function optionNumberLabel(optionNumber: number | null | undefined): string {
  if (optionNumber == null || !Number.isFinite(optionNumber) || optionNumber < 1) {
    return "Option 1";
  }
  return `Option ${Math.floor(optionNumber)}`;
}

export function formatCreatorHandle(handle: string | null | undefined): string {
  const trimmed = handle?.trim();
  if (!trimmed) return "—";
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

/** Stored influencer categories for export (max 3 tags, with DNA fallback). */
export function quotationCreatorCategoriesFromUnified(
  creator: Pick<
    UnifiedCreatorResult,
    | "browse_category_tags"
    | "categories"
    | "ai_category"
    | "ai_niche"
    | "audience_interests"
    | "bio"
    | "hashtags"
    | "mentions"
    | "platforms"
    | "display_name"
  >,
  profile?: {
    creatorName?: string | null;
    handle?: string | null;
  }
): string[] {
  return resolveQuotationCreatorDisplayCategories({ creator, ...profile });
}

/** Resolve display categories for an export line (same pipeline as enrichment). */
export function resolveExportItemCreatorCategories(item: QuotationExportItem): string[] {
  return resolveQuotationCreatorDisplayCategories({
    itemCategories: item.creator_categories,
    creatorName: item.creator_name,
    handle: item.handle,
    linePlatform: item.platform,
    followers: item.followers,
    countryCode: item.country_code,
  });
}

export function formatQuotationCreatorCategories(
  categories: string[] | null | undefined
): string {
  const list = (categories ?? []).map((value) => value.trim()).filter(Boolean);
  return list.length ? list.join(", ") : "—";
}

function deliverableTypeLines(deliverable: DeliverableJson): Array<{ type: string; quantity: number }> {
  const fromLines = (deliverable.type_lines ?? []).filter(
    (line): line is { type: string; quantity: number } => Boolean(line?.type)
  );
  if (fromLines.length > 0) {
    return fromLines.map((line) => ({
      type: line.type.trim(),
      quantity: Math.max(1, Math.floor(Number(line.quantity) || 1)),
    }));
  }

  const types = (deliverable.types ?? []).filter((value) => value.trim());
  if (types.length > 0) {
    return types.map((type) => ({ type: type.trim(), quantity: 1 }));
  }

  const single = deliverable.type?.trim();
  return single ? [{ type: single, quantity: Math.max(1, deliverable.quantity || 1) }] : [];
}

export function exportDeliverableTypeLabel(deliverable: DeliverableJson): string {
  const lines = deliverableTypeLines(deliverable).filter((line) => line.type);
  if (!lines.length) return "—";
  return lines
    .map((line) => `${line.quantity}× ${postTypeLabel(line.type)}`)
    .join(" + ");
}

export function exportItemTypeLabel(item: QuotationExportItem): string {
  const deliverables = (item.deliverables ?? []) as DeliverableJson[];
  if (!deliverables.length) return "—";
  const parts = deliverables
    .map((deliverable) => exportDeliverableTypeLabel(deliverable))
    .filter((label) => label !== "—");
  return parts.length ? parts.join(" + ") : "—";
}

export function exportItemServiceDescription(item: QuotationExportItem): string {
  // Workspace "Service description" column is per-deliverable; prefer that first.
  const deliverables = (item.deliverables ?? []) as DeliverableJson[];
  const fromDeliverables = deliverables
    .map((deliverable) => deliverable.service_description?.trim())
    .filter((value): value is string => Boolean(value));
  if (fromDeliverables.length > 0) {
    return [...new Set(fromDeliverables)].join(" · ");
  }
  // Line-level service description is the fallback SSOT when deliverables omit it.
  const lineLevel = item.service_description?.trim();
  if (lineLevel) return lineLevel;
  return "—";
}

export function exportItemTierLabel(item: QuotationExportItem): string {
  const tier = resolveCreatorTierLabel({ followers: item.followers });
  return tier === "Unknown" ? "—" : tier;
}

export function exportItemPlatformIcons(item: QuotationExportItem): {
  platformIcons: string[];
  allPlatforms: boolean;
} {
  const deliverables = (item.deliverables ?? []) as DeliverableJson[];
  let allPlatforms = false;
  const platformIcons = new Set<string>();
  const allowed = item.platform ? [item.platform] : [];

  for (const deliverable of deliverables) {
    if (typeLinesIncludeAllPlatforms(deliverable)) {
      allPlatforms = true;
      continue;
    }
    const types = deliverableTypeValues(deliverable);
    platformsFromSelectedPostTypes(types, allowed).forEach((platform) =>
      platformIcons.add(canonicalPlatformKey(platform))
    );
    deliverable.platform
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((platform) => platformIcons.add(canonicalPlatformKey(platform)));
  }

  // Include every linked / enriched social account — not only the deliverable platform.
  for (const platform of item.creator_profile_source?.linkedPlatforms ?? []) {
    platformIcons.add(canonicalPlatformKey(platform));
  }
  for (const account of item.export_platforms ?? []) {
    platformIcons.add(canonicalPlatformKey(account.platform));
  }

  if (!platformIcons.size && item.platform) {
    platformIcons.add(canonicalPlatformKey(item.platform));
  }

  return { platformIcons: [...platformIcons], allPlatforms };
}

export function isPositiveExportFollowers(
  followers: number | null | undefined
): followers is number {
  return followers != null && Number.isFinite(followers) && followers > 0;
}

const MENA_COUNTRY_CODES = new Set([
  "EG",
  "SA",
  "AE",
  "KW",
  "QA",
  "BH",
  "OM",
  "JO",
  "LB",
  "IQ",
  "MA",
  "TN",
  "DZ",
  "LY",
  "SD",
  "YE",
  "PS",
  "SY",
]);

function isMenaCountryCode(countryCode: string | null | undefined): boolean {
  const code = countryCode?.trim().toUpperCase();
  if (!code) return true;
  return MENA_COUNTRY_CODES.has(code);
}

function resolvePreferredLinkedPlatform(linkedPlatforms: string[]): string | null {
  const canonical = linkedPlatforms
    .map((platform) => canonicalPlatformKey(platform))
    .filter((platform) => platform !== "unknown" && isSocialPlatform(platform));
  if (canonical.length === 1) return canonical[0]!;
  if (canonical.includes("instagram")) return "instagram";
  return canonical[0] ?? null;
}

function resolveExportPlatformFromProfileUrl(item: QuotationExportItem): string | null {
  const urls = [
    item.profile_url,
    item.creator_profile_source?.profile_url,
    resolveExportCreatorProfile(item).profileUrl,
  ];
  for (const url of urls) {
    if (!url?.trim()) continue;
    const parsed = parseProfileInput(url);
    if (parsed?.platform) return parsed.platform;
  }
  return null;
}

function resolveExportPlatformFromDeliverables(item: QuotationExportItem): string | null {
  const { platformIcons } = exportItemPlatformIcons(item);
  return resolvePreferredLinkedPlatform(platformIcons);
}

/** Platform for export — line item, enriched profile source, or creator profile fallback. */
export function resolveExportItemPlatform(item: QuotationExportItem): string | null {
  const itemPlatform = item.platform?.trim();
  if (itemPlatform) return itemPlatform;

  const sourcePlatform = item.creator_profile_source?.platform?.trim();
  if (sourcePlatform) return sourcePlatform;

  const linkedPlatform = resolvePreferredLinkedPlatform(
    item.creator_profile_source?.linkedPlatforms ?? []
  );
  if (linkedPlatform) return linkedPlatform;

  const fromProfileUrl = resolveExportPlatformFromProfileUrl(item);
  if (fromProfileUrl) return fromProfileUrl;

  const fromDeliverables = resolveExportPlatformFromDeliverables(item);
  if (fromDeliverables) return fromDeliverables;

  const profilePlatform = resolveExportCreatorProfile(item).platform?.trim();
  if (profilePlatform) return profilePlatform;

  const handle = item.handle?.trim().replace(/^@+/, "");
  if (
    handle &&
    isMenaCountryCode(item.country_code ?? item.creator_profile_source?.countryCode)
  ) {
    return "instagram";
  }

  return null;
}

/** Follower count for export — positive line snapshot only. */
export function resolveExportItemFollowers(item: QuotationExportItem): number | null {
  return isPositiveExportFollowers(item.followers) ? item.followers : null;
}

/** Best platform across creator options (first option may lack platform metadata). */
export function resolveExportGroupPlatform(items: QuotationExportItem[]): string | null {
  for (const item of items) {
    const platform = resolveExportItemPlatform(item);
    if (platform) return platform;
  }
  return null;
}

/** Highest follower count across creator options. */
export function resolveExportGroupFollowers(items: QuotationExportItem[]): number | null {
  let best: number | null = null;
  for (const item of items) {
    const followers = resolveExportItemFollowers(item);
    if (followers == null) continue;
    if (best == null || followers > best) best = followers;
  }
  return best;
}

function resolveExportItemAvgViews(item: QuotationExportItem): number | null {
  const value = item.avg_views;
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return value;
}

/** Highest average views across creator options. */
export function resolveExportGroupAvgViews(items: QuotationExportItem[]): number | null {
  let best: number | null = null;
  for (const item of items) {
    const views = resolveExportItemAvgViews(item);
    if (views == null) continue;
    if (best == null || views > best) best = views;
  }
  return best;
}

/** Engagement rate from the option supplying followers, else first finite value. */
export function resolveExportGroupEngagementRate(
  items: QuotationExportItem[],
  followers: number | null
): number | null {
  if (followers != null) {
    const matching = items.find(
      (item) => item.followers === followers && item.engagement_rate != null
    );
    if (matching?.engagement_rate != null && Number.isFinite(matching.engagement_rate)) {
      return matching.engagement_rate;
    }
  }

  for (const item of items) {
    if (item.engagement_rate != null && Number.isFinite(item.engagement_rate)) {
      return item.engagement_rate;
    }
  }
  return null;
}

export function resolveExportCreatorProfile(item: QuotationExportItem) {
  const source = buildQuotationCreatorProfileSource(item);
  const platformAccountUrl = (item.export_platforms ?? [])
    .map((account) =>
      resolveCreatorProfileUrl({
        platform: account.platform,
        handle: account.handle,
        profile_url: account.profile_url,
      })
    )
    .find((url): url is string => Boolean(url?.trim()));
  const profileUrl =
    resolveCreatorProfileUrl(source) ??
    item.profile_url?.trim() ??
    platformAccountUrl ??
    (item.platform && item.handle
      ? resolveCreatorProfileUrl({ platform: item.platform, handle: item.handle })
      : null) ??
    (item.handle
      ? resolveCreatorProfileUrl({
          platform: item.export_platforms?.[0]?.platform ?? "instagram",
          handle: item.handle,
        })
      : null);

  return {
    creator: source.displayName,
    handle: formatCreatorHandle(source.handle ?? item.handle),
    profileUrl,
    avatarUrl:
      source.avatarUrl?.trim() ||
      (item.profile_image_url?.trim() && isUsableAvatarUrl(item.profile_image_url)
        ? item.profile_image_url.trim()
        : null),
    platform: source.platform ?? item.platform ?? null,
    linkedPlatforms: source.linkedPlatforms ?? [],
  };
}
