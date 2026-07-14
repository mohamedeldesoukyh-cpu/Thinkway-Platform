import type { ScreenshotCaptureAttempt } from "@/lib/performance/screenshot-capture/types";

type Ctx = {
  contentUrl: string | null;
};

export async function tryTikTokOembedThumbnail(ctx: Ctx): Promise<ScreenshotCaptureAttempt> {
  const started = Date.now();
  if (!ctx.contentUrl) {
    return {
      source: "tiktok_oembed",
      available: true,
      error: "Publication has no content URL.",
      errorCode: "missing_url",
      durationMs: Date.now() - started,
    };
  }

  const oembedUrl = new URL("https://www.tiktok.com/oembed");
  oembedUrl.searchParams.set("url", ctx.contentUrl);

  try {
    const response = await fetch(oembedUrl, { signal: AbortSignal.timeout(30_000) });
    const body = (await response.json()) as { thumbnail_url?: string; error?: string };

    if (!response.ok) {
      return {
        source: "tiktok_oembed",
        available: true,
        error: body.error ?? `TikTok oEmbed HTTP ${response.status}`,
        errorCode: "tiktok_oembed_error",
        durationMs: Date.now() - started,
      };
    }

    if (!body.thumbnail_url) {
      return {
        source: "tiktok_oembed",
        available: true,
        error: "TikTok oEmbed returned no thumbnail.",
        errorCode: "tiktok_oembed_empty",
        durationMs: Date.now() - started,
      };
    }

    return {
      source: "tiktok_oembed",
      available: true,
      imageUrl: body.thumbnail_url,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    return {
      source: "tiktok_oembed",
      available: true,
      error: error instanceof Error ? error.message : String(error),
      errorCode: "tiktok_oembed_error",
      durationMs: Date.now() - started,
    };
  }
}
