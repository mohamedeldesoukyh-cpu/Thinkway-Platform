import type { CampaignPerformanceSummary } from "@/features/campaigns/queries/publications";

export function emptyCampaignPerformanceSummary(): CampaignPerformanceSummary {
  return {
    total_publications: 0,
    total_reach: 0,
    total_actual_reach: 0,
    total_forecast_reach: 0,
    total_manual_reach: 0,
    total_impressions: 0,
    total_actual_impressions: 0,
    total_forecast_impressions: 0,
    total_manual_impressions: 0,
    total_views: 0,
    total_engagements: 0,
    average_engagement_rate: null,
    average_cpm: null,
    average_cpv: null,
    top_creator_name: null,
    top_creator_engagements: 0,
    currency: "USD",
  };
}
