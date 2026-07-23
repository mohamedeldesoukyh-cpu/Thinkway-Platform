import type { CampaignForecastCreatorInput, CampaignForecastDeliverableInput } from "../types";
import type { CreatorForecastProfile } from "../profile/types";

function baselinesToHistoricalPerformance(profile: CreatorForecastProfile) {
  const avgReachByContentType: Record<string, number> = {};
  const avgViewsByContentType: Record<string, number> = {};
  let sampleSize = 0;

  for (const baseline of profile.forecastBaselines) {
    if (baseline.averageReach != null) {
      avgReachByContentType[baseline.contentType] = baseline.averageReach;
    }
    if (baseline.averageViews != null) {
      avgViewsByContentType[baseline.contentType] = baseline.averageViews;
    }
    sampleSize += baseline.sampleCount;
  }

  for (const publication of profile.publicationPerformance.recentPublications) {
    sampleSize += 1;
  }

  return {
    avgReachByContentType,
    avgViewsByContentType,
    avgReach: profile.engagement.avgViews != null ? Math.round(profile.engagement.avgViews * 0.92) : null,
    avgViews: profile.engagement.avgViews,
    avgEngagementRate: profile.engagement.engagementRate,
    sampleSize,
    dataFreshnessDays: profile.freshness.dataFreshnessDays,
    source: profile.diagnostics.primaryBaselineSource ?? profile.historicalPerformance.primarySource,
  };
}

/**
 * Hydrate a Creator Forecast Profile into engine input.
 * This is the ONLY mapping allowed between profile layer and forecast engine.
 */
export function profileToForecastCreatorInput(
  profile: CreatorForecastProfile,
  deliverables?: CampaignForecastDeliverableInput[]
): CampaignForecastCreatorInput {
  const resolvedDeliverables =
    deliverables ?? profile.forecastContext?.deliverables;
  return {
    creatorKey: profile.identity.creatorKey,
    displayName: profile.identity.displayName,
    handle: profile.identity.handle,
    followers: profile.followers,
    platform: profile.primaryPlatform,
    primaryPlatform: profile.primaryPlatform,
    platforms: profile.platforms,
    engagementRate: profile.engagement.engagementRate,
    deliverables: resolvedDeliverables,
    countryCode: profile.audience.countryCode,
    countryCodes: profile.audience.countryCodes,
    languageCodes: profile.audience.languageCodes,
    categories: profile.audience.categories,
    niche: profile.audience.niche,
    audienceInterests: profile.audience.audienceInterests,
    isVerified: profile.freshness.isVerified,
    dataFreshnessDays: profile.freshness.dataFreshnessDays,
    dnaCompleteness: profile.freshness.dnaCompleteness,
    historicalPerformance: baselinesToHistoricalPerformance(profile),
    avgViews: profile.engagement.avgViews,
    avgReach: null,
    recentPublicationMetrics: profile.publicationPerformance.recentPublications.map((publication) => ({
      contentType: publication.contentType,
      platform: publication.platform,
      views: publication.views,
      reach: publication.reach,
      engagements: publication.engagements,
      postedAt: publication.postedAt,
    })),
  };
}

export function profilesToForecastCreatorInputs(
  profiles: CreatorForecastProfile[],
  deliverablesByCreatorKey?: Record<string, CampaignForecastDeliverableInput[]>
): CampaignForecastCreatorInput[] {
  return profiles.map((profile) =>
    profileToForecastCreatorInput(profile, deliverablesByCreatorKey?.[profile.identity.creatorKey])
  );
}
