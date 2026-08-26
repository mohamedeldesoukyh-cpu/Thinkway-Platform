"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth/permissions-server";
import {
  addExternalLinkAsset,
  addFileAssetVersion,
  addInternalComment,
  addTextAsset,
  beginFileAssetUpload,
  completeFileAssetUpload,
  createSignedAssetDownloadUrl,
  getCreatorDocumentationCompletenessMap,
  getDocumentationUnitDetail,
  listDocumentationUnits,
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
