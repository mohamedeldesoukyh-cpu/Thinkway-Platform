/**
 * Canonical creator profile metric definitions (Discovery / enrichment / creator detail).
 * Keep UI labels and help text aligned with these semantics.
 */

import type { CreatorRecentPublication } from "@/lib/domains/creator/types";

export const CREATOR_METRIC_DEFINITIONS = {
  avg_engagements:
    "Average number of interactions (likes, comments, shares, saves etc) per one published post.",
  avg_likes: "Average number of likes per post.",
  avg_reels_plays: "The average sum of reels plays on the last 30 posts.",
} as const;

export type CreatorMetricDefinitionKey = keyof typeof CREATOR_METRIC_DEFINITIONS;

/** Max posts used for profile averages (Avg. Likes / Engagements / Reels Plays). */
export const CREATOR_METRIC_SAMPLE_LIMIT = 30;

export type PublicationEngagementParts = {
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  views?: number | null;
  isVideo?: boolean | null;
};

function finiteNonNegative(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value) && value >= 0;
}

/** Interactions on one post — shares/saves included when present. */
export function publicationEngagements(parts: PublicationEngagementParts): number | null {
  const likes = finiteNonNegative(parts.likes) ? parts.likes : 0;
  const comments = finiteNonNegative(parts.comments) ? parts.comments : 0;
  const shares = finiteNonNegative(parts.shares) ? parts.shares : 0;
  const saves = finiteNonNegative(parts.saves) ? parts.saves : 0;
  const hasAny =
    finiteNonNegative(parts.likes) ||
    finiteNonNegative(parts.comments) ||
    finiteNonNegative(parts.shares) ||
    finiteNonNegative(parts.saves);
  if (!hasAny) return null;
  return likes + comments + shares + saves;
}

function averageOf(values: number[]): number | null {
  if (values.length === 0) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

/**
 * Avg. Engagements from recent posts (up to last 30).
 * Falls back to avg_likes + avg_comments when post-level rows are unavailable.
 */
export function resolveAvgEngagements(input: {
  publications?: Array<PublicationEngagementParts> | null;
  avgLikes?: number | null;
  avgComments?: number | null;
}): number | null {
  const sample = (input.publications ?? []).slice(0, CREATOR_METRIC_SAMPLE_LIMIT);
  const fromPosts = averageOf(
    sample
      .map((post) => publicationEngagements(post))
      .filter((value): value is number => value != null)
  );
  if (fromPosts != null) return fromPosts;

  const likes = finiteNonNegative(input.avgLikes) ? input.avgLikes : null;
  const comments = finiteNonNegative(input.avgComments) ? input.avgComments : null;
  if (likes == null && comments == null) return null;
  return Number(((likes ?? 0) + (comments ?? 0)).toFixed(2));
}

/** Avg. Likes from recent posts (up to last 30), else stored average. */
export function resolveAvgLikes(input: {
  publications?: Array<Pick<PublicationEngagementParts, "likes">> | null;
  avgLikes?: number | null;
}): number | null {
  const sample = (input.publications ?? []).slice(0, CREATOR_METRIC_SAMPLE_LIMIT);
  const fromPosts = averageOf(
    sample.map((post) => post.likes).filter((value): value is number => finiteNonNegative(value))
  );
  if (fromPosts != null) return Math.round(fromPosts);
  return finiteNonNegative(input.avgLikes) ? Math.round(input.avgLikes) : null;
}

/**
 * Avg. Reels Plays — mean play/view count across reel/video posts in the last 30 posts.
 * Non-video posts are excluded from the average (not counted as zero).
 */
export function resolveAvgReelsPlays(input: {
  publications?: Array<Pick<PublicationEngagementParts, "views" | "isVideo">> | null;
  reelsViewsAvg?: number | null;
}): number | null {
  const sample = (input.publications ?? []).slice(0, CREATOR_METRIC_SAMPLE_LIMIT);
  const reelPlays = sample
    .filter((post) => post.isVideo === true)
    .map((post) => post.views)
    .filter((value): value is number => finiteNonNegative(value));
  const fromPosts = averageOf(reelPlays);
  if (fromPosts != null) return Math.round(fromPosts);
  return finiteNonNegative(input.reelsViewsAvg) ? Math.round(input.reelsViewsAvg) : null;
}

export function resolveCreatorEngagementMetricBundle(input: {
  publications?: CreatorRecentPublication[] | null;
  avgLikes?: number | null;
  avgComments?: number | null;
  reelsViewsAvg?: number | null;
}): {
  avgEngagements: number | null;
  avgLikes: number | null;
  avgReelsPlays: number | null;
} {
  return {
    avgEngagements: resolveAvgEngagements(input),
    avgLikes: resolveAvgLikes(input),
    avgReelsPlays: resolveAvgReelsPlays(input),
  };
}

/**
 * Product feasibility for Modash-style Credibility Score inputs.
 * Not a score engine — guidance for Product / Architecture only.
 */
export const CREDIBILITY_SCORE_FEASIBILITY = {
  audienceTypes: {
    canApply: false,
    reason:
      "Requires follower-level classification (Influencers / Suspicious / Real / Mass followers). Apify profile enrichment does not provide follower audience composition. Enterprise Creator Intelligence forbids fake-follower estimation without a demographics provider.",
  },
  audienceReachability: {
    canApply: false,
    reason:
      "Requires distribution of how many accounts each follower follows. Not available from public profile scrapes; needs a paid audience provider (e.g. Modash / HypeAuditor).",
  },
  locationByCity: {
    canApplyPartial: true,
    canApplyFully: false,
    reason:
      "ECI audience geography already supports city slices when demographic_source is present. Creator-level city/country from bio/enrichment exists, but follower location-by-city from tags/language/bio of the audience requires a demographics provider — not inventable from Apify alone.",
  },
  audienceBrandAffinity: {
    canApplyPartial: true,
    canApplyFully: false,
    reason:
      "ECI Brand Affinity scores creator↔brand collaboration patterns (mentions / partnerships), not the % of audience that follows or engages with a brand. Audience brand affinity needs follower-graph / engagement analysis from a demographics provider.",
  },
  overallCredibilityScore: {
    canApply: false,
    reason:
      "Cannot ship a Credibility Score on Audience Types + Reachability + City + Audience Brand Affinity without a follower-audience data source. Do not approximate with Discovery authenticity heuristics — that would invent audience composition.",
  },
} as const;
