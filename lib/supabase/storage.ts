import { randomUUID } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

const MAX_FILE_BYTES = 50 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export type DocumentBucket = "client-documents" | "influencer-documents";

export function buildDocumentStoragePath(
  entityId: string,
  documentType: string,
  fileName: string
): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${entityId}/${documentType}/${randomUUID()}-${safeName}`;
}

export async function uploadEntityDocument(params: {
  supabase: SupabaseClient<Database>;
  bucket: DocumentBucket;
  entityId: string;
  documentType: string;
  file: File;
}): Promise<{ storagePath: string; mimeType: string; fileSize: number }> {
  if (params.file.size > MAX_FILE_BYTES) {
    throw new Error("File exceeds the 50 MB limit.");
  }

  if (params.file.type && !ALLOWED_MIME_TYPES.has(params.file.type)) {
    throw new Error("File type is not allowed.");
  }

  const storagePath = buildDocumentStoragePath(
    params.entityId,
    params.documentType,
    params.file.name
  );

  const { error } = await params.supabase.storage
    .from(params.bucket)
    .upload(storagePath, params.file, {
      cacheControl: "3600",
      upsert: false,
      contentType: params.file.type || undefined,
    });

  if (error) {
    throw new Error(error.message);
  }

  return {
    storagePath,
    mimeType: params.file.type,
    fileSize: params.file.size,
  };
}

export async function removeStorageObject(params: {
  supabase: SupabaseClient<Database>;
  bucket: DocumentBucket;
  storagePath: string;
}): Promise<void> {
  const { error } = await params.supabase.storage
    .from(params.bucket)
    .remove([params.storagePath]);

  if (error) {
    throw new Error(error.message);
  }
}

export async function createSignedDocumentUrl(params: {
  supabase: SupabaseClient<Database>;
  bucket: DocumentBucket;
  storagePath: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const { data, error } = await params.supabase.storage
    .from(params.bucket)
    .createSignedUrl(
      params.storagePath,
      params.expiresInSeconds ?? 60 * 15
    );

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Could not create download link.");
  }

  return data.signedUrl;
}
