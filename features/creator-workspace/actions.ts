"use server";

import { revalidatePath } from "next/cache";

import { requireCreatorScope } from "@/features/portals/scope";
import {
  creatorOwnsDocumentationUnit,
} from "@/features/creator-workspace/documentation-load";
import {
  beginFileAssetUpload,
  completeFileAssetUpload,
  createSignedAssetDownloadUrl,
  addInternalComment,
  linkDocumentationUnitToPublication,
} from "@/lib/services/deliverables/documentation-service";
import {
  DELIVERABLE_ASSET_MAX_BYTES,
  DELIVERABLE_ASSET_TOO_LARGE_MESSAGE,
  DELIVERABLE_ASSET_TYPES,
  inferDeliverableAssetMime,
  type DeliverableAssetType,
} from "@/lib/services/deliverables/documentation-types";
import { loadCampaignScriptForUnit } from "@/lib/campaign-script/load-master";
import { createCampaignScriptOriginalSignedUrlForUnit } from "@/lib/campaign-script/original-document";
import { parseOptionalSafeExternalUrl } from "@/lib/security/safe-external-url";
import { tryCreateServiceRoleClient } from "@/lib/supabase/service-role-client";
import { requestMetricsCollection } from "@/lib/performance/metrics-collector";
import { filterWritePayload } from "@/lib/campaigns/campaign-publications-schema";
import { getCampaignPublicationsSchema } from "@/lib/campaigns/campaign-publications-schema-runtime";
import { canonicalPlatformKey, coerceDeliverableTypeForPlatform } from "@/lib/campaigns/deliverable-taxonomy";
import { detectSocialPlatformFromContentUrl } from "@/lib/social/platforms";
import type { CampaignScriptMasterView } from "@/lib/campaign-script";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CreatorDocumentationActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; message: string };

function serviceDb(): SupabaseClient | null {
  return tryCreateServiceRoleClient().client;
}

function parseAssetType(value: string): DeliverableAssetType | null {
  return (DELIVERABLE_ASSET_TYPES as readonly string[]).includes(value)
    ? (value as DeliverableAssetType)
    : null;
}

async function requireOwnedUnit(input: {
  campaignHeaderId: string;
  campaignLineId?: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId: string | null;
  permission: "creator_portal.read" | "creator_portal.write";
}) {
  const scoped = await requireCreatorScope(input.permission);
  const owned = await creatorOwnsDocumentationUnit(
    scoped.supabase,
    input.assignmentDeliverableId,
    input.assignmentPostScheduleId
  );
  if (!owned) {
    return { ok: false as const, message: "You cannot access this deliverable." };
  }
  const db = serviceDb();
  if (!db) {
    return { ok: false as const, message: "Creator Workspace is temporarily unavailable." };
  }
  const { data: refs } = await db
    .from("assignment_deliverables")
    .select("campaign_header_id, campaign_line_id")
    .eq("id", input.assignmentDeliverableId)
    .maybeSingle();
  if (
    !refs?.campaign_header_id ||
    refs.campaign_header_id !== input.campaignHeaderId ||
    (input.campaignLineId && refs.campaign_line_id !== input.campaignLineId)
  ) {
    return { ok: false as const, message: "You cannot access this deliverable." };
  }
  return {
    ok: true as const,
    scoped,
    db,
    campaignHeaderId: refs.campaign_header_id as string,
    campaignLineId: refs.campaign_line_id as string,
  };
}

function revalidateCreator(campaignHeaderId: string) {
  revalidatePath("/creator-portal");
  revalidatePath("/creator-portal/deliverables");
  revalidatePath("/creator-portal/campaigns");
  revalidatePath(`/creator-portal/campaigns/${campaignHeaderId}`);
  revalidatePath(`/campaigns/${campaignHeaderId}`);
}

export async function beginCreatorDocumentationUploadAction(input: {
  campaignHeaderId: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId: string | null;
  assetType: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  assetId?: string | null;
}): Promise<
  CreatorDocumentationActionResult<{
    assetId: string;
    versionId: string;
    versionNumber: number;
    storagePath: string;
    bucket: string;
    signedUrl: string;
    token: string;
  }>
