"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/permissions-server";
import { isPortalActor, resolveWorkspaceActor } from "@/lib/security/workspace-actor";
import {
  addExternalLinkAsset,
  addInternalComment,
  addTextAsset,
  completeFileAssetUpload,
  linkDocumentationUnitToPublication,
} from "@/lib/services/deliverables/documentation-service";
import {
  inferDeliverableAssetMime,
  type DeliverableAssetType,
  DELIVERABLE_ASSET_TYPES,
} from "@/lib/services/deliverables/documentation-types";
import {
  CREATOR_ON_BEHALF_ACTOR_LABEL,
  ON_BEHALF_INTERNAL_ONLY_MESSAGE,
  ON_BEHALF_NO_CREATOR_MESSAGE,
  onBehalfKindForVersionNumber,
  type OnBehalfAttribution,
} from "@/lib/services/deliverables/on-behalf";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseOptionalSafeExternalUrl } from "@/lib/security/safe-external-url";
import { filterWritePayload } from "@/lib/campaigns/campaign-publications-schema";
import { getCampaignPublicationsSchema } from "@/lib/campaigns/campaign-publications-schema-runtime";
import { canonicalPlatformKey, coerceDeliverableTypeForPlatform } from "@/lib/campaigns/deliverable-taxonomy";
import { detectSocialPlatformFromContentUrl } from "@/lib/social/platforms";
import { requestMetricsCollection } from "@/lib/performance/metrics-collector";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { DocumentationActionResult } from "./deliverable-documentation-actions";

type Supabase = SupabaseClient<Database>;

async function getOnBehalfActor(): Promise<
  | { ok: true; supabase: Supabase; userId: string }
  | { ok: false; message: string }
> {
  const supabase = (await createSupabaseServerClient()) as Supabase;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const workspace = await resolveWorkspaceActor(supabase, user.id);
    if (isPortalActor(workspace.kind)) {
      return { ok: false, message: ON_BEHALF_INTERNAL_ONLY_MESSAGE };
    }
  }
  const auth = await requirePermission(supabase, "campaigns.write");
  if ("error" in auth) {
    const admin = await requirePermission(supabase, "campaigns.admin");
    if ("error" in admin) return { ok: false, message: auth.error };
    return { ok: true, supabase, userId: admin.userId };
  }
  return { ok: true, supabase, userId: auth.userId };
}

function parseAssetType(value: string): DeliverableAssetType | null {
  return (DELIVERABLE_ASSET_TYPES as readonly string[]).includes(value)
    ? (value as DeliverableAssetType)
    : null;
}

function revalidateOnBehalf(campaignHeaderId: string) {
  revalidatePath(`/campaigns/${campaignHeaderId}`);
  revalidatePath("/creator-portal");
  revalidatePath("/creator-portal/deliverables");
  revalidatePath("/creator-portal/campaigns");
  revalidatePath(`/creator-portal/campaigns/${campaignHeaderId}`);
}

export async function resolveAssignedInfluencerId(
  supabase: Supabase,
  assignmentDeliverableId: string
): Promise<string | null> {
  const { data: deliverable } = await supabase
    .from("assignment_deliverables")
    .select("campaign_line_id, campaign_header_id")
    .eq("id", assignmentDeliverableId)
    .maybeSingle();
  const lineId = deliverable?.campaign_line_id as string | undefined;
  if (!lineId) return null;

  const { data: assignment } = await supabase
    .from("campaign_influencers")
    .select("influencer_id")
    .eq("campaign_line_id", lineId)
    .limit(1)
    .maybeSingle();
  if (typeof assignment?.influencer_id === "string" && assignment.influencer_id) {
    return assignment.influencer_id;
  }

  const { data: line } = await supabase
    .from("campaign_lines")
    .select("metadata")
    .eq("id", lineId)
    .maybeSingle();
  const metadata = (line?.metadata ?? {}) as Record<string, unknown>;
  const nested = metadata.influencer_assignment;
  const fromMeta =
    nested && typeof nested === "object" && !Array.isArray(nested)
      ? (nested as Record<string, unknown>).influencer_id
      : null;
  return typeof fromMeta === "string" && fromMeta.trim() ? fromMeta.trim() : null;
}

