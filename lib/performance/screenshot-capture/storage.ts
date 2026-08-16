import type { SupabaseClient } from "@supabase/supabase-js";

import { PUBLICATION_MEDIA_BUCKET } from "@/lib/performance/screenshot-capture/config";
import { decodeHtmlEntities } from "@/lib/text/decode-html-entities";

const SIGNED_URL_SECONDS = 60 * 60;

export function buildPublicationMediaPath(
  publicationId: string,
  fileName: string
): string {
  return `${publicationId}/${fileName}`;
}

export function resolvePublicationMediaPath(
  storedValue: string | null | undefined
): string | null {
  if (!storedValue?.trim()) return null;
  const trimmed = storedValue.trim();
  if (!trimmed.includes("://")) return trimmed;

  const marker = `/object/`;
  const bucketMarker = `${marker}public/${PUBLICATION_MEDIA_BUCKET}/`;
  const signMarker = `${marker}sign/${PUBLICATION_MEDIA_BUCKET}/`;
  const authMarker = `${marker}authenticated/${PUBLICATION_MEDIA_BUCKET}/`;

  for (const prefix of [bucketMarker, signMarker, authMarker]) {
    const index = trimmed.indexOf(prefix);
    if (index === -1) continue;
    return decodeURIComponent(trimmed.slice(index + prefix.length).split("?")[0] ?? "");
  }

  return null;
}

export async function uploadPublicationMedia(
  supabase: SupabaseClient,
  publicationId: string,
  fileName: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  const path = buildPublicationMediaPath(publicationId, fileName);
  const { error } = await supabase.storage.from(PUBLICATION_MEDIA_BUCKET).upload(path, body, {
    contentType,
    upsert: true,
    cacheControl: "3600",
  });
  if (error) throw new Error(`Screenshot upload failed: ${error.message}`);
  return path;
}

export async function createPublicationMediaSignedUrl(
  supabase: SupabaseClient,
  storedValue: string | null | undefined,
  expiresInSeconds: number = SIGNED_URL_SECONDS
): Promise<string | null> {
  if (!storedValue?.trim()) return null;
  if (storedValue.includes("://")) return storedValue;

  const path = resolvePublicationMediaPath(storedValue);
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from(PUBLICATION_MEDIA_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Browser-safe media URL: signed storage paths or external URLs only. */
export function resolvePublicationMediaDisplayUrl(
  signedUrl: string | null,
  storedValue: string | null | undefined
): string | null {
  if (signedUrl) return signedUrl;
  const trimmed = storedValue?.trim();
  if (!trimmed) return null;
  if (trimmed.includes("://")) return trimmed;
  return null;
}

export async function fetchImageBuffer(
  url: string,
  options?: { referer?: string | null }
): Promise<Buffer | null> {
  const normalizedUrl = decodeHtmlEntities(url.trim());
  try {
    const response = await fetch(normalizedUrl, {
      signal: AbortSignal.timeout(30_000),
      headers: {
        Accept: "image/*,*/*",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        ...(options?.referer ? { Referer: options.referer } : {}),
      },
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.startsWith("image/")) {
      return Buffer.from(await response.arrayBuffer());
    }
    // Some CDNs omit image/* — accept small binary payloads.
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > 0 && buffer.length < 15_000_000) return buffer;
    return null;
  } catch {
    return null;
  }
}

export function detectImageContentType(buffer: Buffer): string {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "image/jpeg";
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return "image/png";
  return "image/webp";
}
