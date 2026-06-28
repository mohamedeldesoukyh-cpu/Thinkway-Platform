import { randomUUID } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import type { DocumentBucket } from "@/lib/domains/document/types";

export type { DocumentBucket } from "@/lib/domains/document/types";

const MAX_FILE_BYTES = 50 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export type CreatorImportBucket = "creator-imports";

const CREATOR_IMPORT_MAX_BYTES = 50 * 1024 * 1024;

const CREATOR_IMPORT_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "text/csv",
  "application/csv",
  "application/zip",
  "application/x-zip-compressed",
  "application/octet-stream",
]);

const CREATOR_IMPORT_EXTENSIONS = new Set([".pdf", ".xlsx", ".csv", ".zip"]);

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

function hasAllowedCreatorImportExtension(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return [...CREATOR_IMPORT_EXTENSIONS].some((ext) => lower.endsWith(ext));
}

export function buildCreatorImportStoragePath(
  userId: string,
  importId: string,
  fileName: string
): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${userId}/${importId}/${randomUUID()}-${safeName}`;
}

export async function uploadCreatorImportFile(params: {
  supabase: SupabaseClient<Database>;
  userId: string;
  importId: string;
  file: File;
}): Promise<{ storagePath: string; mimeType: string; fileSize: number }> {
  if (params.file.size > CREATOR_IMPORT_MAX_BYTES) {
    throw new Error("File exceeds the 50 MB limit.");
  }

  if (!hasAllowedCreatorImportExtension(params.file.name)) {
    throw new Error("Only PDF, XLSX, CSV, and ZIP files are supported.");
  }

  if (params.file.type && !CREATOR_IMPORT_MIME_TYPES.has(params.file.type)) {
    throw new Error("File type is not allowed.");
  }

  const storagePath = buildCreatorImportStoragePath(
    params.userId,
    params.importId,
    params.file.name
  );

  const { error } = await params.supabase.storage
    .from("creator-imports")
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

/**
 * Removes a creator-import object. Import source files are immutable: the
 * storage RLS policies deny DELETE to all authenticated users, so this MUST be
 * called with a service-role client (see createSupabaseAdminClient). Reserved
 * for failed-upload rollback, post-processing cleanup (service-role worker), and
 * admin/legal purge — never wire it to user UI.
 */
export async function removeCreatorImportObject(params: {
  supabase: SupabaseClient<Database>;
  storagePath: string;
}): Promise<void> {
  const { error } = await params.supabase.storage
    .from("creator-imports")
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