async function requireOnBehalfUnit(input: {
  campaignHeaderId: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId?: string | null;
}): Promise<
  | {
      ok: true;
      supabase: Supabase;
      userId: string;
      attribution: OnBehalfAttribution;
      campaignLineId: string;
    }
  | { ok: false; message: string }
> {
  const actor = await getOnBehalfActor();
  if (!actor.ok) return actor;
  const { data: deliverable } = await actor.supabase
    .from("assignment_deliverables")
    .select("id, campaign_header_id, campaign_line_id")
    .eq("id", input.assignmentDeliverableId)
    .maybeSingle();
  if (
    !deliverable?.id ||
    deliverable.campaign_header_id !== input.campaignHeaderId ||
    !deliverable.campaign_line_id
  ) {
    return { ok: false, message: "This documentation unit was not found." };
  }
  if (input.assignmentPostScheduleId) {
    const { data: post } = await actor.supabase
      .from("assignment_post_schedule")
      .select("id, assignment_deliverable_id")
      .eq("id", input.assignmentPostScheduleId)
      .maybeSingle();
    if (
      !post?.id ||
      post.assignment_deliverable_id !== input.assignmentDeliverableId
    ) {
      return { ok: false, message: "This documentation unit was not found." };
    }
  }
  const influencerId = await resolveAssignedInfluencerId(
    actor.supabase,
    input.assignmentDeliverableId
  );
  if (!influencerId) {
    return { ok: false, message: ON_BEHALF_NO_CREATOR_MESSAGE };
  }
  return {
    ok: true,
    supabase: actor.supabase,
    userId: actor.userId,
    campaignLineId: deliverable.campaign_line_id as string,
    attribution: {
      influencerId,
      actorUserId: actor.userId,
      kind: "submit",
    },
  };
}

export async function completeDeliverableOnBehalfUploadAction(input: {
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
}): Promise<DocumentationActionResult<{ assetId: string; versionId: string }>> {
  const access = await requireOnBehalfUnit({
    campaignHeaderId: input.campaignHeaderId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
  });
  if (!access.ok) return access;
  const assetType = parseAssetType(input.assetType);
  if (!assetType) return { ok: false, message: "Invalid asset type." };

  const result = await completeFileAssetUpload(access.supabase, {
    actorId: access.userId,
    campaignHeaderId: input.campaignHeaderId,
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
    onBehalf: {
      ...access.attribution,
      kind: onBehalfKindForVersionNumber(input.versionNumber),
    },
  });
  if (!result.ok) return result;
  revalidateOnBehalf(input.campaignHeaderId);
  return {
    ok: true,
    data: { assetId: result.assetId, versionId: result.versionId },
  };
}

export async function addDeliverableOnBehalfExternalLinkAction(input: {
  campaignHeaderId: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId: string | null;
  assetType: string;
  label?: string | null;
  externalUrl: string;
}): Promise<DocumentationActionResult<{ assetId: string }>> {
  const access = await requireOnBehalfUnit({
    campaignHeaderId: input.campaignHeaderId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
  });
  if (!access.ok) return access;
  const assetType = parseAssetType(input.assetType);
  if (!assetType) return { ok: false, message: "Invalid asset type." };

  const result = await addExternalLinkAsset(access.supabase, {
    actorId: access.userId,
    campaignHeaderId: input.campaignHeaderId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
    assetType,
    label: input.label,
    externalUrl: input.externalUrl,
    releaseToClient: false,
    onBehalf: { ...access.attribution, kind: "submit" },
  });
  if (!result.ok) return result;
  revalidateOnBehalf(input.campaignHeaderId);
  return { ok: true, data: { assetId: result.assetId } };
}

