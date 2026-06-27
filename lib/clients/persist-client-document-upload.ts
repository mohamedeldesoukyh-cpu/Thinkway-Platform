import { revalidatePath } from "next/cache";

import { uploadClientDocumentSchema } from "@/lib/domains/clients/document-schemas";
import { friendlyClientDocumentError } from "@/lib/clients/client-document-utils";
import {
  removeStorageObject,
  uploadEntityDocument,
} from "@/lib/supabase/storage";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PersistClientDocumentUploadResult } from "@/lib/domains/document/types";

export type { PersistClientDocumentUploadResult } from "@/lib/domains/document/types";

export async function persistClientDocumentUpload(params: {
  supabase: SupabaseClient<Database>;
  userId: string;
  clientId: string;
  documentType: string;
  file: File;
  expiresAt?: string | null;
  revalidate?: boolean;
}): Promise<PersistClientDocumentUploadResult> {
  const parsed = uploadClientDocumentSchema.safeParse({
    client_id: params.clientId,
    document_type: params.documentType,
    expires_at: params.expiresAt ?? "",
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  if (params.file.size === 0) {
    return {
      ok: false,
      message: "Please choose a file to upload.",
      fieldErrors: { file: ["File is required"] },
    };
  }

  const { data: existingDocs, error: existingError } = await params.supabase
    .from("client_documents")
    .select("id, storage_path")
    .eq("client_id", parsed.data.client_id)
    .eq("document_type", parsed.data.document_type);

  if (existingError) {
    return {
      ok: false,
      message: friendlyClientDocumentError(existingError.message),
    };
  }

  const uploaded = await uploadEntityDocument({
    supabase: params.supabase,
    bucket: "client-documents",
    entityId: parsed.data.client_id,
    documentType: parsed.data.document_type,
    file: params.file,
  });

  const { data: insertedDoc, error } = await params.supabase
    .from("client_documents")
    .insert({
      client_id: parsed.data.client_id,
      document_type: parsed.data.document_type,
      file_name: params.file.name,
      storage_path: uploaded.storagePath,
      mime_type: uploaded.mimeType,
      file_size: uploaded.fileSize,
      expires_at: parsed.data.expires_at,
      uploaded_by: params.userId,
    })
    .select("*")
    .single();

  if (error || !insertedDoc) {
    try {
      await removeStorageObject({
        supabase: params.supabase,
        bucket: "client-documents",
        storagePath: uploaded.storagePath,
      });
    } catch {
      // Best-effort rollback when the DB row could not be created.
    }
    return {
      ok: false,
      message: friendlyClientDocumentError(
        error?.message ?? "Document record could not be created."
      ),
    };
  }

  for (const existingDoc of existingDocs ?? []) {
    const { error: deleteRowError } = await params.supabase
      .from("client_documents")
      .delete()
      .eq("id", existingDoc.id);

    if (deleteRowError) {
      continue;
    }

    try {
      await removeStorageObject({
        supabase: params.supabase,
        bucket: "client-documents",
        storagePath: existingDoc.storage_path,
      });
    } catch {
      // Row removed; storage cleanup is best-effort.
    }
  }

  if (params.revalidate !== false) {
    revalidatePath(`/clients/${parsed.data.client_id}`);
  }

  return { ok: true, message: "Document uploaded." };
}
