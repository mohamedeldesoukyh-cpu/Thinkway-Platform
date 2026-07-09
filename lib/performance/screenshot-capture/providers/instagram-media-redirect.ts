import type { ScreenshotCaptureAttempt } from "@/lib/performance/screenshot-capture/types";

type Ctx = {
  contentUrl: string | null;
};

/** Extract Instagram post/reel shortcode from a permalink. */
export function instagramShortcodeFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/(?:p|reel|tv)\/([^/?#]+)/i);
    return match?.[1]?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Resolve a fresh CDN image URL via Instagram's legacy media redirect.
 * Works when stored CDN thumbs expire but the post is still public.
 */
export async function tryInstagramMediaRedirectThumbnail(
  ctx: Ctx
): Promise<ScreenshotCaptureAttempt> {
  const started = Date.now();
  const shortcode = ctx.contentUrl ? instagramShortcodeFromUrl(ctx.contentUrl) : null;
  if (!shortcode) {
    return {
      source: "instagram_media_redirect",
      available: true,
      error: "Could not resolve Instagram shortcode.",
      errorCode: "missing_shortcode",
      durationMs: Date.now() - started,
    };
  }

  const mediaUrl = `https://www.instagram.com/p/${shortcode}/media/?size=l`;

  try {
    const response = await fetch(mediaUrl, {
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
      headers: {
        Accept: "*/*",
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
      },
    });

    const location = response.headers.get("location");
    if (response.status < 300 || response.status >= 400 || !location?.startsWith("http")) {
      return {
        source: "instagram_media_redirect",
        available: true,
        error: `Instagram media redirect HTTP ${response.status}`,
        errorCode: "instagram_media_redirect_error",
        durationMs: Date.now() - started,
      };
    }

    return {
      source: "instagram_media_redirect",
      available: true,
      imageUrl: location,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    return {
      source: "instagram_media_redirect",
      available: true,
      error: error instanceof Error ? error.message : String(error),
      errorCode: "instagram_media_redirect_error",
      durationMs: Date.now() - started,
    };
  }
}
