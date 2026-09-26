"use server";

import { recordContentVersionDecisions } from "@/features/client-workspace/content-decisions";
import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/permissions-server";
import {
  addExternalLinkAsset,
  addFileAssetVersion,
  addInternalComment,
  addTextAsset,
  archiveFileAsset,
  beginFileAssetUpload,
  completeFileAssetUpload,
  createSignedAssetDownloadUrl,
  getCreatorDocumentationCompletenessMap,
  getDocumentationUnitDetail,
  listDocumentationAssetAggregates,
  listDocumentationUnits,
  reassignFileAsset,
  releaseDeliverableAssetVersionToClient,
} from "@/lib/services/deliverables/documentation-service";
import {
  DELIVERABLE_ASSET_MAX_BYTES,
  DELIVERABLE_ASSET_TOO_LARGE_MESSAGE,
  DELIVERABLE_ASSET_TYPES,
  inferDeliverableAssetMime,
  type DeliverableAssetType,
  type DocumentationCompleteness,
  type DocumentationUnitDetail,
  type DocumentationUnitSummary,
} from "@/lib/services/deliverables/documentation-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readContentReviewDates, validReviewDate, type ContentReviewDates } from "@/lib/services/deliverables/content-review-schedule";

import { readScheduleUnit, persistContentReviewDates, type ReviewScheduleUnit } from "@/lib/services/deliverables/content-review-schedule-service";
import { listAttachedCampaignScriptPresence } from "@/lib/campaign-script/load-master";
import { releasedToClientAtFromMetadata } from "@/lib/services/deliverables/client-release";
import { validatePanelUpload, type PanelSnapshot } from "@/features/campaigns/deliverables-panel-model";
import { completeDeliverableOnBehalfUploadAction } from "./deliverable-on-behalf-actions";

type Supabase = SupabaseClient<Database>;

export type DocumentationActionResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; message: string };

async function getWriteActor(): Promise<
  | { ok: true; supabase: Supabase; userId: string }
  | { ok: false; message: string }
> {
  const supabase = (await createSupabaseServerClient()) as Supabase;
  const auth = await requirePermission(supabase, "campaigns.write");
  if ("error" in auth) {
    const admin = await requirePermission(supabase, "campaigns.admin");
    if ("error" in admin) return { ok: false, message: auth.error };
    return { ok: true, supabase, userId: admin.userId };
  }
  return { ok: true, supabase, userId: auth.userId };
}

async function getReadActor(): Promise<
  | { ok: true; supabase: Supabase; userId: string }
  | { ok: false; message: string }
> {
  const supabase = (await createSupabaseServerClient()) as Supabase;
  const auth = await requirePermission(supabase, "campaigns.read");
  if ("error" in auth) {
    return getWriteActor();
  }
  return { ok: true, supabase, userId: auth.userId };
}

export async function getContentReviewDatesAction(input: ReviewScheduleUnit): Promise<DocumentationActionResult<ContentReviewDates>> {
  const actor = await getReadActor();
  if (!actor.ok) return actor;
  try {
    const row = await readScheduleUnit(actor.supabase, input);
    return { ok: true, data: readContentReviewDates(row.metadata, row.sequence) };
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "Could not load review dates." }; }
}