> {
  const access = await requireOwnedUnit({
    campaignHeaderId: input.campaignHeaderId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
    permission: "creator_portal.write",
  });
  if (!access.ok) return access;
  const assetType = parseAssetType(input.assetType);
  if (!assetType) return { ok: false, message: "Invalid asset type." };
  if (input.fileSize > DELIVERABLE_ASSET_MAX_BYTES) {
    return { ok: false, message: DELIVERABLE_ASSET_TOO_LARGE_MESSAGE };
  }

  const result = await beginFileAssetUpload(access.db as never, {
    actorId: access.scoped.scope.userId,
    campaignHeaderId: access.campaignHeaderId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
    assetType,
    label: input.fileName,
    assetId: input.assetId,
    fileName: input.fileName,
    mimeType: inferDeliverableAssetMime(input.mimeType, input.fileName),
    fileSize: input.fileSize,
  });
  if (!result.ok) return result;
  return {
    ok: true,
    data: {
      assetId: result.assetId,
      versionId: result.versionId,
      versionNumber: result.versionNumber,
      storagePath: result.storagePath,
      bucket: result.bucket,
      signedUrl: result.signedUrl,
      token: result.token,
    },
  };
}

export async function completeCreatorDocumentationUploadAction(input: {
  campaignHeaderId: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId: string | null;
  assetType: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  assetId: string;
  versionId: string;
  versionNumber: number;
  storagePath: string;
}): Promise<CreatorDocumentationActionResult<{ assetId: string; versionId: string }>> {
  const access = await requireOwnedUnit({
    campaignHeaderId: input.campaignHeaderId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
    permission: "creator_portal.write",
  });
  if (!access.ok) return access;
  const assetType = parseAssetType(input.assetType);
  if (!assetType) return { ok: false, message: "Invalid asset type." };

  const result = await completeFileAssetUpload(access.db as never, {
    actorId: access.scoped.scope.userId,
    campaignHeaderId: access.campaignHeaderId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
    assetType,
    fileName: input.fileName,
    mimeType: inferDeliverableAssetMime(input.mimeType, input.fileName),
    fileSize: input.fileSize,
    assetId: input.assetId,
    versionId: input.versionId,
    versionNumber: input.versionNumber,
    storagePath: input.storagePath,
    releaseToClient: false,
  });
  if (!result.ok) return result;
  revalidateCreator(access.campaignHeaderId);
  return { ok: true, data: { assetId: result.assetId, versionId: result.versionId } };
}

export async function loadCreatorUnitScriptAction(input: {
  campaignHeaderId: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId: string | null;
}): Promise<CreatorDocumentationActionResult<CampaignScriptMasterView | null>> {
  const access = await requireOwnedUnit({
    campaignHeaderId: input.campaignHeaderId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
    permission: "creator_portal.read",
  });
  if (!access.ok) return access;
  const script = await loadCampaignScriptForUnit(access.db as never, {
    campaignHeaderId: access.campaignHeaderId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
  });
  return { ok: true, data: script };
}

export async function downloadCreatorUnitScriptOriginalAction(input: {
  campaignHeaderId: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId: string | null;
}): Promise<CreatorDocumentationActionResult<{ url: string; fileName: string }>> {
  const access = await requireOwnedUnit({
    campaignHeaderId: input.campaignHeaderId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
    permission: "creator_portal.read",
  });
  if (!access.ok) return access;
  const signed = await createCampaignScriptOriginalSignedUrlForUnit(access.db as never, {
    campaignHeaderId: access.campaignHeaderId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
  });
  if (!signed.ok) return signed;
  return { ok: true, data: { url: signed.url, fileName: signed.fileName } };
}

