/**
 * Pure helpers — platform presence + metric rows for quotation export decks.
 */
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { sortPlatformsStable } from "@/lib/creators/creator-centric";
import {
  formatQuotationCardFollowers,
  formatQuotationEngagementRate,
  formatQuotationFullNumber,
} from "@/features/quotations/templates/quotation-template-format";
import { resolveCreatorProfileUrl } from "@/lib/discovery/profile-url";
import { unionQuotationCreatorGroupPlatforms } from "@/lib/quotations/quotation-creator-platform-utils";

import type {
  QuotationExportItem,
  QuotationExportPlatformAccount,
} from "./quotation-export-utils";
import { exportItemPlatformIcons } from "./quotation-export-utils";

export type QuotationExportPlatformMetricRow = {
  platform: string;
  followers: string;
  engagement: string;
  views: string;
  profileUrl: string | null;
  avatarUrl: string | null;
};

function formatFollowersLabel(value: number | null | undefined): string {
  return formatQuotationCardFollowers(value);
}

function formatErLabel(value: number | null | undefined): string {
  return formatQuotationEngagementRate(value);
}

function formatViewsLabel(value: number | null | undefined): string {
  return formatQuotationFullNumber(value);
}

/** Union deliverable platforms + linked accounts + export_platforms. */
export function resolveExportItemAllPlatforms(item: QuotationExportItem): string[] {
  const fromDeliverables = exportItemPlatformIcons(item).platformIcons;
  const fromExport = (item.export_platforms ?? []).map((row) => row.platform);
  const fromLinked = item.creator_profile_source?.linkedPlatforms ?? [];
  return sortPlatformsStable(
    [
      ...new Set(
        [...fromDeliverables, ...fromExport, ...fromLinked, item.platform].filter(Boolean)
      ),
    ].map((platform) => ({ platform: canonicalPlatformKey(platform!) }))
  ).map((entry) => entry.platform);
}

export function resolveExportGroupAllPlatforms(items: QuotationExportItem[]): string[] {
  const fromUnion = unionQuotationCreatorGroupPlatforms(items);
  const fromExport = items.flatMap((item) =>
    (item.export_platforms ?? []).map((row) => row.platform)
  );
  return sortPlatformsStable(
    [...new Set([...fromUnion, ...fromExport])].map((platform) => ({
      platform: canonicalPlatformKey(platform),
    }))
  ).map((entry) => entry.platform);
}

export function buildExportPlatformMetricRows(
  items: QuotationExportItem[]
): QuotationExportPlatformMetricRow[] {
  const byPlatform = new Map<string, QuotationExportPlatformAccount>();
  for (const item of items) {
    for (const account of item.export_platforms ?? []) {
      const key = canonicalPlatformKey(account.platform);
      if (!key || byPlatform.has(key)) continue;
      byPlatform.set(key, { ...account, platform: key });
    }
  }

  const platforms = resolveExportGroupAllPlatforms(items);
  if (!platforms.length && byPlatform.size) {
    platforms.push(...byPlatform.keys());
  }

  return platforms.map((platform) => {
    const account = byPlatform.get(platform);
    const lineMatch = items.find(
      (item) => canonicalPlatformKey(item.platform ?? "") === platform
    );
    return {
      platform,
      followers: formatFollowersLabel(account?.followers ?? lineMatch?.followers ?? null),
      engagement: formatErLabel(
        account?.engagement_rate ?? lineMatch?.engagement_rate ?? null
      ),
      views: formatViewsLabel(account?.avg_views ?? lineMatch?.avg_views ?? null),
      profileUrl:
        account?.profile_url ??
        lineMatch?.profile_url ??
        resolveCreatorProfileUrl({
          platform,
          handle: account?.handle ?? lineMatch?.handle ?? items[0]?.handle,
          profile_url: account?.profile_url ?? lineMatch?.profile_url,
        }),
      avatarUrl: account?.avatar_url ?? null,
    };
  });
}
