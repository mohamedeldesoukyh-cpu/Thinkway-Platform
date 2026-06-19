import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CAMPAIGN_CLIENT_BO_TYPE,
  friendlyCampaignDocumentError,
} from "@/lib/campaigns/campaign-document-utils";
import {
  removeStorageObject,
  uploadEntityDocument,
} from "@/lib/supabase/storage";
import type { CampaignDocumentType, Database } from "@/types/database";

export async function uploadCampaignDocument(params: {
  supabase: SupabaseClient<Database>;
  userId: string;
  campaignHeaderId: string;
  documentType: CampaignDocumentType;
  file: File;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { supabase, userId, campaignHeaderId, documentType, file } = params;

  const { data: existingDocs, error: existingError } = await supabase
    .from("campaign_documents")
    .select("id, storage_path")
    .eq("campaign_header_id", campaignHeaderId)
    .eq("document_type", documentType);

  if (existingError) {
    return {
      ok: false,
      message: friendlyCampaignDocumentError(existingError.message),
    };
  }

  let uploaded: { storagePath: string; mimeType: string; fileSize: number };
  try {
    uploaded = await uploadEntityDocument({
      supabase,
      bucket: "campaign-documents",
      entityId: campaignHeaderId,
      documentType,
      file,
    });
  } catch (error) {
    return {
      ok: false,
      message: friendlyCampaignDocumentError(
        error instanceof Error ? error.message : "Upload failed."
      ),
    };
  }

  const { error: insertError } = await supabase.from("campaign_documents").insert({
    campaign_header_id: campaignHeaderId,
    document_type: documentType,
    file_name: file.name,
    storage_path: uploaded.storagePath,
    mime_type: uploaded.mimeType,
    file_size: uploaded.fileSize,
    uploaded_by: userId,
  });

  if (insertError) {
    try {
      await removeStorageObject({
        supabase,
        bucket: "campaign-documents",
        storagePath: uploaded.storagePath,
      });
    } catch {
      // Best-effort rollback when the DB row could not be created.
    }
    return {
      ok: false,
      message: friendlyCampaignDocumentError(insertError.message),
    };
  }

  for (const existingDoc of existingDocs ?? []) {
    await supabase.from("campaign_documents").delete().eq("id", existingDoc.id);
    try {
      await removeStorageObject({
        supabase,
        bucket: "campaign-documents",
        storagePath: existingDoc.storage_path,
      });
    } catch {
      // Row removed; storage cleanup is best-effort.
    }
  }

  return { ok: true };
}

export function parseOptionalClientBoFile(
  formData: FormData
): File | null {
  const file = formData.get("client_bo_file");
  if (!(file instanceof File) || file.size === 0) {
    return null;
  }
  return file;
}

export { CAMPAIGN_CLIENT_BO_TYPE };
