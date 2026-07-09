import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export const CREATOR_AVATARS_BUCKET = "creator-avatars";

export function buildImportAvatarStoragePath(
  importFileId: string,
  platform: string,
  username: string,
  extension: string
): string {
  const safePlatform = platform.replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
  const safeUsername = username.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();
  const safeExt = extension.replace(/^\./, "").toLowerCase() || "png";
  return `imports/${importFileId}/${safePlatform}/${safeUsername}.${safeExt}`;
}

export function buildEnrichmentAvatarStoragePath(
  influencerId: string,
  platform: string,
  username: string,
  extension: string
): string {
  const safePlatform = platform.replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
  const safeUsername = username.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();
  const safeExt = extension.replace(/^\./, "").toLowerCase() || "png";
  return `enrichment/${influencerId}/${safePlatform}/${safeUsername}.${safeExt}`;
}

export function extensionForContentType(contentType: string): string {
  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    default:
      return "png";
  }
}

export function resolveCreatorAvatarPublicUrl(
  supabaseUrl: string,
  storagePath: string
): string {
  const base = supabaseUrl.replace(/\/+$/, "");
  return `${base}/storage/v1/object/public/${CREATOR_AVATARS_BUCKET}/${storagePath}`;
}

/** Extract storage object path from a creator-avatars public or signed URL. */
export function parseCreatorAvatarStoragePathFromUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    const marker = `/storage/v1/object/`;
    const idx = parsed.pathname.indexOf(marker);
    if (idx < 0) return null;

    const remainder = parsed.pathname.slice(idx + marker.length);
    const segments = remainder.split("/").filter(Boolean);
    if (segments.length < 3) return null;

    const accessMode = segments[0];
    if (accessMode !== "public" && accessMode !== "sign") return null;
    if (segments[1] !== CREATOR_AVATARS_BUCKET) return null;

    return segments.slice(2).join("/");
  } catch {
    return null;
  }
}

/** True when the uploaded avatar object still exists in creator-avatars storage. */
export async function uploadedAvatarExistsInStorage(
  supabase: SupabaseClient<Database>,
  profilePictureUrl: string
): Promise<boolean> {
  const storagePath = parseCreatorAvatarStoragePathFromUrl(profilePictureUrl);
  if (!storagePath) return false;

  const { error } = await supabase.storage.from(CREATOR_AVATARS_BUCKET).download(storagePath);
  return !error;
}

export async function uploadImportCreatorAvatar(params: {
  supabase: SupabaseClient<Database>;
  importFileId: string;
  platform: string;
  username: string;
  buffer: Buffer;
  contentType: string;
}): Promise<string> {
  const extension = extensionForContentType(params.contentType);
  const storagePath = buildImportAvatarStoragePath(
    params.importFileId,
    params.platform,
    params.username,
    extension
  );

  const { error } = await params.supabase.storage
    .from(CREATOR_AVATARS_BUCKET)
    .upload(storagePath, params.buffer, {
      contentType: params.contentType,
      upsert: true,
      cacheControl: "31536000",
    });

  if (error) {
    throw new Error(`Avatar upload failed for @${params.username}: ${error.message}`);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured.");
  }

  return resolveCreatorAvatarPublicUrl(supabaseUrl, storagePath);
}

/** Persist an enrichment-fetched provider avatar into creator-avatars storage. */
export async function uploadEnrichmentCreatorAvatar(params: {
  supabase: SupabaseClient<Database>;
  influencerId: string;
  platform: string;
  username: string;
  buffer: Buffer;
  contentType: string;
}): Promise<string> {
  const extension = extensionForContentType(params.contentType);
  const storagePath = buildEnrichmentAvatarStoragePath(
    params.influencerId,
    params.platform,
    params.username,
    extension
  );

  const { error } = await params.supabase.storage
    .from(CREATOR_AVATARS_BUCKET)
    .upload(storagePath, params.buffer, {
      contentType: params.contentType,
      upsert: true,
      cacheControl: "31536000",
    });

  if (error) {
    throw new Error(
      `Enrichment avatar upload failed for @${params.username}: ${error.message}`
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured.");
  }

  return resolveCreatorAvatarPublicUrl(supabaseUrl, storagePath);
}
