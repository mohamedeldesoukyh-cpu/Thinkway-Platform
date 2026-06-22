import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deliverableTypeShortLabel, getPlatformOptionLabel } from "@/lib/campaigns/deliverable-taxonomy";
import {
  deriveCalculatedMetrics,
  formatCompactCount,
  totalEngagements,
  type PerformanceMetricInput,
} from "@/lib/campaigns/performance-calculations";

export type CampaignPublicationRow = {
  id: string;
  campaign_header_id: string;
  campaign_line_id: string | null;
  assignment_deliverable_id: string | null;
  assignment_post_schedule_id: string | null;
  influencer_id: string | null;
  influencer_name: string | null;
  platform: string;
  publication_type: string;
  publication_type_label: string;
  platform_label: string;
  content_url: string | null;
  publication_date: string | null;
  status: string;
  assignee_id: string | null;
  assignee_name: string | null;
  caption: string | null;
  hashtags: string | null;
  mentions: string | null;
  thumbnail_url: string | null;
  notes: string | null;
  auto_detected: boolean;
  created_at: string;
  updated_at: string | null;
  last_synced_at: string | null;
  sync_status: string | null;
  sync_source: string | null;
  impressions: number | null;
  reach: number | null;
  views: number | null;
  unique_views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  clicks: number | null;
  plays: number | null;
  watch_time_seconds: number | null;
  average_watch_time_seconds: number | null;
  completion_rate: number | null;
  engagement_rate: number | null;
  view_rate: number | null;
  cpm: number | null;
  cpv: number | null;
  cpe: number | null;
  cpc: number | null;
  sentiment_score: number | null;
  brand_safety_score: number | null;
  authenticity_score: number | null;
  cost: number | null;
  currency: string | null;
  total_engagements: number;
};

export type CampaignPerformanceSummary = {
  total_publications: number;
  total_reach: number;
  total_impressions: number;
  total_views: number;
  total_engagements: number;
  average_engagement_rate: number | null;
  average_cpm: number | null;
  average_cpv: number | null;
  top_creator_name: string | null;
  top_creator_engagements: number;
  currency: string;
};

export type CampaignPerformanceCharts = {
  performance_over_time: Array<{
    date: string;
    views: number;
    engagements: number;
    reach: number;
  }>;
  platform_split: Array<{ platform: string; label: string; count: number; engagements: number }>;
  content_type_split: Array<{ type: string; label: string; count: number }>;
  top_creators_by_engagement: Array<{ name: string; engagements: number; views: number }>;
  reach_by_creator: Array<{ name: string; reach: number }>;
  views_by_publication: Array<{ id: string; label: string; views: number }>;
  engagement_distribution: Array<{ bucket: string; count: number }>;
};

export type CampaignPerformanceBundle = {
  publications: CampaignPublicationRow[];
  summary: CampaignPerformanceSummary;
  charts: CampaignPerformanceCharts;
  load_error: string | null;
};

const PUBLICATION_SELECT = `
  id,
  campaign_header_id,
  campaign_line_id,
  assignment_deliverable_id,
  assignment_post_schedule_id,
  influencer_id,
  platform,
  publication_type,
  content_url,
  publication_date,
  status,
  assignee_id,
  caption,
  hashtags,
  mentions,
  thumbnail_url,
  notes,
  auto_detected,
  created_at,
  updated_at,
  last_synced_at,
  api_sync_status,
  detection_source,
  sync_status,
  sync_source,
  impressions,
  reach,
  views,
  unique_views,
  likes,
  comments,
  shares,
  saves,
  clicks,
  plays,
  watch_time_seconds,
  average_watch_time_seconds,
  completion_rate,
  engagement_rate,
  view_rate,
  cpm,
  cpv,
  cpe,
  cpc,
  sentiment_score,
  brand_safety_score,
  authenticity_score,
  cost,
  currency,
  engagement_views,
  engagement_likes,
  engagement_comments,
  engagement_shares
`;

