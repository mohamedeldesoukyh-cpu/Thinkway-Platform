import { getScreenshotCaptureEnv } from "@/lib/performance/screenshot-capture/config";
import type { ScreenshotCaptureAttempt } from "@/lib/performance/screenshot-capture/types";

type Ctx = {
  mediaId: string | null;
  env: ReturnType<typeof getScreenshotCaptureEnv>;
};

export async function tryMetaGraphThumbnail(ctx: Ctx): Promise<ScreenshotCaptureAttempt> {
  const started = Date.now();
  if (!ctx.env.metaGraphAccessToken) {
    return {
      source: "meta_graph_thumbnail",
      available: false,
      skippedReason: "META_GRAPH_ACCESS_TOKEN not configured.",
      durationMs: Date.now() - started,
    };
  }

  if (!ctx.mediaId) {
    return {
      source: "meta_graph_thumbnail",
      available: true,
      error: "Could not resolve Instagram media id.",
      errorCode: "missing_media_id",
      durationMs: Date.now() - started,
    };
  }

  const url = new URL(`https://graph.facebook.com/v21.0/${ctx.mediaId}`);
  url.searchParams.set("fields", "thumbnail_url,media_url");
  url.searchParams.set("access_token", ctx.env.metaGraphAccessToken);

  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  const body = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    return {
      source: "meta_graph_thumbnail",
      available: true,
      error: String(body.error ?? `Meta Graph HTTP ${response.status}`),
      errorCode: "meta_graph_error",
      durationMs: Date.now() - started,
    };
  }

  const imageUrl =
    (typeof body.thumbnail_url === "string" && body.thumbnail_url) ||
    (typeof body.media_url === "string" && body.media_url) ||
    null;

  if (!imageUrl) {
    return {
      source: "meta_graph_thumbnail",
      available: true,
      error: "Meta Graph returned no thumbnail.",
      errorCode: "meta_graph_empty",
      durationMs: Date.now() - started,
    };
  }

  return {
    source: "meta_graph_thumbnail",
    available: true,
    imageUrl,
    durationMs: Date.now() - started,
  };
}
