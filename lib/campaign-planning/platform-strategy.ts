import { OBJECTIVE_PLATFORM_AFFINITY, PLATFORM_OPTIONS } from "./config";
import { objectiveKey } from "./creator-mix";
import type { CampaignPlanningInput, PlatformStrategy } from "./types";

function normalizePlatform(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}

export function buildPlatformStrategy(input: CampaignPlanningInput): PlatformStrategy {
  const brief = input.brief;
  const objective = objectiveKey(brief.objective);
  const requested = (brief.platforms ?? []).map(normalizePlatform).filter(Boolean);
  const affinity = OBJECTIVE_PLATFORM_AFFINITY[objective] ?? OBJECTIVE_PLATFORM_AFFINITY.awareness;

  const selected =
    requested.length > 0
      ? requested.filter((p) => PLATFORM_OPTIONS.includes(p as (typeof PLATFORM_OPTIONS)[number]))
      : affinity.slice(0, 3);

  const platforms = selected.length ? selected : ["instagram", "tiktok"];
  const primaryPlatform = platforms[0] ?? "instagram";

  const weights = platforms.map((platform, index) => {
    const base = index === 0 ? 45 : index === 1 ? 35 : 20;
    return Math.max(10, base - (platforms.length - 2) * 5);
  });
  const weightSum = weights.reduce((a, b) => a + b, 0);

  const allocations = platforms.map((platform, index) => ({
    platform,
    budgetPercent: Math.round((weights[index]! / weightSum) * 100),
    creatorPercent: Math.round((weights[index]! / weightSum) * 100),
    reasoning: [
      index === 0
        ? `Primary platform for ${objective} objective.`
        : "Supporting platform for incremental reach and format diversity.",
      requested.length ? "Brief explicitly requested platform." : `Selected from ${objective} objective affinity.`,
    ],
  }));

  return {
    primaryPlatform,
    platforms: allocations,
    recommendations: allocations.map((item) => ({
      label: `${item.platform} allocation`,
      value: `${item.budgetPercent}% budget / ${item.creatorPercent}% creators`,
      reasoning: item.reasoning,
      influencedBy: [brief.objective ?? "awareness", ...(brief.platforms ?? [])],
      constraintsApplied: brief.constraints ?? [],
      principlesUsed: ["Decision Engine platform balance scoring", "Forecast platform reach formulas"],
    })),
  };
}
