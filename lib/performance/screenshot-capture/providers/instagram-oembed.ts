import type { ScreenshotCaptureAttempt } from "@/lib/performance/screenshot-capture/types";

type Ctx = {
  contentUrl: string | null;
};

/** Instagram public post oEmbed — returns thumbnail_url without scraping HTML. */
export async function tryInstagramOembedThumbnail(ctx: Ctx): Promise<ScreenshotCaptureAttempt> {
  const started = Date.now();
  if (!ctx.contentUrl) {
    return {
      source: "instagram_oembed",
      available: true,
      error: "Publication has no content URL.",
      errorCode: "missing_url",
      durationMs: Date.now() - started,
    };
  }

  const oembedUrl = new URL("https://api.instagram.com/oembed");
  oembedUrl.searchParams.set("url", ctx.contentUrl);
  oembedUrl.searchParams.set("omitscript", "true");

  try {
    const response = await fetch(oembedUrl, {
      signal: AbortSignal.timeout(30_000),
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    const body = (await response.json()) as { thumbnail_url?: string; error?: string };

    if (!response.ok) {
      return {
        source: "instagram_oembed",
        available: true,
        error: body.error ?? `Instagram oEmbed HTTP ${response.status}`,
        errorCode: "instagram_oembed_error",
        durationMs: Date.now() - started,
      };
    }

    if (!body.thumbnail_url?.startsWith("http")) {
      return {
        source: "instagram_oembed",
        available: true,
        error: "Instagram oEmbed returned no thumbnail.",
        errorCode: "instagram_oembed_empty",
        durationMs: Date.now() - started,
      };
    }

    return {
      source: "instagram_oembed",
      available: true,
      imageUrl: body.thumbnail_url,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    return {
      source: "instagram_oembed",
      available: true,
      error: error instanceof Error ? error.message : String(error),
      errorCode: "instagram_oembed_error",
      durationMs: Date.now() - started,
    };
  }
}
