import type { SupabaseClient } from "@supabase/supabase-js";

import { parseLineAssignment } from "@/lib/campaigns/line-assignment";

import {
  emptyClientCampaignContent,
  projectClientCampaignContent,
  type ClientCampaignContent,
  type ClientContentDecisionRecord,
} from "./content-approval";

type AssetRow = {
  id: string;
  campaign_header_id: string;
  assignment_deliverable_id: string;
  assignment_post_schedule_id: string | null;
  asset_type: string;
  medium: string;
  label: string | null;
  current_version_id: string | null;
  archived_at: string | null;
};
type VersionRow = {
  id: string;
  asset_id: string;
  version_number: number;
  storage_bucket: string | null;
  storage_path: string | null;
  external_url: string | null;
  mime_type: string | null;
  file_name: string | null;
  uploaded_at: string;
};
type DecisionRow = {
  id: string;
  version_id: string;
  decision: "approved" | "changes_requested";
  comment: string | null;
  decided_at: string;
  actor_kind: "client" | "internal";
};
type DeliverableRow = {
  id: string;
  campaign_line_id: string;
  platform: string | null;
  deliverable_type: string | null;
};
type LineRow = { id: string; name: string | null; metadata: Record<string, unknown> | null };
type InfluencerRow = {
  campaign_line_id: string | null;
  influencer: { display_name: string | null } | { display_name: string | null }[] | null;
};

function influencerName(row: InfluencerRow): string {
  const nested = row.influencer;
  const profile = Array.isArray(nested) ? nested[0] : nested;
  return profile?.display_name?.trim() || "";
}

function mapDecisions(rows: DecisionRow[]): ClientContentDecisionRecord[] {
  return rows.map((row) => ({
    id: row.id,
    versionId: row.version_id,
    decision: row.decision,
    comment: row.comment,
    decidedAt: row.decided_at,
    actorKind: row.actor_kind,
  }));
}

export async function loadClientCampaignContent(
  supabase: SupabaseClient,
  campaignHeaderId: string | null | undefined
): Promise<ClientCampaignContent> {
  const headerId = campaignHeaderId?.trim();
  if (!headerId) return emptyClientCampaignContent();

  try {
    const [assetsResult, deliverablesResult, linesResult, influencersResult, decisionsResult] =
      await Promise.all([
        supabase
          .from("deliverable_assets")
          .select(
            "id, campaign_header_id, assignment_deliverable_id, assignment_post_schedule_id, asset_type, medium, label, current_version_id, archived_at"
          )
          .eq("campaign_header_id", headerId)
          .is("archived_at", null),
        supabase
          .from("assignment_deliverables")
          .select("id, campaign_line_id, platform, deliverable_type")
          .eq("campaign_header_id", headerId),
        supabase.from("campaign_lines").select("id, name, metadata").eq("campaign_header_id", headerId),
        supabase
          .from("campaign_influencers")
          .select("campaign_line_id, influencer:influencers(display_name)")
          .eq("campaign_header_id", headerId),
        supabase
          .from("campaign_client_content_decisions")
          .select("id, version_id, decision, comment, decided_at, actor_kind")
          .eq("campaign_header_id", headerId)
          .order("decided_at", { ascending: false }),
      ]);

    const assets = (assetsResult.data ?? []) as AssetRow[];
    const assetIds = assets.map((asset) => asset.id);
    let versions: VersionRow[] = [];
    if (assetIds.length > 0) {
      const versionsResult = await supabase
        .from("deliverable_asset_versions")
        .select(
          "id, asset_id, version_number, storage_bucket, storage_path, external_url, mime_type, file_name, uploaded_at"
        )
        .in("asset_id", assetIds);
      versions = (versionsResult.data ?? []) as VersionRow[];
    }

    const creatorByLine = new Map<string, string>();
    for (const line of (linesResult.data ?? []) as LineRow[]) {
      const fromMeta = parseLineAssignment(line.metadata ?? null)?.influencer_name?.trim();
      creatorByLine.set(line.id, fromMeta || line.name?.trim() || "Creator");
    }
    for (const row of (influencersResult.data ?? []) as InfluencerRow[]) {
      if (!row.campaign_line_id || !influencerName(row)) continue;
      creatorByLine.set(row.campaign_line_id, influencerName(row));
    }

    const creatorNameByDeliverableId: Record<string, string> = {};
    const platformByDeliverableId: Record<string, string> = {};
    const deliverableTypeByDeliverableId: Record<string, string> = {};
    for (const deliverable of (deliverablesResult.data ?? []) as DeliverableRow[]) {
      creatorNameByDeliverableId[deliverable.id] = creatorByLine.get(deliverable.campaign_line_id) ?? "Creator";
      platformByDeliverableId[deliverable.id] = deliverable.platform ?? "";
      deliverableTypeByDeliverableId[deliverable.id] = deliverable.deliverable_type ?? "other";
    }

    return projectClientCampaignContent({
      campaignHeaderId: headerId,
      assets: assets.map((asset) => ({
        id: asset.id,
        campaignHeaderId: asset.campaign_header_id,
        assignmentDeliverableId: asset.assignment_deliverable_id,
        assignmentPostScheduleId: asset.assignment_post_schedule_id,
        assetType: asset.asset_type,
        medium: asset.medium,
        label: asset.label,
        currentVersionId: asset.current_version_id,
        archivedAt: asset.archived_at,
      })),
      versions: versions.map((version) => ({
        id: version.id,
        assetId: version.asset_id,
        versionNumber: version.version_number,
        storageBucket: version.storage_bucket,
        storagePath: version.storage_path,
        externalUrl: version.external_url,
        mimeType: version.mime_type,
        fileName: version.file_name,
        uploadedAt: version.uploaded_at,
      })),
      decisions: mapDecisions((decisionsResult.data ?? []) as DecisionRow[]),
      creatorNameByDeliverableId,
      platformByDeliverableId,
      deliverableTypeByDeliverableId,
    });
  } catch {
    return { campaignHeaderId: headerId, items: [] };
  }
}
