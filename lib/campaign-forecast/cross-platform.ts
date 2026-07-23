import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";

import { CROSS_PLATFORM_OVERLAP_RATE } from "./config";
import type { CampaignForecastDeliverableInput } from "./types";

export type CrossPlatformAdjustment = {
  grossReach: number;
  overlapDeduction: number;
  netReach: number;
  platforms: string[];
  explanation: string[];
};

function platformKeys(deliverables: CampaignForecastDeliverableInput[]): string[] {
  return [
    ...new Set(
      deliverables
        .map((item) => canonicalPlatformKey(item.platform ?? ""))
        .filter(Boolean)
    ),
  ];
}

/**
 * Prevent double-counting when the same creator publishes on multiple platforms.
 * Applies progressive overlap between additional platforms.
 */
export function applyCrossPlatformOverlap(input: {
  deliverableReachByPlatform: Map<string, number>;
  overlapRate?: number;
}): CrossPlatformAdjustment {
  const overlapRate = input.overlapRate ?? CROSS_PLATFORM_OVERLAP_RATE;
  const platforms = [...input.deliverableReachByPlatform.keys()];
  const reachValues = platforms
    .map((platform) => input.deliverableReachByPlatform.get(platform) ?? 0)
    .sort((a, b) => b - a);

  const grossReach = reachValues.reduce((sum, value) => sum + value, 0);
  if (reachValues.length <= 1) {
    return {
      grossReach,
      overlapDeduction: 0,
      netReach: grossReach,
      platforms,
      explanation: ["Single-platform creator — no cross-platform overlap applied."],
    };
  }

  let netReach = reachValues[0] ?? 0;
  let overlapDeduction = 0;
  const explanation = [`Cross-platform reach (${platforms.join(", ")}):`];

  for (let index = 1; index < reachValues.length; index++) {
    const incremental = (reachValues[index] ?? 0) * (1 - overlapRate);
    overlapDeduction += (reachValues[index] ?? 0) - incremental;
    netReach += incremental;
    explanation.push(
      `  Platform ${index + 1}: ${Math.round(reachValues[index] ?? 0).toLocaleString()} × ${Math.round((1 - overlapRate) * 100)}% incremental = ${Math.round(incremental).toLocaleString()}.`
    );
  }

  explanation.push(
    `Cross-platform overlap deduction: ${Math.round(overlapDeduction).toLocaleString()} (${Math.round(overlapRate * 100)}% assumed audience overlap).`
  );

  return {
    grossReach,
    overlapDeduction: Math.round(overlapDeduction),
    netReach: Math.round(netReach),
    platforms,
    explanation,
  };
}

export function aggregateDeliverablesByPlatform(
  deliverables: Array<{ platform: string; estimatedReach: number }>
): Map<string, number> {
  const byPlatform = new Map<string, number>();
  for (const item of deliverables) {
    const key = canonicalPlatformKey(item.platform) || item.platform;
    byPlatform.set(key, (byPlatform.get(key) ?? 0) + item.estimatedReach);
  }
  return byPlatform;
}

export { platformKeys };
