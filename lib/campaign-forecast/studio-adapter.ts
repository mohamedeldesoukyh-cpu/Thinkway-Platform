import type { UnifiedCreatorResult } from "@/lib/creators/types";
import type { GroundedKpi } from "@/features/campaign-intelligence/types/section-schemas";
import type { SearchCreatorCardItem } from "@/features/campaign-studio/services/creator-platform-utils";
import { defaultDeliverableForPlatform } from "./deliverable-forecast";
import { profileToForecastCreatorInput } from "./hydration/profile-to-forecast-input";
import { buildCreatorForecastProfile } from "./profile/profile-builder";
import type { CreatorForecastProfile } from "./profile/types";

import type {
  CampaignForecast,
  CampaignForecastCreatorInput,
  CampaignForecastDeliverableInput,
} from "./types";

export function unifiedCreatorToForecastProfile(
  creator: UnifiedCreatorResult,
  options?: {
    preferredPlatforms?: string[];
    deliverables?: CampaignForecastDeliverableInput[];
  }
): CreatorForecastProfile {
  return buildCreatorForecastProfile({
    unified: creator,
    preferredPlatforms: options?.preferredPlatforms,
    deliverables: options?.deliverables,
    creatorKeyOverride: creator.unified_id,
  });
}

export function unifiedCreatorToForecastInput(
  creator: UnifiedCreatorResult,
  options?: {
    preferredPlatforms?: string[];
    deliverables?: CampaignForecastDeliverableInput[];
    tier?: string;
  }
): CampaignForecastCreatorInput {
  const profile = unifiedCreatorToForecastProfile(creator, options);
  return profileToForecastCreatorInput(profile, options?.deliverables);
}

export function searchCardsToForecastProfiles(
  cards: SearchCreatorCardItem[],
  options?: {
    deliverablesByCreatorKey?: Record<string, CampaignForecastDeliverableInput[]>;
    defaultDeliverable?: CampaignForecastDeliverableInput;
  }
): CreatorForecastProfile[] {
  return cards.map((card) =>
    buildCreatorForecastProfile({
      creatorKeyOverride: card.id,
      manualSnapshot: {
        creatorKey: card.id,
        displayName: card.displayName,
        handle: card.handle,
        followers: card.followers ?? null,
        primaryPlatform: card.platform,
        engagementRate: card.engagementRate ?? null,
        categories: card.categories ?? [],
      },
      deliverables:
        options?.deliverablesByCreatorKey?.[card.id] ??
        (options?.defaultDeliverable ? [options.defaultDeliverable] : undefined),
    })
  );
}

export function searchCardsToForecastCreators(
  cards: SearchCreatorCardItem[],
  options?: {
    deliverablesByCreatorKey?: Record<string, CampaignForecastDeliverableInput[]>;
    defaultDeliverable?: CampaignForecastDeliverableInput;
  }
): CampaignForecastCreatorInput[] {
  return searchCardsToForecastProfiles(cards, options).map((profile, index) => {
    const card = cards[index]!;
    const deliverables =
      options?.deliverablesByCreatorKey?.[card.id] ??
      (options?.defaultDeliverable
        ? [options.defaultDeliverable]
        : [defaultDeliverableForPlatform(card.platform)]);
    return profileToForecastCreatorInput(profile, deliverables);
  });
}

export function forecastToGroundedKpis(forecast: CampaignForecast): GroundedKpi[] {
  const confidence = forecast.confidenceScore.score;
  const source = "Campaign Forecast Engine v3";

  return [
    {
      metric: "Audience Size",
      prediction: forecast.audienceSize.toLocaleString(),
      confidence,
      reason: "Deduplicated sum of creator followers.",
      calculationSource: source,
    },
    {
      metric: "Estimated Reach",
      prediction: forecast.estimatedReach.toLocaleString(),
      confidence,
      reason: `Net reach after ${forecast.overlapDeduction.toLocaleString()} audience overlap deduction (gross ${forecast.grossReach.toLocaleString()}).`,
      calculationSource: source,
    },
    {
      metric: "Estimated Impressions",
      prediction: forecast.estimatedImpressions.toLocaleString(),
      confidence,
      reason: "Aggregated deliverable impressions with platform formulas.",
      calculationSource: source,
    },
    {
      metric: "Estimated Views",
      prediction: forecast.estimatedViews.toLocaleString(),
      confidence,
      reason: "Platform-specific view estimates across deliverables.",
      calculationSource: source,
    },
    {
      metric: "Estimated Engagement",
      prediction: forecast.estimatedEngagements.toLocaleString(),
      confidence,
      reason:
        forecast.averageEngagementRate != null
          ? `Derived from creator ER (avg ${forecast.averageEngagementRate.toFixed(1)}%).`
          : "Derived from engagement-rate engine fallbacks.",
      calculationSource: source,
    },
    ...(forecast.averageEngagementRate != null
      ? [
          {
            metric: "Engagement Rate",
            prediction: `${forecast.averageEngagementRate.toFixed(1)}%`,
            confidence,
            reason: "Average engagement rate across roster creators with ER data.",
            calculationSource: source,
          } satisfies GroundedKpi,
        ]
      : []),
  ];
}

export function forecastSnapshotToGroundedKpis(
  snapshot: import("./types").CampaignForecastSnapshot
): GroundedKpi[] {
  return forecastToGroundedKpis({
    audienceSize: snapshot.audienceSize,
    grossReach: snapshot.grossReach,
    overlapDeduction: snapshot.overlapDeduction,
    estimatedReach: snapshot.estimatedReach,
    estimatedImpressions: snapshot.estimatedImpressions,
    estimatedViews: snapshot.estimatedViews,
    estimatedEngagements: snapshot.estimatedEngagements,
    averageEngagementRate: snapshot.averageEngagementRate,
    creatorForecasts: [],
    calculationSummary: {
      uniqueCreators: 0,
      totalDeliverables: 0,
      platforms: [],
      aggregationMethod: "deduplicated_creators_with_overlap",
      overlap: {
        grossReach: snapshot.grossReach,
        overlapDeduction: snapshot.overlapDeduction,
        netReach: snapshot.estimatedReach,
        pairCount: 0,
      },
      bullets: snapshot.explanation,
    },
    assumptions: { calculationMethod: snapshot.engineVersion },
    confidenceScore: {
      score: snapshot.confidenceScore,
      label: snapshot.confidenceLabel,
      deductions: [],
      bonuses: [],
    },
    explanation: snapshot.explanation,
  });
}

export function formatForecastCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}