export async function downloadCreatorUnitAssetAction(input: {
  campaignHeaderId: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId: string | null;
  versionId: string;
}): Promise<CreatorDocumentationActionResult<{ url: string }>> {
  const access = await requireOwnedUnit({
    campaignHeaderId: input.campaignHeaderId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
    permission: "creator_portal.read",
  });
  if (!access.ok) return access;
  const result = await createSignedAssetDownloadUrl(access.db as never, {
    actorId: access.scoped.scope.userId,
    campaignHeaderId: access.campaignHeaderId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
    versionId: input.versionId,
  });
  if (!result.ok) return result;
  return { ok: true, data: { url: result.url } };
}

export async function addCreatorUnitCommentAction(input: {
  campaignHeaderId: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId: string | null;
  body: string;
}): Promise<CreatorDocumentationActionResult<null>> {
  const access = await requireOwnedUnit({
    campaignHeaderId: input.campaignHeaderId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
    permission: "creator_portal.write",
  });
  if (!access.ok) return access;
  const result = await addInternalComment(access.db as never, {
    actorId: access.scoped.scope.userId,
    actorDisplayName: access.scoped.scope.influencerName,
    campaignHeaderId: access.campaignHeaderId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
    body: input.body,
    audience: "creator",
  });
  if (!result.ok) return result;
  revalidateCreator(access.campaignHeaderId);
  return { ok: true, data: null };
}

export async function submitCreatorUnitPublicationAction(input: {
  campaignHeaderId: string;
  campaignLineId: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId: string | null;
  platform: string | null;
  deliverableType: string;
  contentUrl: string;
}): Promise<CreatorDocumentationActionResult<{ publicationId: string }>> {
  const access = await requireOwnedUnit({
    campaignHeaderId: input.campaignHeaderId,
    campaignLineId: input.campaignLineId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
    permission: "creator_portal.write",
  });
  if (!access.ok) return access;

  const parsed = parseOptionalSafeExternalUrl(input.contentUrl, {
    allowHttp: true,
    promoteBareDomain: true,
  });
  if (!parsed.ok) return { ok: false, message: parsed.error };
  const contentUrl = parsed.url;
  if (!contentUrl) return { ok: false, message: "Add the live post URL." };

  const urlPlatform = detectSocialPlatformFromContentUrl(contentUrl);
  const platform = canonicalPlatformKey(urlPlatform || input.platform || "") || input.platform || "other";
  const publicationType = coerceDeliverableTypeForPlatform(
    platform,
    input.deliverableType,
    contentUrl
  );

  const schema = await getCampaignPublicationsSchema(access.db);
  const payload = filterWritePayload(
    {
      campaign_header_id: access.campaignHeaderId,
      campaign_line_id: access.campaignLineId,
      influencer_id: access.scoped.scope.influencerId,
      assignment_deliverable_id: input.assignmentDeliverableId,
      assignment_post_schedule_id: input.assignmentPostScheduleId,
      platform,
      publication_type: publicationType,
      content_url: contentUrl,
      publication_date: new Date().toISOString().slice(0, 10),
      status: "published",
      auto_detected: false,
      detected_by: "creator_workspace",
      metrics_refresh_status: "pending",
    },
    schema.columns
  );

  const { data, error } = await access.db
    .from("campaign_publications")
    .insert(payload as never)
    .select("id")
    .single();
  if (error || !data?.id) {
    return { ok: false, message: error?.message ?? "Could not save the publication." };
  }

  const linked = await linkDocumentationUnitToPublication(access.db as never, {
    actorId: access.scoped.scope.userId,
    campaignHeaderId: access.campaignHeaderId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
    publicationId: data.id,
    publishedUrl: contentUrl,
    platform,
  });
  if (!linked.ok) return linked;

  try {
    await requestMetricsCollection(access.db as never, {
      publicationId: data.id,
      campaignHeaderId: access.campaignHeaderId,
      triggeredBy: "auto_create",
    });
  } catch {
    // Publication is saved even if metrics collection is delayed.
  }

  revalidateCreator(access.campaignHeaderId);
  return { ok: true, data: { publicationId: data.id } };
}
