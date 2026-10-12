import type { SupabaseClient } from "@supabase/supabase-js";
import type { CampaignPublicationRow } from "@/lib/domains/campaign/types";
import { isEphemeralStoryDeliverableType } from "@/lib/campaigns/deliverable-taxonomy";

type StoryAsset = {
  id: string;
  assignment_deliverable_id: string;
  assignment_post_schedule_id: string | null;
  current_version_id: string | null;
};

export function selectStoryPreviewAsset(
  row: CampaignPublicationRow,
  publications: CampaignPublicationRow[],
  assets: StoryAsset[]
): StoryAsset | undefined {
  if (!isEphemeralStoryDeliverableType(row.publication_type)) return undefined;
  const candidates = assets.filter((asset) =>
    asset.assignment_deliverable_id === row.assignment_deliverable_id && asset.current_version_id
  );
  const exact = row.assignment_post_schedule_id
    ? candidates.find((asset) => asset.assignment_post_schedule_id === row.assignment_post_schedule_id)
    : undefined;
  if (exact) return exact;
  // Never attach one story's evidence to another story in the same assignment.
  const siblings = publications.filter((pub) => pub.assignment_deliverable_id === row.assignment_deliverable_id);
  const unscoped = candidates.filter((asset) => !asset.assignment_post_schedule_id);
  return siblings.length === 1 && unscoped.length === 1 ? unscoped[0] : undefined;
}

/** Resolve original story documentation without copying files or changing publication metrics. */
export async function attachStoryPublicationPreviews(
  supabase: SupabaseClient,
  campaignId: string,
  publications: CampaignPublicationRow[]
): Promise<CampaignPublicationRow[]> {
  const missing = publications.filter((row) =>
    isEphemeralStoryDeliverableType(row.publication_type) && !row.screenshot_url && !row.thumbnail_url
  );
  if (!missing.length) return publications;
  const { data: assets, error } = await supabase.from("deliverable_assets")
    .select("id, assignment_deliverable_id, assignment_post_schedule_id, current_version_id")
    .eq("campaign_header_id", campaignId).eq("asset_type", "story_screenshot")
    .is("archived_at", null).order("created_at", { ascending: false });
  if (error || !assets?.length) return publications;
  const selected = new Map(missing.map((row) => [row.id, selectStoryPreviewAsset(row, publications, assets)]));
  const ids = [...new Set([...selected.values()].flatMap((asset) => asset?.current_version_id ? [asset.current_version_id] : []))];
  if (!ids.length) return publications;
  const { data: versions } = await supabase.from("deliverable_asset_versions")
    .select("id, asset_id, storage_bucket, storage_path, mime_type").in("id", ids);
  return Promise.all(publications.map(async (row) => {
    const asset = selected.get(row.id);
    const version = versions?.find((item) => item.id === asset?.current_version_id && item.asset_id === asset?.id);
    if (!version?.storage_bucket || !version.storage_path || !version.mime_type?.startsWith("image/")) return row;
    const { data } = await supabase.storage.from(version.storage_bucket).createSignedUrl(version.storage_path, 86400);
    return data?.signedUrl ? { ...row, screenshot_url: data.signedUrl, screenshot_source: "manual_upload" } : row;
  }));
}
