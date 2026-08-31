import type { SupabaseClient } from "@supabase/supabase-js";

import { listConnectionsForInfluencer } from "@/lib/creator-social/connections/service";
import { getSocialProvider } from "@/lib/creator-social/providers/registry";
import { isSocialProviderId, type SocialProviderId } from "@/lib/creator-social/ids";

import { asNullableNumber } from "./observations";
import {
  observationFromPublication,
  observationFromUnmatchedSocial,
  overlayMatchedSocialInsight,
  type CreatorConnectionSnapshot,
  type CreatorPublicationObservation,
} from "./observations";
import type { UpcomingCreatorUnit } from "./types";

type PublicationRow = {
  id: string;
  influencer_id: string;
  campaign_header_id: string | null;
  assignment_deliverable_id: string | null;
  assignment_post_schedule_id: string | null;
  platform: string | null;
  publication_type: string | null;
  content_url: string | null;
  publication_date: string | null;
  status: string | null;
  updated_at: string | null;
  views: number | null;
  reach: number | null;
  impressions: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  engagement_rate: number | null;
};

type InsightRow = {
  id: string;
  influencer_id: string;
  provider: string;
  insight_kind: string;
  publication_id: string | null;
  match_status: string;
  canonical_url: string | null;
  published_at: string | null;
  content_type: string | null;
  captured_at: string | null;
  views: number | null;
  reach: number | null;
  impressions: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  engagement_rate: number | null;
  followers: number | null;
};

export type CreatorInsightLoadResult = {
  observations: CreatorPublicationObservation[];
  connections: CreatorConnectionSnapshot[];
  hasOperationalHistory: boolean;
  publicationStamp: string | null;
  insightStamp: string | null;
  syncStamp: string | null;
};

function providerLabel(provider: string): string {
  if (isSocialProviderId(provider)) {
    return getSocialProvider(provider as SocialProviderId).displayName;
  }
  return provider;
}

export async function loadCreatorInsightFacts(
  supabase: SupabaseClient,
  influencerId: string
): Promise<CreatorInsightLoadResult> {
  const [publications, insights, connections, assignment] = await Promise.all([
    supabase
      .from("campaign_publications")
      .select(
        "id, influencer_id, campaign_header_id, assignment_deliverable_id, assignment_post_schedule_id, platform, publication_type, content_url, publication_date, status, updated_at, views, reach, impressions, likes, comments, shares, saves, engagement_rate"
      )
      .eq("influencer_id", influencerId)
      .order("publication_date", { ascending: false, nullsFirst: false }),
    supabase
      .from("creator_social_insights")
      .select(
        "id, influencer_id, provider, insight_kind, publication_id, match_status, canonical_url, published_at, content_type, captured_at, views, reach, impressions, likes, comments, shares, saves, engagement_rate, followers"
      )
      .eq("influencer_id", influencerId)
      .order("captured_at", { ascending: false }),
    listConnectionsForInfluencer(supabase, influencerId),
    supabase
      .from("campaign_influencers")
      .select("id")
      .eq("influencer_id", influencerId)
      .limit(1)
      .maybeSingle(),
  ]);

  const publicationRows = (publications.data ?? []) as PublicationRow[];
  const insightRows = (insights.data ?? []) as InsightRow[];

  const byPublication = new Map<string, CreatorPublicationObservation>();
  for (const row of publicationRows) {
    byPublication.set(
      row.id,
      observationFromPublication({
        id: row.id,
        influencerId: row.influencer_id,
        campaignHeaderId: row.campaign_header_id,
        assignmentDeliverableId: row.assignment_deliverable_id,
        assignmentPostScheduleId: row.assignment_post_schedule_id,
        platform: row.platform,
        publicationType: row.publication_type,
        contentUrl: row.content_url,
        publicationDate: row.publication_date,
        status: row.status,
        updatedAt: row.updated_at,
        views: asNullableNumber(row.views),
        reach: asNullableNumber(row.reach),
        impressions: asNullableNumber(row.impressions),
        likes: asNullableNumber(row.likes),
        comments: asNullableNumber(row.comments),
        shares: asNullableNumber(row.shares),
        saves: asNullableNumber(row.saves),
        engagementRate: asNullableNumber(row.engagement_rate),
      })
    );
  }

  const unmatchedSocial: CreatorPublicationObservation[] = [];
  for (const row of insightRows) {
    if (row.influencer_id !== influencerId) continue;
    if (row.insight_kind !== "content") continue;
    const metrics = {
      views: asNullableNumber(row.views),
      reach: asNullableNumber(row.reach),
      impressions: asNullableNumber(row.impressions),
      likes: asNullableNumber(row.likes),
      comments: asNullableNumber(row.comments),
      shares: asNullableNumber(row.shares),
      saves: asNullableNumber(row.saves),
      engagementRate: asNullableNumber(row.engagement_rate),
      followers: asNullableNumber(row.followers),
    };
    if (row.match_status === "matched" && row.publication_id) {
      const existing = byPublication.get(row.publication_id);
      if (existing && existing.influencerId === influencerId) {
        byPublication.set(
          row.publication_id,
          overlayMatchedSocialInsight(existing, {
            ...metrics,
            publishedAt: row.published_at,
            contentType: row.content_type,
            capturedAt: row.captured_at,
          })
        );
        continue;
      }
    }
    unmatchedSocial.push(
      observationFromUnmatchedSocial({
        id: row.id,
        influencerId: row.influencer_id,
        provider: row.provider,
        contentType: row.content_type,
        canonicalUrl: row.canonical_url,
        publishedAt: row.published_at,
        capturedAt: row.captured_at,
        ...metrics,
      })
    );
  }

  const connectionViews: CreatorConnectionSnapshot[] = connections.map((row) => ({
    provider: row.provider,
    displayName: providerLabel(row.provider),
    status: row.status,
    lastSyncedAt: row.last_synced_at,
  }));

  let publicationStamp: string | null = null;
  for (const row of publicationRows) {
    if (row.updated_at && (!publicationStamp || row.updated_at > publicationStamp)) {
      publicationStamp = row.updated_at;
    }
  }
  let insightStamp: string | null = null;
  for (const row of insightRows) {
    if (row.captured_at && (!insightStamp || row.captured_at > insightStamp)) {
      insightStamp = row.captured_at;
    }
  }
  let syncStamp: string | null = null;
  for (const row of connections) {
    if (row.last_synced_at && (!syncStamp || row.last_synced_at > syncStamp)) {
      syncStamp = row.last_synced_at;
    }
  }

  return {
    observations: [...byPublication.values(), ...unmatchedSocial],
    connections: connectionViews,
    hasOperationalHistory: Boolean(assignment.data) || publicationRows.length > 0,
    publicationStamp,
    insightStamp,
    syncStamp,
  };
}

export function unitStampFromUpcoming(units: readonly UpcomingCreatorUnit[]): string {
  return units
    .map((unit) => `${unit.assignmentDeliverableId}:${unit.status}:${unit.deliverableType}`)
    .sort()
    .join(",");
}
