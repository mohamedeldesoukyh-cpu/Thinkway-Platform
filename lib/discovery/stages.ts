import type { DiscoveryProfileStage } from "@/lib/discovery/types";

const STAGE_ORDER: DiscoveryProfileStage[] = [
  "discovered",
  "basic_enriched",
  "metrics_enriched",
  "ai_scored",
  "verified",
];

export function nextDiscoveryStage(
  current: DiscoveryProfileStage
): DiscoveryProfileStage | null {
  const idx = STAGE_ORDER.indexOf(current);
  if (idx < 0 || idx >= STAGE_ORDER.length - 1) return null;
  return STAGE_ORDER[idx + 1] ?? null;
}

export function stageAtLeast(
  current: DiscoveryProfileStage,
  target: DiscoveryProfileStage
): boolean {
  return STAGE_ORDER.indexOf(current) >= STAGE_ORDER.indexOf(target);
}

export function refreshTierFromFollowers(followers: number): "top" | "medium" | "inactive" {
  if (followers >= 500_000) return "top";
  if (followers >= 50_000) return "medium";
  return "inactive";
}

export function refreshIntervalDays(tier: "top" | "medium" | "inactive"): number {
  switch (tier) {
    case "top":
      return 1;
    case "medium":
      return 7;
    default:
      return 30;
  }
}