type PublicationRecord = {
  id: string;
  campaign_header_id: string;
  campaign_line_id: string | null;
  assignment_deliverable_id: string | null;
  assignment_post_schedule_id: string | null;
  influencer_id: string | null;
  platform: string;
  publication_type: string;
  content_url: string | null;
  publication_date: string | null;
  status: string;
  assignee_id: string | null;
  caption: string | null;
  hashtags: string | null;
  mentions: string | null;
  thumbnail_url: string | null;
  notes: string | null;
  auto_detected: boolean;
  created_at: string;
  updated_at: string | null;
  last_synced_at: string | null;
  api_sync_status: string | null;
  detection_source: string | null;
  sync_status: string | null;
  sync_source: string | null;
  impressions: number | null;
  reach: number | null;
  views: number | null;
  unique_views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  clicks: number | null;
  plays: number | null;
  watch_time_seconds: number | null;
  average_watch_time_seconds: number | null;
  completion_rate: number | null;
  engagement_rate: number | null;
  view_rate: number | null;
  cpm: number | null;
  cpv: number | null;
  cpe: number | null;
  cpc: number | null;
  sentiment_score: number | null;
  brand_safety_score: number | null;
  authenticity_score: number | null;
  cost: number | null;
  currency: string | null;
  engagement_views: number | null;
  engagement_likes: number | null;
  engagement_comments: number | null;
  engagement_shares: number | null;
};

function num(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapPublicationRecord(
  r: PublicationRecord,
  influencerNames: Map<string, string>
): CampaignPublicationRow {
  const views = num(r.views) ?? num(r.engagement_views);
  const likes = num(r.likes) ?? num(r.engagement_likes);
  const comments = num(r.comments) ?? num(r.engagement_comments);
  const shares = num(r.shares) ?? num(r.engagement_shares);
  const impressions = num(r.impressions);
  const reach = num(r.reach);
  const saves = num(r.saves);
  const clicks = num(r.clicks);
  const cost = num(r.cost);

  const metricInput: PerformanceMetricInput = {
    impressions,
    reach,
    views,
    likes,
    comments,
    shares,
    saves,
    clicks,
    cost,
  };

  const derived = deriveCalculatedMetrics(metricInput);
  const engagements = totalEngagements(metricInput);

  return {
    id: r.id,
    campaign_header_id: r.campaign_header_id,
    campaign_line_id: r.campaign_line_id,
    assignment_deliverable_id: r.assignment_deliverable_id,
    assignment_post_schedule_id: r.assignment_post_schedule_id,
    influencer_id: r.influencer_id,
    influencer_name: r.influencer_id ? (influencerNames.get(r.influencer_id) ?? null) : null,
    platform: r.platform,
    publication_type: r.publication_type,
    publication_type_label: deliverableTypeShortLabel(r.publication_type),
    platform_label: getPlatformOptionLabel(r.platform),
    content_url: r.content_url,
    publication_date: r.publication_date,
    status: r.status,
    assignee_id: r.assignee_id,
    assignee_name: null,
    caption: r.caption,
    hashtags: r.hashtags,
    mentions: r.mentions,
    thumbnail_url: r.thumbnail_url,
    notes: r.notes,
    auto_detected: r.auto_detected ?? false,
    created_at: r.created_at,
    updated_at: r.updated_at,
    last_synced_at: r.last_synced_at,
    sync_status: r.sync_status ?? r.api_sync_status,
    sync_source: r.sync_source ?? r.detection_source,
    impressions,
    reach,
    views,
    unique_views: num(r.unique_views),
    likes,
    comments,
    shares,
    saves,
    clicks,
    plays: num(r.plays),
    watch_time_seconds: num(r.watch_time_seconds),
    average_watch_time_seconds: num(r.average_watch_time_seconds),
    completion_rate: num(r.completion_rate),
    engagement_rate: num(r.engagement_rate) ?? derived.engagement_rate,
    view_rate: num(r.view_rate) ?? derived.view_rate,
    cpm: num(r.cpm) ?? derived.cpm,
    cpv: num(r.cpv) ?? derived.cpv,
    cpe: num(r.cpe) ?? derived.cpe,
    cpc: num(r.cpc) ?? derived.cpc,
    sentiment_score: num(r.sentiment_score),
    brand_safety_score: num(r.brand_safety_score),
    authenticity_score: num(r.authenticity_score),
    cost,
    currency: r.currency ?? "USD",
    total_engagements: engagements,
  };
}

async function loadInfluencerNames(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  influencerIds: string[]
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (influencerIds.length === 0) return names;

  const { data, error } = await supabase
    .from("influencers")
    .select("id, display_name")
    .in("id", influencerIds);

  if (error) {
    console.warn("[publications] influencer name lookup failed", { message: error.message });
    return names;
  }

  for (const row of data ?? []) {
    names.set(row.id, row.display_name);
  }
  return names;
}

function buildSummary(publications: CampaignPublicationRow[]): CampaignPerformanceSummary {
  const total_reach = publications.reduce((s, p) => s + (p.reach ?? 0), 0);
  const total_impressions = publications.reduce((s, p) => s + (p.impressions ?? 0), 0);
  const total_views = publications.reduce((s, p) => s + (p.views ?? 0), 0);
  const total_engagements = publications.reduce((s, p) => s + p.total_engagements, 0);

  const erValues = publications
    .map((p) => p.engagement_rate)
    .filter((v): v is number => v != null);
  const cpmValues = publications.map((p) => p.cpm).filter((v): v is number => v != null);
  const cpvValues = publications.map((p) => p.cpv).filter((v): v is number => v != null);

  const creatorEngagements = new Map<string, number>();
  for (const p of publications) {
    const name = p.influencer_name ?? "Unknown";
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
    total_reach,
    total_impressions,
    total_views,
    total_engagements,
    average_engagement_rate:
      erValues.length > 0 ? erValues.reduce((a, b) => a + b, 0) / erValues.length : null,
    average_cpm: cpmValues.length > 0 ? cpmValues.reduce((a, b) => a + b, 0) / cpmValues.length : null,
    average_cpv: cpvValues.length > 0 ? cpvValues.reduce((a, b) => a + b, 0) / cpvValues.length : null,
    top_creator_name,
    top_creator_engagements,
    currency: publications[0]?.currency ?? "USD",
  };
}

function buildCharts(publications: CampaignPublicationRow[]): CampaignPerformanceCharts {
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

    const creator = p.influencer_name ?? "Unknown";
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
        label: `${p.influencer_name ?? "Creator"} · ${p.publication_type_label}`,
        views: p.views ?? 0,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10),
    engagement_distribution: engagementBuckets,
  };
}

