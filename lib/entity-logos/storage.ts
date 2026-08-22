import { randomUUID } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import {
  ENTITY_LOGO_MAX_BYTES,
  ENTITY_LOGO_MIME_TYPES,
  ENTITY_LOGOS_BUCKET,
  entityLogoExtension,
  entityLogoTable,
  storagePathFromPublicLogoUrl,
  type EntityLogoKind,
} from "./identity-logo";

export async function uploadEntityLogoFile(params: {
  supabase: SupabaseClient<Database>;
  kind: EntityLogoKind;
  entityId: string;
  file: File;
  previousUrl?: string | null;
}): Promise<string> {
  if (params.file.size > ENTITY_LOGO_MAX_BYTES) {
    throw new Error("Logo must be 2 MB or smaller.");
  }
  const mimeType = params.file.type?.trim() ?? "";
  if (!ENTITY_LOGO_MIME_TYPES.includes(mimeType as (typeof ENTITY_LOGO_MIME_TYPES)[number])) {
    throw new Error("Use a PNG, JPG, or WebP image.");
  }
  const extension = entityLogoExtension(mimeType);
  if (!extension) {
    throw new Error("Use a PNG, JPG, or WebP image.");
  }

  const storagePath = `${params.kind}/${params.entityId}/${randomUUID()}.${extension}`;
  const { error } = await params.supabase.storage.from(ENTITY_LOGOS_BUCKET).upload(storagePath, params.file, {
    cacheControl: "3600",
    upsert: false,
    contentType: mimeType,
  });
  if (error) {
    throw new Error(error.message);
  }

  const { data } = params.supabase.storage.from(ENTITY_LOGOS_BUCKET).getPublicUrl(storagePath);
  const publicUrl = data.publicUrl;
  if (!publicUrl) {
    throw new Error("Logo upload did not return a URL.");
  }

  const table = entityLogoTable(params.kind);
  const { error: updateError } = await params.supabase
    .from(table)
    .update({ logo_url: publicUrl } as never)
    .eq("id", params.entityId);
  if (updateError) {
    await params.supabase.storage.from(ENTITY_LOGOS_BUCKET).remove([storagePath]);
    throw new Error(updateError.message);
  }

  const previousPath = params.previousUrl ? storagePathFromPublicLogoUrl(params.previousUrl) : null;
  if (previousPath && previousPath !== storagePath) {
    await params.supabase.storage.from(ENTITY_LOGOS_BUCKET).remove([previousPath]);
  }

  return publicUrl;
}

export async function clearEntityLogoFile(params: {
  supabase: SupabaseClient<Database>;
  kind: EntityLogoKind;
  entityId: string;
  previousUrl?: string | null;
}): Promise<void> {
  const table = entityLogoTable(params.kind);
  const { error } = await params.supabase
    .from(table)
    .update({ logo_url: null } as never)
    .eq("id", params.entityId);
  if (error) {
    throw new Error(error.message);
  }
  const previousPath = params.previousUrl ? storagePathFromPublicLogoUrl(params.previousUrl) : null;
  if (previousPath) {
    await params.supabase.storage.from(ENTITY_LOGOS_BUCKET).remove([previousPath]);
  }
}
