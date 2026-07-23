import { OBJECTIVE_DELIVERABLE_AFFINITY } from "./config";
import { objectiveKey } from "./creator-mix";
import type { CampaignPlanningInput, DeliverableStrategy } from "./types";
import type { PlatformStrategy } from "./types";

const DELIVERABLE_LABELS: Record<string, string> = {
  instagram_reel: "Reels",
  instagram_story: "Stories",
  instagram_post: "Posts",
  tiktok_video: "TikTok Videos",
  youtube_short: "YouTube Shorts",
  youtube_integration: "YouTube Integrations",
};

export function buildDeliverableStrategy(
  input: CampaignPlanningInput,
  platformStrategy: PlatformStrategy
): DeliverableStrategy {
  const objective = objectiveKey(input.brief.objective);
  const affinity = OBJECTIVE_DELIVERABLE_AFFINITY[objective] ?? OBJECTIVE_DELIVERABLE_AFFINITY.awareness;
  const durationWeeks = input.brief.durationWeeks ?? 8;
  const creatorCount = Math.max(4, Math.round(durationWeeks * 0.8));

  const mix = affinity.slice(0, 4).map((contentType, index) => {
    const platform =
      contentType.startsWith("tiktok")
        ? "tiktok"
        : contentType.startsWith("youtube")
          ? "youtube"
          : platformStrategy.primaryPlatform;
    const quantity = Math.max(1, Math.round(creatorCount / (index + 1.5)));
    return {
      contentType,
      platform,
      quantity,
      sequenceOrder: index + 1,
      reasoning: [
        `${DELIVERABLE_LABELS[contentType] ?? contentType} aligned to ${objective} objective.`,
        index === 0 ? "Hero format in wave 1." : "Supporting format for sustained cadence.",
      ],
    };
  });

  return {
    mix,
    contentMixSummary: mix
      .map((item) => `${item.quantity}× ${DELIVERABLE_LABELS[item.contentType] ?? item.contentType}`)
      .join(", "),
    recommendations: mix.map((item) => ({
      label: DELIVERABLE_LABELS[item.contentType] ?? item.contentType,
      value: `${item.quantity} on ${item.platform}`,
      reasoning: item.reasoning,
      influencedBy: [input.brief.objective ?? "awareness"],
      constraintsApplied: input.brief.deliverables ?? [],
      principlesUsed: ["Forecast deliverable decay curves", "Optimization deliverable mix analysis"],
    })),
  };
}
