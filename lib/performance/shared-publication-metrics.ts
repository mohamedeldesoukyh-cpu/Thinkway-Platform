import { normalizePublicationContentUrl, notesHaveCollabMarker, uniqueCollabPublications } from '@/lib/campaigns/publication-content-url';
import type { CampaignPublicationRow } from '@/lib/domains/campaign/types';
import { deriveCalculatedMetrics } from '@/lib/campaigns/performance-calculations';
import { computeEngagementSnapshot } from './engagement-rate-engine';

/** One collected snapshot per shared post; creator identity and contract scope stay separate. */
export function alignSharedPublicationMetrics(rows: CampaignPublicationRow[]): CampaignPublicationRow[] {
  const snapshots = new Map(uniqueCollabPublications(rows)
    .filter(row => notesHaveCollabMarker(row.notes) && normalizePublicationContentUrl(row.content_url))
    .map(row => [normalizePublicationContentUrl(row.content_url), row]));
  return rows.map(row => {
    const source = snapshots.get(normalizePublicationContentUrl(row.content_url));
    if (!source || source.id === row.id || source.platform !== row.platform) return row;
    const metrics = {
      likes: source.likes, comments: source.comments, shares: source.shares, saves: source.saves,
      views: source.views, plays: source.plays, report_video_counters: source.report_video_counters,
      reach: source.reach, reach_source: source.reach_source,
      actual_reach: source.actual_reach, forecast_reach: source.forecast_reach,
      impressions: source.impressions, impressions_source: source.impressions_source,
      actual_impressions: source.actual_impressions, forecast_impressions: source.forecast_impressions,
      forecast_impressions_formula: source.forecast_impressions_formula,
      last_synced_at: source.last_synced_at,
    };
    const engagement = computeEngagementSnapshot({ ...metrics, followers: row.platform_follower_count,
      manualEngagementRate: row.engagement_rate_method === 'manual' ? row.engagement_rate : null });
    const derived = deriveCalculatedMetrics({ ...row, ...metrics, followers: row.platform_follower_count });
    return { ...row, ...metrics, ...derived, total_engagements: source.total_engagements,
      engagement_rate: engagement.engagement_rate, engagement_rate_method: engagement.engagement_rate_method };
  });
}
