import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

const CREATOR_IMPORT_BUCKET = "creator-imports";

export function buildCreatorImportChunkStoragePath(
  importFileId: string,
  chunkIndex: number
): string {
  return `${importFileId}/chunks/${chunkIndex}.json`;
}

export async function uploadCreatorImportChunk(params: {
  supabase: SupabaseClient<Database>;
  importFileId: string;
  chunkIndex: number;
  rows: unknown;
}): Promise<string> {
  const storagePath = buildCreatorImportChunkStoragePath(
    params.importFileId,
    params.chunkIndex
  );
  const body = JSON.stringify(params.rows);
  const { error } = await params.supabase.storage
    .from(CREATOR_IMPORT_BUCKET)
    .upload(storagePath, body, {
      cacheControl: "3600",
      upsert: false,
      // creator-imports bucket allows octet-stream but not application/json
      contentType: "application/octet-stream",
    });

  if (error) {
    throw new Error(error.message);
  }

  return storagePath;
}

export async function downloadCreatorImportChunk(params: {
  supabase: SupabaseClient<Database>;
  importFileId: string;
  chunkIndex: number;
}): Promise<unknown[]> {
  const storagePath = buildCreatorImportChunkStoragePath(
    params.importFileId,
    params.chunkIndex
  );
  const { data, error } = await params.supabase.storage
    .from(CREATOR_IMPORT_BUCKET)
    .download(storagePath);

  if (error || !data) {
    throw new Error(error?.message ?? "Could not download import chunk.");
  }

  const parsed = JSON.parse(await data.text()) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Import chunk payload is invalid.");
  }

  return parsed;
}

export async function removeCreatorImportChunks(params: {
  supabase: SupabaseClient<Database>;
  importFileId: string;
  totalChunks: number;
}): Promise<void> {
  if (params.totalChunks <= 0) return;

  const paths = Array.from({ length: params.totalChunks }, (_, chunkIndex) =>
    buildCreatorImportChunkStoragePath(params.importFileId, chunkIndex)
  );

  const { error } = await params.supabase.storage
    .from(CREATOR_IMPORT_BUCKET)
    .remove(paths);

  if (error) {
    throw new Error(error.message);
  }
}

export async function downloadCreatorImportFile(params: {
  supabase: SupabaseClient<Database>;
  storagePath: string;
}): Promise<Buffer> {
  const { data, error } = await params.supabase.storage
    .from(CREATOR_IMPORT_BUCKET)
    .download(params.storagePath);

  if (error || !data) {
    throw new Error(error?.message ?? "Could not download import file.");
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
