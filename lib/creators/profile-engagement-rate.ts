/**
 * Profile-level engagement rate for influencer platform accounts.
 *
 * Formula (Apify / Discovery): ((avg_likes + avg_comments) / followers) * 100
 * Campaign publication ER (views/reach/shares) is a separate engine — do not reuse here.
 *
 * INVARIANT (display-safe, loss-proof): these resolvers are for READ/DISPLAY paths
 * only and must NEVER return null when a stored engagement_rate exists. A better
 * locally-derived value may replace the stored one for display, but the stored
 * value is always the floor. Persist paths must never write these resolved values
 * back over stored data.
 */

export type ProfileEngagementInputs = {
  avgLikes?: number | null;
  avgComments?: number | null;
  followers?: number | null;
};

export type PlatformEngagementSource = {
  engagement_rate?: number | null;
  avg_likes?: number | null;
  avg_comments?: number | null;
  follower_count?: number | null;
  recent_publications?: Array<{
    likes?: number | null;
    comments?: number | null;
  }> | null;
};

function averageOf(values: Array<number | null | undefined>): number | null {
  const nums = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value)
  );
  if (nums.length === 0) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

/** ((avgLikes + avgComments) / followers) * 100, rounded to 3 decimals. */
export function computeProfileEngagementRate(
  input: ProfileEngagementInputs
): number | null {
  const followers = input.followers;
  if (followers == null || !Number.isFinite(followers) || followers <= 0) {
    return null;
  }
  const avgLikes = input.avgLikes;
  const avgComments = input.avgComments;
  if (avgLikes == null && avgComments == null) return null;
  if (avgLikes != null && !Number.isFinite(avgLikes)) return null;
  if (avgComments != null && !Number.isFinite(avgComments)) return null;

  return Number(((((avgLikes ?? 0) + (avgComments ?? 0)) / followers) * 100).toFixed(3));
}

function computeEngagementFromPublications(
  publications: PlatformEngagementSource["recent_publications"],
  followers: number | null | undefined
): number | null {
  if (!publications?.length) return null;
  return computeProfileEngagementRate({
    avgLikes: averageOf(publications.map((pub) => pub.likes)),
    avgComments: averageOf(publications.map((pub) => pub.comments)),
    followers,
  });
}

/**
 * Prefer ER computed from this platform's own averages / recent posts, falling
 * back to the stored ER. Never returns null when a finite stored ER exists —
 * a duplicated / imported stored value is still better than showing nothing.
 */
export function resolvePlatformEngagementRate(
  platform: PlatformEngagementSource
): number | null {
  const derivedFromAvgs = computeProfileEngagementRate({
    avgLikes: platform.avg_likes,
    avgComments: platform.avg_comments,
    followers: platform.follower_count,
  });
  if (derivedFromAvgs != null) return derivedFromAvgs;

  const derivedFromPubs = computeEngagementFromPublications(
    platform.recent_publications,
    platform.follower_count
  );
  if (derivedFromPubs != null) return derivedFromPubs;

  const stored = platform.engagement_rate;
  if (stored == null || !Number.isFinite(stored)) return null;
  return stored;
}

/** Resolve display ER on each platform account. Stored ER is never suppressed to null. */
export function resolvePlatformEngagementRates<T extends PlatformEngagementSource>(
  platforms: T[]
): T[] {
  return platforms.map((platform) => ({
    ...platform,
    engagement_rate: resolvePlatformEngagementRate(platform),
  }));
}