/** One batch for the Deliverables panel, rather than one detail request per slot. */
export async function getDeliverablesPanelSnapshotAction(input: { campaignHeaderId: string }): Promise<DocumentationActionResult<PanelSnapshot>> {
  const actor = await getReadActor();
  if (!actor.ok) return actor;
  try {
    const db = actor.supabase;
    const [assetResult, deliverableResult, scripts] = await Promise.all([
      db.from('deliverable_assets').select('id, assignment_deliverable_id, assignment_post_schedule_id, asset_type, medium, current_version_id').eq('campaign_header_id', input.campaignHeaderId).is('archived_at', null),
      db.from('assignment_deliverables').select('id, metadata').eq('campaign_header_id', input.campaignHeaderId),
      listAttachedCampaignScriptPresence(db, input.campaignHeaderId),
    ]);
    if (assetResult.error || deliverableResult.error) throw new Error('Could not load deliverables. Please retry.');
    const assets = assetResult.data ?? [];
    const assetIds = assets.map(a => a.id);
    const versions = assetIds.length ? await db.from('deliverable_asset_versions').select('id, asset_id, version_number, file_name, file_size, mime_type, uploaded_at, metadata, storage_path, storage_bucket, external_url, text_body').in('asset_id', assetIds).order('version_number', {ascending:false}) : {data: [], error: null};
    const ids = (versions.data ?? []).map(v => v.id);
    const decisions = ids.length ? await db.from('campaign_client_content_decisions').select('version_id, decision, decided_at, id').in('version_id', ids).order('decided_at', {ascending:false}).order('id', {ascending:false}) : {data: [], error: null};
    if (versions.error || decisions.error) throw new Error('Could not load content status. Please retry.');
    return {ok:true, data:{
      metadata: Object.fromEntries((deliverableResult.data ?? []).map(d => [d.id,d.metadata])),
      scripts: [...scripts.keys()],
      assets: assets.map(a => {
        const v = versions.data?.find(v => v.id === a.current_version_id) ?? versions.data?.find(v => v.asset_id === a.id);
        return {deliverableId:a.assignment_deliverable_id, postId:a.assignment_post_schedule_id, assetId:a.id,
          type:a.asset_type, medium:a.medium, versionId:v?.id ?? null, version:v?.version_number ?? null,
          fileName:v?.file_name ?? null, size:v?.file_size ?? null, mime:v?.mime_type ?? null,
          uploadedAt:v?.uploaded_at ?? null, releasedAt:releasedToClientAtFromMetadata(v?.metadata),
          hasContent:Boolean(v && ((v.storage_bucket && v.storage_path) || v.external_url)),
          text:v?.text_body ?? null, decision:decisions.data?.find(d => d.version_id === v?.id)?.decision ?? null};
      }),
    }};
  } catch (error) { return {ok:false, message:error instanceof Error ? error.message : 'Could not load deliverables.'}; }
}

/** New panel uploads are drafts until the explicit Release action. Existing surfaces retain their behavior. */
export async function beginDeliverablesPanelUploadAction(input: Parameters<typeof beginDeliverableFileUploadAction>[0]) {
  const error = validatePanelUpload(input);
  if (error) return {ok:false as const, message:error};
  return beginDeliverableFileUploadAction(input);
}

export async function completeDeliverablesPanelUploadAction(input: Parameters<typeof completeDeliverableFileUploadAction>[0] & { actingAsCreator?: boolean }) {
  const error = validatePanelUpload(input);
  if (error) return {ok:false as const, message:error};
  if (input.actingAsCreator) return completeDeliverableOnBehalfUploadAction({...input, deferRelease:true});
  const actor = await getWriteActor();
  if (!actor.ok) return actor;
  const assetType = parseAssetType(input.assetType);
  if (!assetType) return {ok:false as const,message:'Invalid asset type.'};
  const result = await completeFileAssetUpload(actor.supabase, {...input, assetType, actorId:actor.userId, releaseToClient:false});
  if (!result.ok) return result;
  revalidatePath('/campaigns', 'layout');
  return {ok:true as const,data:{assetId:result.assetId,versionId:result.versionId}};
}

export async function saveContentReviewDatesAction(input: ReviewScheduleUnit & { dates: ContentReviewDates; previous: ContentReviewDates }): Promise<DocumentationActionResult<ContentReviewDates>> {
  const actor = await getWriteActor();
  if (!actor.ok) return actor;
  if (!input.dates || [input.dates.script, input.dates.draft].some(value => value !== null && !validReviewDate(value))) {
    return { ok: false, message: "Enter valid expected review dates." };
  }
  try {
    const result = await persistContentReviewDates(actor.supabase, actor.userId, input);
    if (!result.ok) return result;
    revalidatePath("/campaigns", "layout");
    revalidatePath("/review", "layout");
    return result;
  } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "Could not save review dates." }; }
}

function parseAssetType(value: string): DeliverableAssetType | null {
  return (DELIVERABLE_ASSET_TYPES as readonly string[]).includes(value)
    ? (value as DeliverableAssetType)
    : null;
}

export async function listDeliverableDocumentationAction(input: {
  campaignHeaderId: string;
}): Promise<DocumentationActionResult<DocumentationUnitSummary[]>> {
  const actor = await getReadActor();
  if (!actor.ok) return actor;
  const data = await listDocumentationUnits(
    actor.supabase,
    input.campaignHeaderId
  );
  return { ok: true, data };
}

export async function listDeliverableDocumentationAggregatesAction(input: {
  campaignHeaderId: string;
}): Promise<
  DocumentationActionResult<
    Record<
      string,
      {
        contentAssetCount: number;
        totalAssetCount: number;
        revisionCount: number;
        latestVersionLabel: string | null;
        lastUpdatedAt: string | null;
        publicationLinkCount: number;
      }
    >
  >
