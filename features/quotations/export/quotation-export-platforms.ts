/**
 * Server-only: attach per-account platform metrics from unified creators.
 * Engagement rates use the same Discovery resolver so PPTX matches Search/shortlist.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { sortPlatformsStable } from "@/lib/creators/creator-centric";
import { resolvePlatformEngagementRate } from "@/lib/creators/profile-engagement-rate";
import {
  resolveCreatorFromRefLookup,
  resolveUnifiedCreatorsByRefs,
} from "@/lib/creators/unified-browse";
import { isUsableAvatarUrl } from "@/lib/performance/avatar-sync-policy";
import type { Database } from "@/types/database";

import { resolveExportItemAllPlatforms } from "./quotation-export-platform-metrics";
import type {
  QuotationExportItem,
  QuotationExportPlatformAccount,
} from "./quotation-export-utils";

export type { QuotationExportPlatformAccount };
export {
  buildExportPlatformMetricRows,
  resolveExportGroupAllPlatforms,
  resolveExportItemAllPlatforms,
} from "./quotation-export-platform-metrics";

const AVATAR_PLATFORM_PRIORITY = ["instagram", "tiktok", "youtube", "facebook", "snapchat"];

function pickBestPlatformAvatar(
  accounts: QuotationExportPlatformAccount[]
): string | null {
  const ranked = [...accounts].sort((left, right) => {
    const li = AVATAR_PLATFORM_PRIORITY.indexOf(left.platform);
    const ri = AVATAR_PLATFORM_PRIORITY.indexOf(right.platform);
    return (li < 0 ? 99 : li) - (ri < 0 ? 99 : ri);
  });
  for (const account of ranked) {
    const url = account.avatar_url?.trim();
    if (url && isUsableAvatarUrl(url)) return url;
  }
  return null;
}

/**
 * Attach per-account platform metrics from unified creators for export decks.
 * Always runs so mix/roster/creator slides show all networks with Discovery-matched ER
 * and platform CDN avatars.
 */
export async function attachExportPlatformAccounts(
  supabase: SupabaseClient<Database>,
  items: QuotationExportItem[]
): Promise<QuotationExportItem[]> {
  if (items.length === 0) return items;

  const lookup = await resolveUnifiedCreatorsByRefs(supabase, {
    unifiedIds: items.map((item) => item.unified_id),
    influencerIds: items.map((item) => item.influencer_id),
    discoveredProfileIds: items.map((item) => item.profile_id),
  });

  return items.map((item) => {
    const creator = resolveCreatorFromRefLookup(lookup, {
      unified_id: item.unified_id,
      influencer_id: item.influencer_id,
      profile_id: item.profile_id,
    });

    const export_platforms: QuotationExportPlatformAccount[] = (creator?.platforms ?? []).map(
      (account) => {
        const platform = canonicalPlatformKey(account.platform);
        // Same ER path as Discovery browse — recompute from avgs/posts when possible.
        const engagement_rate = resolvePlatformEngagementRate({
          engagement_rate: account.engagement_rate,
          avg_likes: account.avg_likes,
          avg_comments: account.avg_comments,
          follower_count: account.follower_count,
          recent_publications: account.recent_publications,
        });
        const avatar_url =
          account.profile_picture_url?.trim() &&
          isUsableAvatarUrl(account.profile_picture_url)
            ? account.profile_picture_url.trim()
            : null;

        return {
          platform,
          handle: account.handle ?? null,
          followers: account.follower_count ?? null,
          engagement_rate,
          avg_views: account.avg_views ?? null,
          profile_url: account.profile_url ?? null,
          avatar_url,
        };
      }
    );

    if (!export_platforms.length) {
      const fallback = resolveExportItemAllPlatforms(item);
      return {
        ...item,
        export_platforms: fallback.map((platform) => ({
          platform,
          handle: item.handle ?? null,
          followers: item.followers,
          engagement_rate: item.engagement_rate,
          avg_views: item.avg_views ?? null,
          profile_url: item.profile_url ?? null,
          avatar_url:
            item.profile_image_url?.trim() && isUsableAvatarUrl(item.profile_image_url)
              ? item.profile_image_url.trim()
              : null,
        })),
      };
    }

    const linkedPlatforms = sortPlatformsStable(
      export_platforms.map((row) => ({ platform: row.platform }))
    ).map((entry) => entry.platform);

    const platformAvatar = pickBestPlatformAvatar(export_platforms);
    const primaryPlatform =
      (item.platform ? canonicalPlatformKey(item.platform) : null) ??
      linkedPlatforms[0] ??
      null;
    const primaryAccount =
      (primaryPlatform
        ? export_platforms.find((row) => row.platform === primaryPlatform)
        : null) ?? export_platforms[0]!;

    return {
      ...item,
      // Prefer Discovery-matched platform ER for mix / roster / group headers.
      engagement_rate: primaryAccount.engagement_rate ?? item.engagement_rate,
      followers: primaryAccount.followers ?? item.followers,
      avg_views: primaryAccount.avg_views ?? item.avg_views ?? null,
      // Prefer live platform CDN avatar over stale Thinkway-stored snapshots.
      profile_image_url: platformAvatar ?? item.profile_image_url ?? null,
      export_platforms,
      creator_profile_source: item.creator_profile_source
        ? {
            ...item.creator_profile_source,
            linkedPlatforms:
              linkedPlatforms.length > 0
                ? linkedPlatforms
                : item.creator_profile_source.linkedPlatforms,
            avatarUrl: platformAvatar ?? item.creator_profile_source.avatarUrl,
            profile_url:
              primaryAccount.profile_url ??
              item.creator_profile_source.profile_url ??
              item.profile_url ??
              null,
          }
        : item.creator_profile_source,
    };
  });
}
