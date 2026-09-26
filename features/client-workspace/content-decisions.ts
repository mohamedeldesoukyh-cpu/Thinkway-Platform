import { isVersionReleasedToClient } from "@/lib/services/deliverables/client-release";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service-role-client";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CLIENT_CONTENT_DECISIONS,
  type ClientContentDecision,
} from "./content-approval";
import { loadEntitlementForReview } from "./load-entitlement";
import { clientWorkspaceEntitlementBlock, CLIENT_WORKSPACE_LOCKED_MESSAGE } from "./entitlement";
import { isClientWorkspaceSectionOpen } from "./entitlement";
import { journeyCanonicalReviewId, pickActiveDecisionReview } from "./journey-state";
import { loadJourneyReviews, resolveClientReviewByToken } from "./load-client-workspace";
import type { ClientReviewRecord } from "./types";
import { hydrateReviewCampaigns } from "./resolve-review-campaign";

function db(): SupabaseClient {
  const service = tryCreateServiceRoleClient().client;
  if (!service) {
    throw new Error("Client Workspace is temporarily unavailable.");
  }
  return service;
}

export async function requireCurrentCampaignContentAccess(token: string): Promise<
  | { ok: true; review: ClientReviewRecord; campaignHeaderId: string }
  | { ok: false; message: string }
> {
  const resolved = await resolveClientReviewByToken(db(), token);
  if (!resolved.ok) {
    return { ok: false, message: "This review link is invalid or has expired." };
  }
  const members = await loadJourneyReviews(db(), resolved.review);
  const canonicalReviewId = journeyCanonicalReviewId(members, resolved.review.id);
  const picked = pickActiveDecisionReview({
    reviews: members,
    requestedReviewId: resolved.review.id,
    canonicalReviewId,
    tokenBoundReviewId: resolved.review.id,
  });
  if (picked.historical) {
    return {
      ok: false,
      message: "This historical version cannot review campaign content.",
    };
  }
  const [current] = await hydrateReviewCampaigns(db(), [picked.review ?? resolved.review]);
  const entitlementLoaded = await loadEntitlementForReview(db(), current);
  const entitlementBlock = clientWorkspaceEntitlementBlock(
    entitlementLoaded.clientId,
    entitlementLoaded.entitlement
  );
  if (entitlementBlock) {
    return { ok: false, message: entitlementBlock.message };
  }
  if (!isClientWorkspaceSectionOpen(entitlementLoaded.entitlement, "approval")) {
    return { ok: false, message: CLIENT_WORKSPACE_LOCKED_MESSAGE };
  }
  const campaignHeaderId = current.campaignHeaderId?.trim() || resolved.review.campaignHeaderId?.trim() || "";
  if (!campaignHeaderId) {
    return { ok: false, message: "Campaign setup is in progress." };
  }
  return { ok: true, review: current, campaignHeaderId };
}

export type ContentDecisionResult = { ok: boolean; message: string; decidedAt?: string };

export async function recordClientContentDecision(input: {
  token: string; versionId?: string; versionIds?: string[];
  decision: ClientContentDecision; comment?: string | null;
}): Promise<ContentDecisionResult> {
  const access = await requireCurrentCampaignContentAccess(input.token);
  if (!access.ok) return access;
  return recordContentVersionDecisions({ ...input,
    versionIds: input.versionIds ?? (input.versionId ? [input.versionId] : []),
    campaignHeaderId: access.campaignHeaderId, actorKind: "client",
    actorLabel: access.review.clientLabel, reviewId: access.review.id, journeyId: access.review.journeyId });
}

