import { fetchCreatorAvatarImage } from "@/lib/creators/creator-avatar-proxy";
import { detectImageContentType } from "@/lib/performance/screenshot-capture/storage";
import { embedReportImageDataUri } from "@/lib/performance/report/report-embed-images";
import {
  PITCH_AVATAR_COMPRESS,
  SHOWCASE_AVATAR_COMPRESS,
  compressExportDataUri,
  toCompressedExportDataUri,
} from "@/lib/io/compress-export-image";

import type { ShortlistDocument } from "./shortlist-document";
import { isCreatorDeckTemplate, isPitchTemplate } from "./shortlist-template";

async function resolveExportAvatarSupabase() {
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    return createSupabaseAdminClient();
  } catch {
    return null;
  }
}

async function embedShortlistAvatarDataUri(
  src: string | null,
  profileUrl: string | null,
  compress: boolean,
  compressOptions = SHOWCASE_AVATAR_COMPRESS,
  supabase: Awaited<ReturnType<typeof resolveExportAvatarSupabase>> = null
): Promise<string | null> {
  const trimmedSrc = src?.trim() || null;
  const trimmedProfile = profileUrl?.trim() || null;
  if (!trimmedSrc && !trimmedProfile) return null;
  if (trimmedSrc?.startsWith("data:")) {
    if (!compress) return trimmedSrc;
    const compressed = await compressExportDataUri(trimmedSrc, compressOptions);
    return compressed ?? trimmedSrc;
  }

  const result = await fetchCreatorAvatarImage({
    src: trimmedSrc,
    profileUrl: trimmedProfile,
    supabase,
  });

  if (result.ok) {
    const buffer = Buffer.from(result.buffer);
    const contentType =
      result.contentType || detectImageContentType(buffer);
    if (!compress) {
      return `data:${contentType};base64,${buffer.toString("base64")}`;
    }
    return toCompressedExportDataUri(buffer, contentType, compressOptions);
  }

  if (trimmedSrc) {
    const embedded = await embedReportImageDataUri(trimmedSrc);
    if (!embedded?.startsWith("data:")) return null;
    if (!compress) return embedded;
    return compressExportDataUri(embedded, compressOptions);
  }

  return null;
}

/** Embed avatars as data URIs so preview iframe and PDF/Word exports render profile images. */
export async function embedShortlistDocumentAvatars(
  doc: ShortlistDocument
): Promise<ShortlistDocument> {
  const compress = isCreatorDeckTemplate(doc.template);
  const compressOptions = isPitchTemplate(doc.template)
    ? PITCH_AVATAR_COMPRESS
    : SHOWCASE_AVATAR_COMPRESS;
  const supabase = await resolveExportAvatarSupabase();

  const rows = await Promise.all(
    doc.rows.map(async (row) => ({
      ...row,
      avatarUrl: await embedShortlistAvatarDataUri(
        row.avatarUrl,
        row.avatarProfileUrl,
        compress,
        compressOptions,
        supabase
      ),
    }))
  );

  const creatorGroups = doc.creatorGroups.length
    ? await Promise.all(
        doc.creatorGroups.map(async (group) => ({
          ...group,
          avatarUrl: await embedShortlistAvatarDataUri(
            group.avatarUrl,
            group.avatarProfileUrl,
            compress,
            compressOptions,
            supabase
          ),
          avatarProxyUrl: null,
        }))
      )
    : doc.creatorGroups;

  return { ...doc, rows, creatorGroups };
}

export function resolveShortlistExportSiteOrigin(
  requestHost?: string | null,
  requestProto?: string | null
): string {
  if (requestHost) {
    const proto = requestProto?.replace(/:$/, "") || "http";
    return `${proto}://${requestHost}`;
  }
  const envOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (envOrigin) return envOrigin;
  return "http://localhost:3000";
}
