import type { SupabaseClient } from "@supabase/supabase-js";

import {
  emptyClientCampaignExecution,
  projectClientCampaignExecution,
  type CampaignExecutionSource,
  type ClientCampaignExecution,
} from "./campaign-execution";

type LineRow = { id: string; name: string | null; metadata: Record<string, unknown> | null };
type DeliverableRow = {
  id: string;
  campaign_line_id: string;
  platform: string | null;
  deliverable_type: string | null;
  quantity: number | null;
  live_date: string | null;
};
type PostRow = {
  id: string;
  assignment_deliverable_id: string;
  campaign_line_id: string;
  sequence_number: number | null;
  live_date: string | null;
  status: string | null;
  proof_url: string | null;
};
type PublicationRow = {
  id: string;
  assignment_deliverable_id: string | null;
  assignment_post_schedule_id: string | null;
  campaign_line_id: string | null;
  influencer_id: string | null;
  platform: string | null;
  content_url: string | null;
  publication_date: string | null;
  status: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  reach: number | null;
  actual_reach: number | null;
  forecast_reach: number | null;
  reach_source: string | null;
  impressions: number | null;
  actual_impressions: number | null;
  forecast_impressions: number | null;
  impressions_source: string | null;
  engagement_rate: number | null;
  engagement_views: number | null;
  engagement_likes: number | null;
  engagement_comments: number | null;
  engagement_shares: number | null;
};
type InfluencerRow = {
  campaign_line_id: string | null;
  influencer_id: string | null;
  influencer:
    | { display_name: string | null; primary_avatar_url: string | null }
    | { display_name: string | null; primary_avatar_url: string | null }[]
    | null;
};

function influencerName(row: InfluencerRow): string {
  const nested = row.influencer;
  const profile = Array.isArray(nested) ? nested[0] : nested;
  return profile?.display_name?.trim() || "";
}

function influencerAvatar(row: InfluencerRow): string | null {
  const nested = row.influencer;
  const profile = Array.isArray(nested) ? nested[0] : nested;
  return profile?.primary_avatar_url?.trim() || null;
}

export async function loadClientCampaignExecution(
  supabase: SupabaseClient,
  campaignHeaderId: string | null | undefined
): Promise<ClientCampaignExecution> {
  const headerId = campaignHeaderId?.trim();
  if (!headerId) return emptyClientCampaignExecution();

  try {
    const [linesResult, deliverablesResult, publicationsResult, influencersResult] = await Promise.all([
      supabase
        .from("campaign_lines")
        .select("id, name, metadata")
        .eq("campaign_header_id", headerId),
      supabase
        .from("assignment_deliverables")
        .select("id, campaign_line_id, platform, deliverable_type, quantity, live_date")
        .eq("campaign_header_id", headerId)
        .order("sort_order"),
      supabase
        .from("campaign_publications")
        .select(
          "id, assignment_deliverable_id, assignment_post_schedule_id, campaign_line_id, influencer_id, platform, content_url, publication_date, status, views, likes, comments, shares, reach, actual_reach, forecast_reach, reach_source, impressions, actual_impressions, forecast_impressions, impressions_source, engagement_rate, engagement_views, engagement_likes, engagement_comments, engagement_shares"
        )
        .eq("campaign_header_id", headerId),
      supabase
        .from("campaign_influencers")
        .select("campaign_line_id, influencer_id, influencer:influencers(display_name, primary_avatar_url)")
        .eq("campaign_header_id", headerId),
    ]);

    const lines = (linesResult.data ?? []) as LineRow[];
    const lineIds = lines.map((line) => line.id);
    let posts: PostRow[] = [];
    if (lineIds.length > 0) {
      const postsResult = await supabase
        .from("assignment_post_schedule")
        .select("id, assignment_deliverable_id, campaign_line_id, sequence_number, live_date, status, proof_url")
        .in("campaign_line_id", lineIds)
        .order("sequence_number");
      posts = (postsResult.data ?? []) as PostRow[];
    }

    const source: CampaignExecutionSource = {
      lines: lines.map((line) => ({
        id: line.id,
        name: line.name?.trim() || "Assignment",
        metadata: line.metadata,
      })),
      influencers: ((influencersResult.data ?? []) as InfluencerRow[]).map((row) => ({
        campaignLineId: row.campaign_line_id,
        influencerId: row.influencer_id,
        displayName: influencerName(row),
        avatarUrl: influencerAvatar(row),
      })),
      deliverables: ((deliverablesResult.data ?? []) as DeliverableRow[]).map((row) => ({
        id: row.id,
        campaignLineId: row.campaign_line_id,
        platform: row.platform ?? "",
        deliverableType: row.deliverable_type ?? "other",
        quantity: row.quantity && row.quantity > 0 ? row.quantity : 1,
        liveDate: row.live_date,
      })),
      posts: posts.map((row) => ({
        id: row.id,
        assignmentDeliverableId: row.assignment_deliverable_id,
        campaignLineId: row.campaign_line_id,
        sequenceNumber: row.sequence_number ?? 0,
        liveDate: row.live_date,
        status: row.status ?? "draft",
        proofUrl: row.proof_url,
      })),
      publications: ((publicationsResult.data ?? []) as PublicationRow[]).map((row) => ({
        id: row.id,
        assignmentDeliverableId: row.assignment_deliverable_id,
        assignmentPostScheduleId: row.assignment_post_schedule_id,
        campaignLineId: row.campaign_line_id,
        influencerId: row.influencer_id,
        platform: row.platform,
        contentUrl: row.content_url,
        publicationDate: row.publication_date,
        status: row.status,
        views: row.views,
        likes: row.likes,
        comments: row.comments,
        shares: row.shares,
        reach: row.reach,
        actualReach: row.actual_reach,
        forecastReach: row.forecast_reach,
        reachSource: row.reach_source,
        impressions: row.impressions,
        actualImpressions: row.actual_impressions,
        forecastImpressions: row.forecast_impressions,
        impressionsSource: row.impressions_source,
        engagementRate: row.engagement_rate,
        engagementViews: row.engagement_views,
        engagementLikes: row.engagement_likes,
        engagementComments: row.engagement_comments,
        engagementShares: row.engagement_shares,
      })),
    };

    return projectClientCampaignExecution(headerId, source);
  } catch {
    return { campaignHeaderId: headerId, posts: [] };
  }
}
