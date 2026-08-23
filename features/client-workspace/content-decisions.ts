import { tryCreateServiceRoleClient } from "@/lib/supabase/service-role-client";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CLIENT_CONTENT_DECISIONS,
  type ClientContentDecision,
} from "./content-approval";
import { journeyCanonicalReviewId, pickActiveDecisionReview } from "./journey-state";
import { loadJourneyReviews, resolveClientReviewByToken } from "./load-client-workspace";
import type { ClientReviewRecord } from "./types";

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
  const current = picked.review ?? resolved.review;
  const campaignHeaderId = current.campaignHeaderId?.trim() || resolved.review.campaignHeaderId?.trim() || "";
  if (!campaignHeaderId) {
    return { ok: false, message: "Campaign setup is in progress." };
  }
  return { ok: true, review: current, campaignHeaderId };
}

export async function recordClientContentDecision(input: {
  token: string;
  versionId: string;
  decision: ClientContentDecision;
  comment?: string | null;
}): Promise<{ ok: boolean; message: string }> {
  if (!CLIENT_CONTENT_DECISIONS.includes(input.decision)) {
    return { ok: false, message: "That content decision is not available." };
  }
  const comment = input.comment?.trim() || null;
  const access = await requireCurrentCampaignContentAccess(input.token);
  if (!access.ok) return access;

  const { data: version, error: versionError } = await db()
    .from("deliverable_asset_versions")
    .select("id, asset_id, storage_bucket, storage_path, external_url")
    .eq("id", input.versionId)
    .maybeSingle();
  if (versionError || !version) {
    return { ok: false, message: "That content version was not found." };
  }

  const { data: asset, error: assetError } = await db()
    .from("deliverable_assets")
    .select(
      "id, campaign_header_id, assignment_deliverable_id, assignment_post_schedule_id, medium, archived_at, current_version_id"
    )
    .eq("id", version.asset_id)
    .maybeSingle();
  if (assetError || !asset || asset.archived_at) {
    return { ok: false, message: "That content asset was not found." };
  }
  if (asset.campaign_header_id !== access.campaignHeaderId) {
    return { ok: false, message: "That content does not belong to this campaign." };
  }
  if (asset.medium !== "file" && asset.medium !== "external_link") {
    return { ok: false, message: "That content cannot be reviewed here." };
  }

  const { data: siblingVersions } = await db()
    .from("deliverable_asset_versions")
    .select("id, version_number")
    .eq("asset_id", asset.id);
  const currentVersionId =
    asset.current_version_id ||
    [...(siblingVersions ?? [])].sort(
      (left, right) => Number(left.version_number) - Number(right.version_number)
    ).at(-1)?.id;
  if (currentVersionId && currentVersionId !== version.id) {
    return { ok: false, message: "Only the current content version can be reviewed." };
  }

  const { error } = await db().from("campaign_client_content_decisions").insert({
    campaign_header_id: asset.campaign_header_id,
    assignment_deliverable_id: asset.assignment_deliverable_id,
    assignment_post_schedule_id: asset.assignment_post_schedule_id,
    asset_id: asset.id,
    version_id: version.id,
    review_id: access.review.id,
    journey_id: access.review.journeyId,
    decision: input.decision,
    comment,
    actor_kind: "client",
    actor_label: access.review.clientLabel,
  });
  if (error) return { ok: false, message: error.message };

  return {
    ok: true,
    message:
      input.decision === "approved"
        ? "Content approved."
        : "Changes requested. Thinkway will upload a new version for review.",
  };
}

export async function createClientContentSignedUrl(input: {
  token: string;
  versionId: string;
  mode: "preview" | "download";
}): Promise<{ ok: true; url: string; fileName: string | null } | { ok: false; message: string; status: number }> {
  const access = await requireCurrentCampaignContentAccess(input.token);
  if (!access.ok) return { ok: false, message: access.message, status: 401 };

  const { data: version, error: versionError } = await db()
    .from("deliverable_asset_versions")
    .select("id, asset_id, storage_bucket, storage_path, file_name, mime_type")
    .eq("id", input.versionId)
    .maybeSingle();
  if (versionError || !version?.storage_bucket || !version.storage_path) {
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
  return { ok: true, url: signed.data.signedUrl, fileName: version.file_name };
}
