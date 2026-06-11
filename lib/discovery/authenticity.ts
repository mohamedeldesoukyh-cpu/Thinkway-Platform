/**
 * Heuristic fake-follower / authenticity estimation from public signals.
 * No paid API — ratio spikes, engagement quality proxies.
 */

export type AuthenticityInput = {
  followers: number;
  following: number;
  avgLikes: number | null;
  avgComments: number | null;
  engagementRate: number | null;
  postsCount: number;
  recentEngagementVariance?: number | null;
  repetitiveCommentRatio?: number | null;
};

export type AuthenticityResult = {
  score: number;
  signals: string[];
};

export function estimateAuthenticityScore(input: AuthenticityInput): AuthenticityResult {
  const signals: string[] = [];
  let score = 100;

  const followers = Math.max(input.followers, 1);
  const avgLikes = input.avgLikes ?? 0;
  const avgComments = input.avgComments ?? 0;
  const engagementRate =
    input.engagementRate ??
    ((avgLikes + avgComments) / followers) * 100;

  if (followers > 10_000 && engagementRate < 0.5) {
    score -= 25;
    signals.push("Very low engagement vs follower count");
  } else if (followers > 50_000 && engagementRate < 1) {
    score -= 15;
    signals.push("Below-expected engagement band");
  }

  const followingRatio = input.following / followers;
  if (followers > 5_000 && followingRatio > 1.5) {
    score -= 10;
    signals.push("High following-to-follower ratio");
  }

  if (input.postsCount < 5 && followers > 20_000) {
    score -= 12;
    signals.push("High followers with very few posts");
  }

  if (input.recentEngagementVariance != null && input.recentEngagementVariance > 4) {
    score -= 15;
    signals.push("Suspicious engagement spikes");
  }

  if (input.repetitiveCommentRatio != null && input.repetitiveCommentRatio > 0.35) {
    score -= 18;
    signals.push("Repetitive comment patterns");
  }

  const likeCommentRatio = avgComments > 0 ? avgLikes / avgComments : avgLikes;
  if (avgLikes > 500 && avgComments < 3 && likeCommentRatio > 200) {
    score -= 8;
    signals.push("Bot-like like/comment imbalance");
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score * 100) / 100)),
    signals,
  };
}
