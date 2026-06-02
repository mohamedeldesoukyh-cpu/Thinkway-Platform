import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deliverableTypeShortLabel, getPlatformOptionLabel } from "@/lib/campaigns/deliverable-taxonomy";

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
  notes: string | null;
  auto_detected: boolean;
  created_at: string;
};

export async function getCampaignPublications(
  campaignHeaderId: string
): Promise<{ publications: CampaignPublicationRow[]; load_error: string | null }> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("campaign_publications")
    .select(
      `
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
      notes,
      auto_detected,
      created_at,
      influencer:influencers(display_name)
    `
    )
    .eq("campaign_header_id", campaignHeaderId)
    .order("publication_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("[publications] query failed — table may not be migrated yet", {
      campaignHeaderId,
      message: error.message,
    });
    return { publications: [], load_error: error.message };
  }

  const publications = (data ?? []).map((row) => {
    const r = row as unknown as {
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
      notes: string | null;
      auto_detected: boolean;
      created_at: string;
      influencer: { display_name: string } | null;
    };

    return {
      id: r.id,
      campaign_header_id: r.campaign_header_id,
      campaign_line_id: r.campaign_line_id,
      assignment_deliverable_id: r.assignment_deliverable_id,
      assignment_post_schedule_id: r.assignment_post_schedule_id,
      influencer_id: r.influencer_id,
      influencer_name: r.influencer?.display_name ?? null,
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
      notes: r.notes,
      auto_detected: r.auto_detected ?? false,
      created_at: r.created_at,
    };
  });

  return { publications, load_error: null };
}
