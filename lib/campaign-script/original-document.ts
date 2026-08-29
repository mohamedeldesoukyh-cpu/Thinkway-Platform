import { randomUUID } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { deliverableAssetPreviewKind } from "@/lib/services/deliverables/documentation-types";
import type { Database } from "@/types/database";

import { loadCampaignScriptForUnit } from "./load-master";
import { CAMPAIGN_SCRIPT_FILE_MAX_BYTES } from "./types";

type Supabase = SupabaseClient<Database>;

export const CAMPAIGN_SCRIPT_ORIGINAL_BUCKET = "deliverable-assets";
export const CAMPAIGN_SCRIPT_ORIGINAL_QTY1_SLOT = "deliverable";
const SIGNED_URL_SECONDS = 60 * 15;

export type CampaignScriptOriginalDocument = {
  fileName: string;
  storageBucket: string;
  storagePath: string;
  mimeType: string | null;
  fileSize: number;
};

export type CampaignScriptOriginalUpload = {
  fileName: string;
  mimeType?: string | null;
  bytes: Buffer;
};

export type CampaignScriptUnitPresence = {
  scriptId: string;
  originalFileName: string | null;
  originalMimeType: string | null;
  hasOriginalDocument: boolean;
};

export function sanitizeCampaignScriptOriginalFileName(fileName: string): string {
  const base = fileName.trim().replace(/[/\\]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_");
  const trimmed = base.replace(/^_+|_+$/g, "").slice(0, 120);
  return trimmed || "original-script";
}

export function campaignScriptOriginalMimeType(
  fileName: string,
  mimeType?: string | null
): string {
  const mime = (mimeType ?? "").trim().toLowerCase();
  if (mime === "application/pdf") return "application/pdf";
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return mime;
  }
  if (mime === "application/msword") return mime;
  if (mime.startsWith("text/")) return "text/plain";
  const ext = fileName.trim().toLowerCase().split(".").pop() ?? "";
  if (ext === "pdf") return "application/pdf";
  if (ext === "docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (ext === "doc") return "application/msword";
  return "text/plain";
}

export function campaignScriptOriginalSlot(
  assignmentPostScheduleId: string | null | undefined
): string {
  return assignmentPostScheduleId?.trim() || CAMPAIGN_SCRIPT_ORIGINAL_QTY1_SLOT;
}

export function buildCampaignScriptOriginalStoragePath(input: {
  campaignHeaderId: string;
  assignmentDeliverableId: string;
  assignmentPostScheduleId?: string | null;
  revisionId: string;
  fileName: string;
}): string {
  const fileName = sanitizeCampaignScriptOriginalFileName(input.fileName);
  return [
    input.campaignHeaderId.trim(),
    input.assignmentDeliverableId.trim(),
    campaignScriptOriginalSlot(input.assignmentPostScheduleId),
    input.revisionId.trim(),
    fileName,
  ].join("/");
}

export function campaignScriptOriginalPathBelongsToUnit(
  storagePath: string,
  unit: {
    campaignHeaderId: string;
    assignmentDeliverableId: string;
    assignmentPostScheduleId?: string | null;
  }
): boolean {
  const parts = storagePath.split("/").filter(Boolean);
  if (parts.length < 5) return false;
  return (
    parts[0] === unit.campaignHeaderId.trim() &&
    parts[1] === unit.assignmentDeliverableId.trim() &&
    parts[2] === campaignScriptOriginalSlot(unit.assignmentPostScheduleId)
  );
}

export function resolveOriginalDocumentForSave(input: {
  incoming?: CampaignScriptOriginalDocument | null;
  previous?: CampaignScriptOriginalDocument | null;
}): CampaignScriptOriginalDocument | null {
  if (input.incoming) return input.incoming;
  return input.previous ?? null;
}

export function campaignScriptOriginalPreviewKind(
  mimeType: string | null | undefined,
  fileName: string | null | undefined
): "pdf" | "image" | null {
  const kind = deliverableAssetPreviewKind(mimeType, fileName);
  if (kind === "pdf" || kind === "image") return kind;
  return null;
}

export const CAMPAIGN_SCRIPT_ORIGINAL_DOCUMENT_KINDS = ["pdf", "word", "text", "file"] as const;
export type CampaignScriptOriginalDocumentKind =
  (typeof CAMPAIGN_SCRIPT_ORIGINAL_DOCUMENT_KINDS)[number];

export function campaignScriptOriginalFileExtension(fileName: string): string {
  const name = fileName.trim().toLowerCase();
  for (const ext of ["docx", "doc", "pdf", "txt", "md"] as const) {
    if (new RegExp(`\\.${ext}(?:\\b|$)`).test(name)) return ext;
  }
  return name.split(".").pop()?.split(/[\s_]+/)[0] ?? "";
}

export function campaignScriptOriginalDocumentKind(
  mimeType?: string | null,
  fileName?: string | null
): CampaignScriptOriginalDocumentKind {
  const ext = campaignScriptOriginalFileExtension(fileName ?? "");
  const mime = (mimeType ?? "").trim().toLowerCase();
  if (ext === "pdf" || mime === "application/pdf") return "pdf";
  if (
    ext === "docx" ||
    ext === "doc" ||
    mime === "application/msword" ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "word";
  }
  if (ext === "txt" || ext === "md" || mime.startsWith("text/")) return "text";
  return "file";
}

export function campaignScriptOriginalDocumentKindLabel(
  kind: CampaignScriptOriginalDocumentKind
): string {
  if (kind === "pdf") return "PDF";
  if (kind === "word") return "Word";
  if (kind === "text") return "Text";
  return "File";
}

export async function storeCampaignScriptOriginalDocument(
  supabase: Supabase,
  input: {
    campaignHeaderId: string;
    assignmentDeliverableId: string;
    assignmentPostScheduleId?: string | null;
    revisionId?: string;
    upload: CampaignScriptOriginalUpload;
  }
): Promise<
  | { ok: true; document: CampaignScriptOriginalDocument; revisionId: string }
  | { ok: false; message: string }
> {
  if (input.upload.bytes.byteLength > CAMPAIGN_SCRIPT_FILE_MAX_BYTES) {
    return { ok: false, message: "That file is too large. Upload a script file under 8 MB." };
  }
  const revisionId = input.revisionId?.trim() || randomUUID();
  const fileName = sanitizeCampaignScriptOriginalFileName(input.upload.fileName);
  const mimeType = campaignScriptOriginalMimeType(input.upload.fileName, input.upload.mimeType);
  const storagePath = buildCampaignScriptOriginalStoragePath({
    campaignHeaderId: input.campaignHeaderId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
    revisionId,
    fileName,
  });
  const uploaded = await supabase.storage.from(CAMPAIGN_SCRIPT_ORIGINAL_BUCKET).upload(
    storagePath,
    input.upload.bytes,
    { contentType: mimeType, upsert: false }
  );
  if (uploaded.error) {
    return { ok: false, message: uploaded.error.message };
  }
  return {
    ok: true,
    revisionId,
    document: {
      fileName: input.upload.fileName.trim() || fileName,
      storageBucket: CAMPAIGN_SCRIPT_ORIGINAL_BUCKET,
      storagePath,
      mimeType,
      fileSize: input.upload.bytes.byteLength,
    },
  };
}

export async function createCampaignScriptOriginalSignedUrl(
  supabase: Supabase,
  input: {
    campaignHeaderId: string;
    assignmentDeliverableId: string;
    assignmentPostScheduleId?: string | null;
    original: CampaignScriptOriginalDocument | null | undefined;
    download?: boolean;
  }
): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
  const original = input.original;
  if (!original?.storagePath || !original.storageBucket) {
    return { ok: false, message: "This deliverable has no original script document." };
  }
  if (
    !campaignScriptOriginalPathBelongsToUnit(original.storagePath, {
      campaignHeaderId: input.campaignHeaderId,
      assignmentDeliverableId: input.assignmentDeliverableId,
      assignmentPostScheduleId: input.assignmentPostScheduleId,
    })
  ) {
    return { ok: false, message: "Original document does not belong to this deliverable." };
  }
  const signed = await supabase.storage.from(original.storageBucket).createSignedUrl(
    original.storagePath,
    SIGNED_URL_SECONDS,
    input.download ? { download: original.fileName } : undefined
  );
  if (signed.error || !signed.data?.signedUrl) {
    return { ok: false, message: signed.error?.message ?? "Could not open the original document." };
  }
  return { ok: true, url: signed.data.signedUrl };
}

