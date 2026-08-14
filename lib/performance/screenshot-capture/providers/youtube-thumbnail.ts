import { getScreenshotCaptureEnv } from "@/lib/performance/screenshot-capture/config";
import type { ScreenshotCaptureAttempt } from "@/lib/performance/screenshot-capture/types";

type Ctx = {
  mediaId?: string | null;
  contentUrl?: string | null;
  env?: ReturnType<typeof getScreenshotCaptureEnv>;
};

const YOUTUBE_THUMBNAIL_VARIANTS = ["maxresdefault", "sddefault", "hqdefault", "mqdefault"];

/** Extract a YouTube video id from watch / shorts / embed / youtu.be URLs. */
export function youtubeVideoIdFromUrl(url: string | null | undefined): string | null {
  const raw = url?.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    const host = parsed.hostname.toLowerCase();
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (host === "youtu.be" || host.endsWith(".youtu.be")) return segments[0] ?? null;
    if (!host.includes("youtube.com")) return null;
    if ((segments[0] === "shorts" || segments[0] === "embed" || segments[0] === "live") && segments[1]) {
      return segments[1];
    }
    return parsed.searchParams.get("v");
  } catch {
    return null;
  }
}

export async function tryYouTubeThumbnail(ctx: Ctx): Promise<ScreenshotCaptureAttempt> {
  const started = Date.now();
  const mediaId = ctx.mediaId?.trim() || youtubeVideoIdFromUrl(ctx.contentUrl);
  if (!mediaId) {
    return {
      source: "youtube_thumbnail_api",
      available: true,
      error: "Could not resolve YouTube video id.",
      errorCode: "missing_video_id",
      durationMs: Date.now() - started,
    };
  }

  for (const variant of YOUTUBE_THUMBNAIL_VARIANTS) {
    const imageUrl = `https://img.youtube.com/vi/${mediaId}/${variant}.jpg`;
    const response = await fetch(imageUrl, { method: "HEAD", signal: AbortSignal.timeout(15_000) });
    if (response.ok) {
      return {
        source: "youtube_thumbnail_api",
        available: true,
        imageUrl,
        durationMs: Date.now() - started,
      };
    }
  }

  return {
    source: "youtube_thumbnail_api",
    available: true,
    error: "YouTube thumbnail not available.",
    errorCode: "youtube_thumbnail_empty",
    durationMs: Date.now() - started,
  };
}
