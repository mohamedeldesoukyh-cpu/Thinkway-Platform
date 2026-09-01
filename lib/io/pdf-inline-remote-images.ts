/**
 * Inline remote <img> URLs as data URIs before Chromium PDF capture.
 * Shared by every HTML→PDF export so avatars/logos survive request interception.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchCreatorAvatarImage } from "@/lib/creators/creator-avatar-proxy";
import { toUnprocessedImageDataUri } from "@/lib/performance/report/embed-publication-previews";
import { embedReportImageDataUri } from "@/lib/performance/report/report-embed-images";
import { detectImageContentType } from "@/lib/performance/screenshot-capture/storage";
import type { Database } from "@/types/database";

const IMG_SRC_RE = /<img\b[^>]*?\bsrc=(["'])(https?:\/\/[^"']+)\1/gi;

async function resolveAdminSupabase(): Promise<SupabaseClient<Database> | null> {
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    return createSupabaseAdminClient();
  } catch {
    return null;
  }
}

async function embedRemoteImageDataUri(
  url: string,
  supabase: SupabaseClient<Database> | null
): Promise<string | null> {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith("data:")) return trimmed || null;

  const result = await fetchCreatorAvatarImage({
    src: trimmed,
    profileUrl: null,
    supabase,
  });
  if (result.ok) {
    const buffer = Buffer.from(result.buffer);
    const contentType = result.contentType || detectImageContentType(buffer);
    return toUnprocessedImageDataUri(buffer, contentType);
  }

  const fetched = await embedReportImageDataUri(trimmed);
  return fetched?.startsWith("data:") ? fetched : null;
}

/** Collect unique http(s) image URLs from HTML img tags. */
export function collectRemoteImgSrcs(html: string): string[] {
  const urls = new Set<string>();
  for (const match of html.matchAll(IMG_SRC_RE)) {
    const src = match[2]?.trim();
    if (src) urls.add(src);
  }
  return [...urls];
}

/**
 * Replace remote img src values with data URIs so PDF rendering never depends
 * on Chromium fetching social CDNs (which are aborted by default).
 */
export async function inlineRemoteImagesInHtml(html: string): Promise<string> {
  const urls = collectRemoteImgSrcs(html);
  if (!urls.length) return html;

  const supabase = await resolveAdminSupabase();
  const replacements = new Map<string, string>();

  await Promise.all(
    urls.map(async (url) => {
      try {
        const embedded = await embedRemoteImageDataUri(url, supabase);
        if (embedded?.startsWith("data:")) {
          replacements.set(url, embedded);
        }
      } catch {
        // Leave original URL — request interception may still allow supabase hosts.
      }
    })
  );

  if (!replacements.size) return html;

  let next = html;
  for (const [from, to] of replacements) {
    next = next.split(from).join(to);
  }
  return next;
}