export async function createCampaignScriptOriginalSignedUrlForUnit(
  supabase: Supabase,
  input: {
    campaignHeaderId: string;
    assignmentDeliverableId: string;
    assignmentPostScheduleId?: string | null;
    download?: boolean;
  }
): Promise<
  | { ok: true; url: string; fileName: string; mimeType: string | null }
  | { ok: false; message: string }
> {
  const script = await loadCampaignScriptForUnit(supabase, {
    campaignHeaderId: input.campaignHeaderId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
  });
  const signed = await createCampaignScriptOriginalSignedUrl(supabase, {
    campaignHeaderId: input.campaignHeaderId,
    assignmentDeliverableId: input.assignmentDeliverableId,
    assignmentPostScheduleId: input.assignmentPostScheduleId,
    original: script
      ? {
          fileName: script.originalFileName ?? "original-script",
          storageBucket: script.originalStorageBucket ?? "",
          storagePath: script.originalStoragePath ?? "",
          mimeType: script.originalMimeType,
          fileSize: script.originalFileSize ?? 0,
        }
      : null,
    download: input.download,
  });
  if (!signed.ok) return signed;
  return {
    ok: true,
    url: signed.url,
    fileName: script?.originalFileName ?? "original-script",
    mimeType: script?.originalMimeType ?? null,
  };
}