export async function addDeliverableOnBehalfTextAction(input: {
  campaignHeaderId: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId: string | null;
  assetType: string;
  label?: string | null;
  textBody: string;
}): Promise<DocumentationActionResult<{ assetId: string }>> {
  const access = await requireOnBehalfUnit({
    campaignHeaderId: input.campaignHeaderId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
  });
  if (!access.ok) return access;
  const assetType = parseAssetType(input.assetType);
  if (!assetType) return { ok: false, message: "Invalid asset type." };

  const result = await addTextAsset(access.supabase, {
    actorId: access.userId,
    campaignHeaderId: input.campaignHeaderId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
    assetType,
    label: input.label,
    textBody: input.textBody,
    releaseToClient: false,
    onBehalf: { ...access.attribution, kind: "submit" },
  });
  if (!result.ok) return result;
  revalidateOnBehalf(input.campaignHeaderId);
  return { ok: true, data: { assetId: result.assetId } };
}

export async function addDeliverableOnBehalfCreatorNoteAction(input: {
  campaignHeaderId: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId: string | null;
  body: string;
}): Promise<DocumentationActionResult<null>> {
  const access = await requireOnBehalfUnit({
    campaignHeaderId: input.campaignHeaderId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
  });
  if (!access.ok) return access;
  const result = await addInternalComment(access.supabase, {
    actorId: access.userId,
    actorDisplayName: CREATOR_ON_BEHALF_ACTOR_LABEL,
    campaignHeaderId: input.campaignHeaderId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
    body: input.body,
    audience: "creator",
    onBehalf: { ...access.attribution, kind: "update" },
  });
  if (!result.ok) return result;
  revalidateOnBehalf(input.campaignHeaderId);
  return { ok: true, data: null };
}

export async function submitDeliverableOnBehalfPublicationAction(input: {
  campaignHeaderId: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId: string | null;
  platform: string | null;
  deliverableType: string;
  contentUrl: string;
}): Promise<DocumentationActionResult<{ publicationId: string }>> {
  const access = await requireOnBehalfUnit({
    campaignHeaderId: input.campaignHeaderId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
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
  const platform =
    canonicalPlatformKey(urlPlatform || input.platform || "") ||
    input.platform ||
    "other";
  const publicationType = coerceDeliverableTypeForPlatform(
    platform,
    input.deliverableType,
    contentUrl
  );

  const schema = await getCampaignPublicationsSchema(access.supabase);
  const payload = filterWritePayload(
    {
      campaign_header_id: input.campaignHeaderId,
      campaign_line_id: access.campaignLineId,
      influencer_id: access.attribution.influencerId,
      assignment_deliverable_id: input.assignmentDeliverableId,
      assignment_post_schedule_id: input.assignmentPostScheduleId,
      platform,
      publication_type: publicationType,
      content_url: contentUrl,
      publication_date: new Date().toISOString().slice(0, 10),
      status: "published",
      auto_detected: false,
      detected_by: "manual",
      metrics_refresh_status: "pending",
    },
    schema.columns
  );

  const { data, error } = await access.supabase
    .from("campaign_publications")
    .insert(payload as never)
    .select("id")
    .single();
  if (error || !data?.id) {
    return { ok: false, message: error?.message ?? "Could not save the publication." };
  }

  const linked = await linkDocumentationUnitToPublication(access.supabase, {
    actorId: access.userId,
    campaignHeaderId: input.campaignHeaderId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
    publicationId: data.id,
    publishedUrl: contentUrl,
    platform,
    onBehalf: { ...access.attribution, kind: "update" },
  });
  if (!linked.ok) return linked;

  try {
    await requestMetricsCollection(access.supabase as never, {
      publicationId: data.id,
      campaignHeaderId: input.campaignHeaderId,
      triggeredBy: "auto_create",
    });
  } catch {
    // Publication is saved even if metrics collection is delayed.
  }

  revalidateOnBehalf(input.campaignHeaderId);
  return { ok: true, data: { publicationId: data.id } };
}
