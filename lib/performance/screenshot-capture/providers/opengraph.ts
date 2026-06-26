import type { ScreenshotCaptureAttempt } from "@/lib/performance/screenshot-capture/types";

type Ctx = {
  contentUrl: string | null;
};

function extractOgImage(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image(?::url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::url)?["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]?.startsWith("http")) return match[1];
  }
  return null;
}

export async function tryOpenGraphThumbnail(ctx: Ctx): Promise<ScreenshotCaptureAttempt> {
  const started = Date.now();
  if (!ctx.contentUrl) {
    return {
      source: "opengraph",
      available: true,
      error: "Publication has no content URL.",
      errorCode: "missing_url",
      durationMs: Date.now() - started,
    };
  }

  try {
    const response = await fetch(ctx.contentUrl, {
      signal: AbortSignal.timeout(30_000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; ThinkwayBot/1.0; +https://thinkway.com)",
        Accept: "text/html",
      },
    });
    if (!response.ok) {
      return {
        source: "opengraph",
        available: true,
        error: `HTTP ${response.status}`,
        errorCode: "opengraph_http_error",
        durationMs: Date.now() - started,
      };
    }
    const html = await response.text();
    const imageUrl = extractOgImage(html);
    if (!imageUrl) {
      return {
        source: "opengraph",
        available: true,
        error: "No og:image found.",
        errorCode: "opengraph_empty",
        durationMs: Date.now() - started,
      };
    }
    return {
      source: "opengraph",
      available: true,
      imageUrl,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    return {
      source: "opengraph",
      available: true,
      error: error instanceof Error ? error.message : String(error),
      errorCode: "opengraph_error",
      durationMs: Date.now() - started,
    };
  }
}
