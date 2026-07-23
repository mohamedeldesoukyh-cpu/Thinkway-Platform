import {
  fetchApifyProfileRaw,
  normalizeApifyProfileData,
} from "@/lib/creator-enrichment/apify-profile";
import type { ApifyProfileData } from "@/lib/creator-enrichment/types";
import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";

export type ApifyImportRowBundle = {
  profileRows: Record<string, unknown>[];
  postRows: Record<string, unknown>[];
  apifyRunId: string | null;
  normalized: ApifyProfileData | null;
};

/**
 * Instagram hashtag / post-only exports need a profile-details scrape for
 * followers and audience country before commercial enrichment can complete.
 */
export function shouldBackfillInstagramProfileDetails(
  platform: string,
  profileRows: Record<string, unknown>[],
  postRows: Record<string, unknown>[],
  normalized: ApifyProfileData | null
): boolean {
  if (canonicalPlatformKey(platform) !== "instagram") return false;
  if (profileRows.length > 0) return false;
  if (postRows.length === 0) return false;

  const missingFollowers =
    normalized?.followers == null || normalized.followers <= 0;
  const missingCountry = !normalized?.audienceCountry?.trim();

  return missingFollowers || missingCountry;
}

/**
 * Fetch Instagram profile details (resultsType=details) when import rows are post-only.
 * Keeps hashtag post rows for view/ER metrics while adding follower_count from profile scrape.
 */
export async function backfillInstagramProfileRowsForImport(input: {
  platform: string;
  username: string;
  profileUrl: string;
  postRows: Record<string, unknown>[];
  apifyRunId?: string | null;
}): Promise<ApifyImportRowBundle | null> {
  const backfill = await fetchApifyProfileRaw({
    platform: input.platform,
    username: input.username,
    profileUrl: input.profileUrl,
    // Never launch a second Instagram posts actor during backfill.
    includePosts: false,
  });

  if (!backfill.ok || backfill.profileRows.length === 0) {
    return null;
  }

  const profileRows = backfill.profileRows;
  const postRows =
    input.postRows.length > 0
      ? input.postRows
      : backfill.postRows.length > 0
        ? backfill.postRows
        : input.postRows;

  const normalized = normalizeApifyProfileData({
    platformKey: input.platform,
    username: input.username,
    profileUrl: input.profileUrl,
    profileRows,
    postRows,
    apifyRunId: backfill.apifyRunId ?? input.apifyRunId ?? null,
  });

  return {
    profileRows,
    postRows,
    apifyRunId: backfill.apifyRunId ?? input.apifyRunId ?? null,
    normalized,
  };
}