> {
  const actor = await getReadActor();
  if (!actor.ok) return actor;
  const data = await listDocumentationAssetAggregates(
    actor.supabase,
    input.campaignHeaderId
  );
  return { ok: true, data };
}

export async function getDeliverableDocumentationDetailAction(input: {
  campaignHeaderId: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId: string | null;
}): Promise<DocumentationActionResult<DocumentationUnitDetail | null>> {
  const actor = await getReadActor();
  if (!actor.ok) return actor;
  const data = await getDocumentationUnitDetail(actor.supabase, input);
  return { ok: true, data };
}

export async function getCreatorDocumentationCompletenessAction(input: {
  campaignHeaderId: string;
}): Promise<
  DocumentationActionResult<Record<string, DocumentationCompleteness>>
> {
  const actor = await getReadActor();
  if (!actor.ok) return actor;
  const map = await getCreatorDocumentationCompletenessMap(
    actor.supabase,
    input.campaignHeaderId
  );
  return { ok: true, data: Object.fromEntries(map.entries()) };
}

export async function addDeliverableExternalLinkAction(input: {
  campaignHeaderId: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId: string | null;
  assetType: string;
  label?: string | null;
  externalUrl: string;
  deferRelease?: boolean;
}): Promise<DocumentationActionResult<{ assetId: string }>> {
  const actor = await getWriteActor();
  if (!actor.ok) return actor;
  const assetType = parseAssetType(input.assetType);
  if (!assetType) return { ok: false, message: "Invalid asset type." };

  const result = await addExternalLinkAsset(actor.supabase, {
    actorId: actor.userId,
    campaignHeaderId: input.campaignHeaderId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
    assetType,
    label: input.label,
    externalUrl: input.externalUrl,
    releaseToClient: input.deferRelease ? false : undefined,
  });
  if (!result.ok) return result;
  revalidatePath(`/campaigns/${input.campaignHeaderId}`);
  return { ok: true, data: { assetId: result.assetId } };
}

export async function addDeliverableTextAssetAction(input: {
  campaignHeaderId: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId: string | null;
  assetType: string;
  label?: string | null;
  textBody: string;
}): Promise<DocumentationActionResult<{ assetId: string }>> {
  const actor = await getWriteActor();
  if (!actor.ok) return actor;
  const assetType = parseAssetType(input.assetType);
  if (!assetType) return { ok: false, message: "Invalid asset type." };

  const result = await addTextAsset(actor.supabase, {
    actorId: actor.userId,
    campaignHeaderId: input.campaignHeaderId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
    assetType,
    label: input.label,
    textBody: input.textBody,
  });
  if (!result.ok) return result;
  revalidatePath(`/campaigns/${input.campaignHeaderId}`);
  return { ok: true, data: { assetId: result.assetId } };
}

export async function uploadDeliverableFileAssetAction(input: {
  campaignHeaderId: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId: string | null;
  assetType: string;
  label?: string | null;
  assetId?: string | null;
  fileName: string;
  mimeType: string;
  fileBase64: string;
}): Promise<DocumentationActionResult<{ assetId: string; versionId: string }>> {
  const actor = await getWriteActor();
  if (!actor.ok) return actor;
  const assetType = parseAssetType(input.assetType);
  if (!assetType) return { ok: false, message: "Invalid asset type." };

  const binary = Buffer.from(input.fileBase64, "base64");
  const result = await addFileAssetVersion(actor.supabase, {
    actorId: actor.userId,
    campaignHeaderId: input.campaignHeaderId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
    assetType,
    label: input.label,
    assetId: input.assetId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileSize: binary.byteLength,
    fileBytes: binary.buffer.slice(
      binary.byteOffset,
      binary.byteOffset + binary.byteLength
    ),
  });
  if (!result.ok) return result;
  revalidatePath(`/campaigns/${input.campaignHeaderId}`);
  return {
    ok: true,
    data: { assetId: result.assetId, versionId: result.versionId },
  };
}

export async function beginDeliverableFileUploadAction(input: {
  campaignHeaderId: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId: string | null;
  assetType: string;
  label?: string | null;
  assetId?: string | null;
  fileName: string;
  mimeType: string;
  fileSize: number;
}): Promise<
  DocumentationActionResult<{
    assetId: string;
    versionId: string;
    versionNumber: number;
    storagePath: string;
    bucket: string;
    signedUrl: string;
    token: string;
  }>
