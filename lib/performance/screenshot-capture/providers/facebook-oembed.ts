import { getScreenshotCaptureEnv } from "@/lib/performance/screenshot-capture/config";
import type { ScreenshotCaptureAttempt } from "@/lib/performance/screenshot-capture/types";

type Ctx = {
  contentUrl: string | null;
};

const FACEBOOK_CRAWLER_UA =
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

function thumbnailFromOembedBody(body: Record<string, unknown>): string | null {
  const thumbnail =
    (typeof body.thumbnail_url === "string" && body.thumbnail_url) ||
    (typeof body.thumbnail_url_with_play_button === "string" &&
      body.thumbnail_url_with_play_button) ||
    (typeof body.image === "string" && body.image) ||
    null;
  return thumbnail?.startsWith("http") ? thumbnail : null;
}

function thumbnailFromGraphVideoBody(body: Record<string, unknown>): string | null {
  if (typeof body.picture === "string" && body.picture.startsWith("http")) {
    return body.picture;
  }
  const formats = Array.isArray(body.format) ? body.format : [];
  let best: { url: string; area: number } | null = null;
  for (const entry of formats) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const url = typeof row.picture === "string" ? row.picture : null;
    if (!url?.startsWith("http")) continue;
    const width = typeof row.width === "number" ? row.width : 0;
    const height = typeof row.height === "number" ? row.height : 0;
    const area = width * height;
    if (!best || area > best.area) best = { url, area };
  }
  return best?.url ?? null;
}

/** Reel / video / watch id from a Facebook permalink. */
export function facebookMediaIdFromUrl(contentUrl: string): string | null {
  try {
    const url = new URL(contentUrl);
    const host = url.hostname.toLowerCase();
    const segments = url.pathname.split("/").filter(Boolean);
    if (host === "fb.watch" || host.endsWith(".fb.watch")) {
      return segments[0] ?? null;
    }
    if (
      (segments[0] === "reel" || segments[0] === "reels" || segments[0] === "videos") &&
      segments[1]
    ) {
      return segments[1];
    }
    const videosIdx = segments.indexOf("videos");
    if (videosIdx >= 0 && segments[videosIdx + 1]) return segments[videosIdx + 1]!;
    if (segments[0] === "watch") return url.searchParams.get("v");
    return url.searchParams.get("v") ?? url.searchParams.get("story_fbid");
  } catch {
    return null;
  }
}

async function fetchFacebookOembed(
  endpoint: string,
  contentUrl: string,
  accessToken?: string | null
): Promise<string | null> {
  const oembedUrl = new URL(endpoint);
  oembedUrl.searchParams.set("url", contentUrl);
  oembedUrl.searchParams.set("omitscript", "true");
  if (accessToken) oembedUrl.searchParams.set("access_token", accessToken);

  const response = await fetch(oembedUrl, {
    signal: AbortSignal.timeout(20_000),
    headers: {
      Accept: "application/json",
      "User-Agent": FACEBOOK_CRAWLER_UA,
    },
  });
  if (!response.ok) return null;
  const body = (await response.json()) as Record<string, unknown>;
  return thumbnailFromOembedBody(body);
}

async function fetchFacebookGraphPicture(
  mediaId: string,
  accessToken: string
): Promise<string | null> {
  const url = new URL(`https://graph.facebook.com/v21.0/${mediaId}`);
  url.searchParams.set("fields", "picture,format");
  url.searchParams.set("access_token", accessToken);
  const response = await fetch(url, {
    signal: AbortSignal.timeout(20_000),
    headers: { Accept: "application/json", "User-Agent": FACEBOOK_CRAWLER_UA },
  });
  if (!response.ok) return null;
  const body = (await response.json()) as Record<string, unknown>;
  return thumbnailFromGraphVideoBody(body);
}

/** Facebook reel/post thumbnail via Graph oEmbed when token is set, else public plugins. */
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
    const accessToken = getScreenshotCaptureEnv().metaGraphAccessToken;
    const mediaId = facebookMediaIdFromUrl(ctx.contentUrl);

    if (accessToken && mediaId) {
      const fromGraph = await fetchFacebookGraphPicture(mediaId, accessToken);
      if (fromGraph) {
        return {
          source: "facebook_oembed",
          available: true,
          imageUrl: fromGraph,
          durationMs: Date.now() - started,
        };
      }
    }

    if (accessToken) {
      const fromGraphVideo = await fetchFacebookOembed(
        "https://graph.facebook.com/v21.0/oembed_video",
        ctx.contentUrl,
        accessToken
      );
      if (fromGraphVideo) {
        return {
          source: "facebook_oembed",
          available: true,
          imageUrl: fromGraphVideo,
          durationMs: Date.now() - started,
        };
      }
      const fromGraphPost = await fetchFacebookOembed(
        "https://graph.facebook.com/v21.0/oembed_post",
        ctx.contentUrl,
        accessToken
      );
      if (fromGraphPost) {
        return {
          source: "facebook_oembed",
          available: true,
          imageUrl: fromGraphPost,
          durationMs: Date.now() - started,
        };
      }
    }

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
