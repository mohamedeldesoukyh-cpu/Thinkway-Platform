/**
 * Server-only: attach per-account platform metrics from unified creators.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { sortPlatformsStable } from "@/lib/creators/creator-centric";
import {
  resolveCreatorFromRefLookup,
  resolveUnifiedCreatorsByRefs,
} from "@/lib/creators/unified-browse";
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

/**
 * Attach per-account platform metrics from unified creators for export decks.
 * Always runs so mix/roster/creator slides show all networks.
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
      (account) => ({
        platform: canonicalPlatformKey(account.platform),
        handle: account.handle ?? null,
        followers: account.follower_count ?? null,
        engagement_rate: account.engagement_rate ?? null,
        avg_views: account.avg_views ?? null,
        profile_url: account.profile_url ?? null,
      })
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
        })),
      };
    }

    const linkedPlatforms = sortPlatformsStable(
      export_platforms.map((row) => ({ platform: row.platform }))
    ).map((entry) => entry.platform);

    return {
      ...item,
      export_platforms,
      creator_profile_source: item.creator_profile_source
        ? {
            ...item.creator_profile_source,
            linkedPlatforms:
              linkedPlatforms.length > 0
                ? linkedPlatforms
                : item.creator_profile_source.linkedPlatforms,
          }
        : item.creator_profile_source,
    };
  });
}