> {
  const actor = await getWriteActor();
  if (!actor.ok) return actor;
  const assetType = parseAssetType(input.assetType);
  if (!assetType) return { ok: false, message: "Invalid asset type." };
  if (input.fileSize > DELIVERABLE_ASSET_MAX_BYTES) {
    return { ok: false, message: DELIVERABLE_ASSET_TOO_LARGE_MESSAGE };
  }

  const result = await beginFileAssetUpload(actor.supabase, {
    actorId: actor.userId,
    campaignHeaderId: input.campaignHeaderId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
    assetType,
    label: input.label,
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

export async function completeDeliverableFileUploadAction(input: {
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
  const actor = await getWriteActor();
  if (!actor.ok) return actor;
  const assetType = parseAssetType(input.assetType);
  if (!assetType) return { ok: false, message: "Invalid asset type." };

  const result = await completeFileAssetUpload(actor.supabase, {
    actorId: actor.userId,
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
  });
  if (!result.ok) return result;
  revalidatePath(`/campaigns/${input.campaignHeaderId}`);
  return {
    ok: true,
    data: { assetId: result.assetId, versionId: result.versionId },
  };
}

export async function addDeliverableInternalCommentAction(input: {
  campaignHeaderId: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId: string | null;
  body: string;
}): Promise<DocumentationActionResult<null>> {
  const actor = await getWriteActor();
  if (!actor.ok) return actor;
  const result = await addInternalComment(actor.supabase, {
    actorId: actor.userId,
    campaignHeaderId: input.campaignHeaderId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
    body: input.body,
    audience: "internal",
  });
  if (!result.ok) return result;
  revalidatePath(`/campaigns/${input.campaignHeaderId}`);
  return { ok: true, data: null };
}

export async function archiveDeliverableAssetAction(input: {
  campaignHeaderId: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId: string | null;
  assetId: string;
}): Promise<DocumentationActionResult<null>> {
  const actor = await getWriteActor();
  if (!actor.ok) return actor;
  const result = await archiveFileAsset(actor.supabase, {
    actorId: actor.userId,
    ...input,
  });
  if (!result.ok) return result;
  revalidatePath(`/campaigns/${input.campaignHeaderId}`);
  return { ok: true, data: null };
}

export async function reassignDeliverableAssetAction(input: {
  campaignHeaderId: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId: string | null;
  assetId: string;
  toAssignmentDeliverableId: string;
  toAssignmentPostScheduleId: string | null;
}): Promise<DocumentationActionResult<null>> {
  const actor = await getWriteActor();
  if (!actor.ok) return actor;
  const result = await reassignFileAsset(actor.supabase, {
    actorId: actor.userId,
    ...input,
  });
  if (!result.ok) return result;
  revalidatePath(`/campaigns/${input.campaignHeaderId}`);
  return { ok: true, data: null };
}

export async function getDeliverableAssetDownloadUrlAction(input: {
  campaignHeaderId: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId: string | null;
  versionId: string;
}): Promise<DocumentationActionResult<{ url: string }>> {
  const actor = await getReadActor();
  if (!actor.ok) return actor;
  const result = await createSignedAssetDownloadUrl(actor.supabase, {
    actorId: actor.userId,
    ...input,
  });
  if (!result.ok) return result;
  return { ok: true, data: { url: result.url } };
}

export async function releaseDeliverableVersionToClientAction(input: {
  campaignHeaderId: string;
  versionId: string;
}): Promise<DocumentationActionResult<null>> {
  const actor = await getWriteActor();
  if (!actor.ok) return actor;
  const result = await releaseDeliverableAssetVersionToClient(actor.supabase, {
    actorId: actor.userId,
    campaignHeaderId: input.campaignHeaderId,
    versionId: input.versionId,
  });
  if (!result.ok) return result;
  revalidatePath(`/campaigns/${input.campaignHeaderId}`);
  return { ok: true, data: null };
}

/** Team decisions use the same append-only record consumed by the client portal. */
export async function decideDeliverableContentAction(input: {
  campaignHeaderId: string; versionId: string; decision: "approved" | "changes_requested"; comment?: string;
}) {
  const actor = await getWriteActor();
  if (!actor.ok) return actor;
  // Query through the user's RLS client before the service-role write.
  const { data: campaign, error } = await actor.supabase.from("campaign_headers").select("id").eq("id", input.campaignHeaderId).maybeSingle();
  if (error || !campaign) return { ok: false, message: "Campaign access denied." };
  return recordContentVersionDecisions({ ...input, versionIds: [input.versionId], actorKind: "internal", actorUserId: actor.userId, actorLabel: "Thinkway team" });
}