export async function getCampaignPerformanceBundle(
  campaignHeaderId: string
): Promise<CampaignPerformanceBundle> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("campaign_publications")
    .select(PUBLICATION_SELECT)
    .eq("campaign_header_id", campaignHeaderId)
    .order("publication_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[performance] query failed", { campaignHeaderId, message: error.message });
    return {
      publications: [],
      summary: {
        total_publications: 0,
        total_reach: 0,
        total_impressions: 0,
        total_views: 0,
        total_engagements: 0,
        average_engagement_rate: null,
        average_cpm: null,
        average_cpv: null,
        top_creator_name: null,
        top_creator_engagements: 0,
        currency: "USD",
      },
      charts: {
        performance_over_time: [],
        platform_split: [],
        content_type_split: [],
        top_creators_by_engagement: [],
        reach_by_creator: [],
        views_by_publication: [],
        engagement_distribution: [],
      },
      load_error: error.message,
    };
  }

  const rows = (data ?? []) as unknown as PublicationRecord[];
  const influencerIds = [
    ...new Set(rows.map((r) => r.influencer_id).filter((id): id is string => id != null)),
  ];
  const influencerNames = await loadInfluencerNames(supabase, influencerIds);
  const publications = rows.map((r) => mapPublicationRecord(r, influencerNames));

  return {
    publications,
    summary: buildSummary(publications),
    charts: buildCharts(publications),
    load_error: null,
  };
}

/** @deprecated Use getCampaignPerformanceBundle */
export async function getCampaignPublications(campaignHeaderId: string) {
  const bundle = await getCampaignPerformanceBundle(campaignHeaderId);
  return { publications: bundle.publications, load_error: bundle.load_error };
}

export { formatCompactCount };