/** Call only after checking token entitlement or internal campaign permissions. */
export async function recordContentVersionDecisions(input: {
  versionIds: string[]; campaignHeaderId: string; decision: ClientContentDecision;
  comment?: string | null; actorKind: "client" | "internal";
  actorLabel?: string | null; actorUserId?: string; reviewId?: string; journeyId?: string | null;
}, client?: SupabaseClient): Promise<ContentDecisionResult> {
  if (!CLIENT_CONTENT_DECISIONS.includes(input.decision)) return { ok: false, message: "Invalid content decision." };
  const ids = [...new Set(input.versionIds)];
  if (!ids.length || ids.length > 100) return { ok: false, message: "Select between 1 and 100 content files." };
  const supabase = client ?? db();
  const { data: versions, error: versionError } = await supabase.from("deliverable_asset_versions")
    .select("id, asset_id, metadata, storage_bucket, storage_path, external_url").in("id", ids);
  if (versionError || versions?.length !== ids.length) return { ok: false, message: "Content version not found." };
  const { data: assets, error: assetError } = await supabase.from("deliverable_assets")
    .select("id, campaign_header_id, assignment_deliverable_id, assignment_post_schedule_id, medium, archived_at, current_version_id, asset_type")
    .in("id", [...new Set(versions.map(v => v.asset_id))]);
  if (assetError || !assets) return { ok: false, message: "Could not load content assets." };
  const missingCurrent = assets.filter(asset => !asset.current_version_id).map(asset => asset.id);
  if (missingCurrent.length) {
    const { data: siblings, error } = await supabase.from("deliverable_asset_versions")
      .select("id, asset_id, version_number").in("asset_id", missingCurrent).order("version_number", { ascending: false });
    if (error) return { ok: false, message: "Could not verify the current content version." };
    for (const asset of assets) if (!asset.current_version_id) asset.current_version_id = siblings?.find(v => v.asset_id === asset.id)?.id ?? null;
  }
  const rows = [];
  for (const version of versions) {
    const asset = assets.find(a => a.id === version.asset_id);
    if (!asset || asset.archived_at || asset.campaign_header_id !== input.campaignHeaderId ||
        !["file", "external_link"].includes(asset.medium) || asset.asset_type === "story_screenshot") {
      return { ok: false, message: "That content cannot be reviewed in this campaign." };
    }
    if (asset.current_version_id !== version.id) return { ok: false, message: "Only the current content version can be reviewed. Refresh to see the latest version." };
    if (!isVersionReleasedToClient(version.metadata)) return { ok: false, message: "Release this content to the client before recording a decision." };
    if (asset.medium === "file" ? !(version.storage_bucket && version.storage_path) : !version.external_url) {
      return { ok: false, message: "The content has not finished saving." };
    }
    rows.push({ campaign_header_id: asset.campaign_header_id, assignment_deliverable_id: asset.assignment_deliverable_id,
      assignment_post_schedule_id: asset.assignment_post_schedule_id, asset_id: asset.id, version_id: version.id,
      review_id: input.reviewId ?? null, journey_id: input.journeyId ?? null, decision: input.decision,
      comment: input.comment?.trim() || null, actor_kind: input.actorKind, actor_label: input.actorLabel ?? null,
      actor_user_id: input.actorUserId ?? null });
  }
  // One atomic insert for the whole selection, with database approval timestamps.
  const { data, error } = await supabase.from("campaign_client_content_decisions").insert(rows).select("decided_at");
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: input.decision === "approved" ? "Content approved." : "Changes requested.", decidedAt: data?.[0]?.decided_at };
}

export async function createClientContentSignedUrl(input: {
  token: string;
  versionId: string;
  mode: "preview" | "download";
}): Promise<
  | { ok: true; url: string; fileName: string | null; mimeType: string | null }
  | { ok: false; message: string; status: number }
> {
  const access = await requireCurrentCampaignContentAccess(input.token);
  if (!access.ok) return { ok: false, message: access.message, status: 401 };

  const { data: version, error: versionError } = await db()
    .from("deliverable_asset_versions")
    .select("id, asset_id, storage_bucket, storage_path, file_name, mime_type, metadata")
    .eq("id", input.versionId)
    .maybeSingle();
  if (versionError || !version?.storage_bucket || !version.storage_path || !isVersionReleasedToClient(version.metadata)) {
    return { ok: false, message: "Original file is not available for this content.", status: 404 };
  }

  const { data: asset, error: assetError } = await db()
    .from("deliverable_assets")
    .select("id, campaign_header_id, medium, archived_at")
    .eq("id", version.asset_id)
    .maybeSingle();
  if (assetError || !asset || asset.archived_at || asset.campaign_header_id !== access.campaignHeaderId) {
    return { ok: false, message: "That content does not belong to this campaign.", status: 404 };
  }
  if (asset.medium !== "file") {
    return { ok: false, message: "Original download is only available for Thinkway files.", status: 404 };
  }

  const signed =
    input.mode === "download"
      ? await db()
          .storage.from(version.storage_bucket)
          .createSignedUrl(version.storage_path, 60 * 15, {
            download: version.file_name || true,
          })
      : await db().storage.from(version.storage_bucket).createSignedUrl(version.storage_path, 60 * 15);
  if (signed.error || !signed.data?.signedUrl) {
    return { ok: false, message: signed.error?.message ?? "Could not open this file.", status: 503 };
  }
  return {
    ok: true,
    url: signed.data.signedUrl,
    fileName: version.file_name,
    mimeType: version.mime_type,
  };
}
