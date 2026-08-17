import {
  computeCampaignForecastFromProfiles,
  rosterToForecastProfiles,
} from "@/lib/campaign-forecast";
import { calculateCpm } from "@/lib/campaigns/performance-calculations";

import type { ClientCreatorSelectionState } from "./constants";
import { activityMixFromCreators } from "./deliverables";
import type {
  ClientCreatorCard,
  ClientMediaPlanSummary,
  ClientReviewSourceSnapshot,
  ClientReviewSourceSnapshotCreator,
} from "./types";

function finitePositive(value: number | undefined | null): number | undefined {
  return value != null && Number.isFinite(value) && value > 0 ? value : undefined;
}

function finiteNonNegative(value: number | undefined | null): number | undefined {
  return value != null && Number.isFinite(value) && value >= 0 ? value : undefined;
}

export function snapshotCreatorsForSummary(
  snapshot: ClientReviewSourceSnapshot,
  selection?: Record<string, ClientCreatorSelectionState>
): ClientReviewSourceSnapshotCreator[] {
  if (!selection) return snapshot.creators;
  return snapshot.creators.filter(
    (creator) => (selection[creator.creatorId] ?? "in_review") !== "rejected"
  );
}

function forecastFromCreators(creators: ClientReviewSourceSnapshotCreator[]) {
  const hasFollowers = creators.some((creator) => finitePositive(creator.followers) != null);
  if (!hasFollowers) return null;
  return computeCampaignForecastFromProfiles(
    rosterToForecastProfiles(
      creators.map((creator) => ({
        creatorKey: creator.creatorId,
        displayName: creator.displayName,
        handle: creator.handle,
        followers: creator.followers,
        platform: creator.platform,
        engagementRate: creator.engagementRate,
        deliverables: creator.deliverableItems?.map((item) => ({
          contentType: item.type,
          platform: item.platform,
          quantity: item.quantity,
        })),
      }))
    )
  );
}

export function buildMediaPlanSummary(
  snapshot: Pick<ClientReviewSourceSnapshot, "creators" | "commercial">,
  creators: ClientReviewSourceSnapshotCreator[] = snapshot.creators
): ClientMediaPlanSummary {
  const investment = finiteNonNegative(snapshot.commercial.creatorInvestment);
  const forecast = forecastFromCreators(creators);
  const estimatedReach = forecast ? finiteNonNegative(forecast.estimatedReach) : undefined;
  const estimatedEngagements = forecast
    ? finiteNonNegative(forecast.estimatedEngagements)
    : undefined;
  const estimatedImpressions = forecast
    ? finiteNonNegative(forecast.estimatedImpressions)
    : undefined;
  const cpm =
    investment != null && estimatedImpressions != null
      ? calculateCpm(investment, estimatedImpressions) ?? undefined
      : undefined;
  const cpe =
    investment != null && estimatedEngagements != null && estimatedEngagements > 0
      ? investment / estimatedEngagements
      : undefined;
  const averageEngagementRate =
    forecast?.averageEngagementRate != null && Number.isFinite(forecast.averageEngagementRate)
      ? forecast.averageEngagementRate
      : undefined;
  const creatorForecasts: ClientMediaPlanSummary["creatorForecasts"] = {};
  for (const row of forecast?.creatorForecasts ?? []) {
    const reach = finiteNonNegative(row.estimatedReach);
    const engagements = finiteNonNegative(row.estimatedEngagements);
    const creator = creators.find((item) => item.creatorId === row.creatorKey);
    const creatorInvestment = finiteNonNegative(creator?.investmentAmount);
    const creatorCpe =
      creatorInvestment != null && engagements != null && engagements > 0
        ? creatorInvestment / engagements
        : undefined;
    creatorForecasts[row.creatorKey] = {
      estimatedReach: reach,
      estimatedEngagements: engagements,
      cpe: creatorCpe != null && Number.isFinite(creatorCpe) ? creatorCpe : undefined,
    };
  }

  return {
    creatorCount: snapshot.creators.length,
    estimatedReach,
    estimatedEngagements,
    estimatedImpressions,
    averageEngagementRate,
    cpe: cpe != null && Number.isFinite(cpe) ? cpe : undefined,
    cpm: cpm != null && Number.isFinite(cpm) ? cpm : undefined,
    activityMix: activityMixFromCreators(creators),
    currency: snapshot.commercial.currency,
    creatorForecasts,
  };
}

export function applyCreatorForecasts<T extends ClientCreatorCard>(
  creators: T[],
  summary: ClientMediaPlanSummary
): T[] {
  return creators.map((creator) => {
    const forecast = summary.creatorForecasts[creator.creatorId];
    if (!forecast) return creator;
    return {
      ...creator,
      estimatedReach: creator.estimatedReach ?? forecast.estimatedReach,
      estimatedEngagements: creator.estimatedEngagements ?? forecast.estimatedEngagements,
      cpe: creator.cpe ?? forecast.cpe,
    };
  });
}

export function projectMediaPlanSummary(
  snapshot: ClientReviewSourceSnapshot,
  selection: Record<string, ClientCreatorSelectionState>
): ClientMediaPlanSummary {
  const creators = snapshotCreatorsForSummary(snapshot, selection);
  const investment = creators.reduce((sum, creator) => sum + (creator.investmentAmount ?? 0), 0);
  const hasPerCreator = snapshot.creators.some((creator) => creator.investmentAmount != null);
  return {
    ...buildMediaPlanSummary(
      {
        creators,
        commercial: {
          ...snapshot.commercial,
          creatorInvestment: hasPerCreator ? investment : snapshot.commercial.creatorInvestment,
        },
      },
      creators
    ),
    creatorCount: snapshot.creators.length,
  };
}
