import type { CampaignPerformanceCharts, CampaignPerformanceSummary, CampaignPublicationRow } from '@/lib/domains/campaign/types';
import { publicationCollabLabel, uniqueCollabPublications } from '@/lib/campaigns/publication-content-url';
import { getPlatformOptionLabel, deliverableTypeShortLabel } from '@/lib/campaigns/deliverable-taxonomy';
import { averageEngagementRateAgainstAgreed } from './engagement-rate-engine';
import { resolvePublicationValueScope } from './publication-value-scope';

export function buildPerformanceSummary(rows: CampaignPublicationRow[]): CampaignPerformanceSummary {
  const publications = uniqueCollabPublications(rows);
  const total_reach = publications.reduce((s, p) => s + (p.reach ?? 0), 0);
  const total_actual_reach = publications.reduce(
    (s, p) => s + (p.reach_source === "actual" ? p.reach ?? 0 : 0),
    0
  );
  const total_forecast_reach = publications.reduce(
    (s, p) => s + (p.reach_source === "forecast" ? p.reach ?? 0 : 0),
    0
  );
  const total_manual_reach = publications.reduce(
    (s, p) => s + (p.reach_source === "manual" ? p.reach ?? 0 : 0),
    0
  );
  const total_impressions = publications.reduce((s, p) => s + (p.impressions ?? 0), 0);
  const total_actual_impressions = publications.reduce(
    (s, p) => s + (p.impressions_source === "actual" ? p.impressions ?? 0 : 0),
    0
  );
  const total_forecast_impressions = publications.reduce(
    (s, p) => s + (p.impressions_source === "forecast" ? p.impressions ?? 0 : 0),
    0
  );
  const total_manual_impressions = publications.reduce(
    (s, p) => s + (p.impressions_source === "manual" ? p.impressions ?? 0 : 0),
    0
  );
  const total_views = publications.reduce((s, p) => s + (p.views ?? 0), 0);
  const total_engagements = publications.reduce((s, p) => s + p.total_engagements, 0);

  const agreed_publications = publications.filter(
    (p) => resolvePublicationValueScope(p) === "agreed"
  ).length;
  const added_value_publications = publications.filter(
    (p) => resolvePublicationValueScope(p) === "added_value"
  ).length;

  // Campaign Avg ER: sum ER across all posts (agreed + added value), divide by agreed count only.
  const cpmValues = publications.map((p) => p.cpm).filter((v): v is number => v != null);
  const cpvValues = publications.map((p) => p.cpv).filter((v): v is number => v != null);

  const creatorEngagements = new Map<string, number>();
  for (const p of publications) {
    const name = publicationCollabLabel(p.influencer_name, p.notes);
    creatorEngagements.set(name, (creatorEngagements.get(name) ?? 0) + p.total_engagements);
  }
  let top_creator_name: string | null = null;
  let top_creator_engagements = 0;
  for (const [name, engagements] of creatorEngagements) {
    if (engagements > top_creator_engagements) {
      top_creator_name = name;
      top_creator_engagements = engagements;
    }
  }

  return {
    total_publications: publications.length,
    agreed_publications,
    added_value_publications,
    total_reach,
    total_actual_reach,
    total_forecast_reach,
    total_manual_reach,
    total_impressions,
    total_actual_impressions,
    total_forecast_impressions,
    total_manual_impressions,
    total_views,
    total_engagements,
    average_engagement_rate: averageEngagementRateAgainstAgreed(
      publications.map((p) => p.engagement_rate),
      agreed_publications
    ),
    average_cpm: cpmValues.length > 0 ? cpmValues.reduce((a, b) => a + b, 0) / cpmValues.length : null,
    average_cpv: cpvValues.length > 0 ? cpvValues.reduce((a, b) => a + b, 0) / cpvValues.length : null,
    top_creator_name,
    top_creator_engagements,
    currency: publications[0]?.currency ?? "USD",
  };
}

export function buildPerformanceCharts(rows: CampaignPublicationRow[]): CampaignPerformanceCharts {
  const publications = uniqueCollabPublications(rows);
  const byDate = new Map<string, { views: number; engagements: number; reach: number }>();
  const byPlatform = new Map<string, { count: number; engagements: number }>();
  const byType = new Map<string, number>();
  const byCreatorEng = new Map<string, { engagements: number; views: number }>();
  const byCreatorReach = new Map<string, number>();

  for (const p of publications) {
    const date = p.publication_date ?? p.created_at.slice(0, 10);
    const bucket = byDate.get(date) ?? { views: 0, engagements: 0, reach: 0 };
    bucket.views += p.views ?? 0;
    bucket.engagements += p.total_engagements;
    bucket.reach += p.reach ?? 0;
    byDate.set(date, bucket);

    const plat = byPlatform.get(p.platform) ?? { count: 0, engagements: 0 };
    plat.count += 1;
    plat.engagements += p.total_engagements;
    byPlatform.set(p.platform, plat);

    byType.set(p.publication_type, (byType.get(p.publication_type) ?? 0) + 1);

    const creator = publicationCollabLabel(p.influencer_name, p.notes);
    const ce = byCreatorEng.get(creator) ?? { engagements: 0, views: 0 };
    ce.engagements += p.total_engagements;
    ce.views += p.views ?? 0;
    byCreatorEng.set(creator, ce);
    byCreatorReach.set(creator, (byCreatorReach.get(creator) ?? 0) + (p.reach ?? 0));
  }

  const engagementBuckets = [
    { bucket: "0", count: 0 },
    { bucket: "1–100", count: 0 },
    { bucket: "101–1K", count: 0 },
    { bucket: "1K–10K", count: 0 },
    { bucket: "10K+", count: 0 },
  ];
  for (const p of publications) {
    const e = p.total_engagements;
    if (e <= 0) engagementBuckets[0]!.count += 1;
    else if (e <= 100) engagementBuckets[1]!.count += 1;
    else if (e <= 1000) engagementBuckets[2]!.count += 1;
    else if (e <= 10000) engagementBuckets[3]!.count += 1;
    else engagementBuckets[4]!.count += 1;
  }

  return {
    performance_over_time: [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, ...v })),
    platform_split: [...byPlatform.entries()].map(([platform, v]) => ({
      platform,
      label: getPlatformOptionLabel(platform),
      count: v.count,
      engagements: v.engagements,
    })),
    content_type_split: [...byType.entries()].map(([type, count]) => ({
      type,
      label: deliverableTypeShortLabel(type),
      count,
    })),
    top_creators_by_engagement: [...byCreatorEng.entries()]
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.engagements - a.engagements)
      .slice(0, 8),
    reach_by_creator: [...byCreatorReach.entries()]
      .map(([name, reach]) => ({ name, reach }))
      .sort((a, b) => b.reach - a.reach)
      .slice(0, 8),
    views_by_publication: publications
      .map((p) => ({
        id: p.id,
        label: `${publicationCollabLabel(p.influencer_name, p.notes)} · ${p.publication_type_label}`,
        views: p.views ?? 0,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10),
    engagement_distribution: engagementBuckets,
  };
}

