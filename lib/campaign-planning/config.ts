export const CAMPAIGN_PLANNING_ENGINE_VERSION = "campaign_planning_v1" as const;

export const STRATEGY_SCORE_WEIGHTS = {
  objectiveAlignment: 20,
  budgetEfficiency: 20,
  audienceAlignment: 15,
  platformBalance: 15,
  creatorDiversity: 15,
  timelineFeasibility: 15,
} as const;

export const PLATFORM_OPTIONS = [
  "instagram",
  "tiktok",
  "youtube",
  "facebook",
  "snapchat",
] as const;

export const DEFAULT_DURATION_WEEKS = 8;

export const BUDGET_CREATOR_FEE_SHARE = 0.72;
export const BUDGET_PRODUCTION_SHARE = 0.18;
export const BUDGET_CONTINGENCY_SHARE = 0.1;

export const OBJECTIVE_PLATFORM_AFFINITY: Record<string, string[]> = {
  awareness: ["instagram", "tiktok", "youtube"],
  reach: ["tiktok", "instagram", "youtube"],
  engagement: ["instagram", "tiktok"],
  conversion: ["instagram", "youtube"],
  launch: ["instagram", "tiktok", "youtube"],
  consideration: ["instagram", "youtube"],
};

export const OBJECTIVE_DELIVERABLE_AFFINITY: Record<string, string[]> = {
  awareness: ["instagram_reel", "tiktok_video", "youtube_short"],
  reach: ["instagram_reel", "tiktok_video", "instagram_story"],
  engagement: ["instagram_reel", "instagram_story", "tiktok_video"],
  conversion: ["instagram_reel", "youtube_integration"],
  launch: ["instagram_reel", "tiktok_video", "youtube_short"],
};
