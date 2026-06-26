import { getScreenshotCaptureEnv } from "@/lib/performance/screenshot-capture/config";
import type { ScreenshotCaptureAttempt } from "@/lib/performance/screenshot-capture/types";

type Ctx = {
  mediaId: string | null;
  env: ReturnType<typeof getScreenshotCaptureEnv>;
};

const YOUTUBE_THUMBNAIL_VARIANTS = ["maxresdefault", "sddefault", "hqdefault", "mqdefault"];

export async function tryYouTubeThumbnail(ctx: Ctx): Promise<ScreenshotCaptureAttempt> {
  const started = Date.now();
  if (!ctx.mediaId) {
    return {
      source: "youtube_thumbnail_api",
      available: true,
      error: "Could not resolve YouTube video id.",
      errorCode: "missing_video_id",
      durationMs: Date.now() - started,
    };
  }

  for (const variant of YOUTUBE_THUMBNAIL_VARIANTS) {
    const imageUrl = `https://img.youtube.com/vi/${ctx.mediaId}/${variant}.jpg`;
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
