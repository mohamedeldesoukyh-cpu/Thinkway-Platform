import type { ScreenshotCaptureAttempt } from "@/lib/performance/screenshot-capture/types";

type Ctx = {
  contentUrl: string | null;
};

function thumbnailFromOembedBody(body: Record<string, unknown>): string | null {
  const thumbnail =
    (typeof body.thumbnail_url === "string" && body.thumbnail_url) ||
    (typeof body.thumbnail_url_with_play_button === "string" &&
      body.thumbnail_url_with_play_button) ||
    null;
  return thumbnail?.startsWith("http") ? thumbnail : null;
}

async function fetchFacebookOembed(
  endpoint: string,
  contentUrl: string
): Promise<string | null> {
  const oembedUrl = new URL(endpoint);
  oembedUrl.searchParams.set("url", contentUrl);
  oembedUrl.searchParams.set("omitscript", "true");

  const response = await fetch(oembedUrl, {
    signal: AbortSignal.timeout(20_000),
    headers: {
      Accept: "application/json",
      "User-Agent":
        "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    },
  });
  if (!response.ok) return null;
  const body = (await response.json()) as Record<string, unknown>;
  return thumbnailFromOembedBody(body);
}

/** Public Facebook post/video oEmbed — thumbnail without Graph token. */
export async function tryFacebookOembedThumbnail(
  ctx: Ctx
): Promise<ScreenshotCaptureAttempt> {
  const started = Date.now();
  if (!ctx.contentUrl) {
    return {
      source: "facebook_oembed",
      available: true,
      error: "Publication has no content URL.",
      errorCode: "missing_url",
      durationMs: Date.now() - started,
    };
  }

  try {
    const fromVideo = await fetchFacebookOembed(
      "https://www.facebook.com/plugins/video/oembed.json",
      ctx.contentUrl
    );
    if (fromVideo) {
      return {
        source: "facebook_oembed",
        available: true,
        imageUrl: fromVideo,
        durationMs: Date.now() - started,
      };
    }

    const fromPost = await fetchFacebookOembed(
      "https://www.facebook.com/plugins/post/oembed.json",
      ctx.contentUrl
    );
    if (fromPost) {
      return {
        source: "facebook_oembed",
        available: true,
        imageUrl: fromPost,
        durationMs: Date.now() - started,
      };
    }

    return {
      source: "facebook_oembed",
      available: true,
      error: "Facebook oEmbed returned no thumbnail.",
      errorCode: "facebook_oembed_empty",
      durationMs: Date.now() - started,
    };
  } catch (error) {
    return {
      source: "facebook_oembed",
      available: true,
      error: error instanceof Error ? error.message : String(error),
      errorCode: "facebook_oembed_error",
      durationMs: Date.now() - started,
    };
  }
}
