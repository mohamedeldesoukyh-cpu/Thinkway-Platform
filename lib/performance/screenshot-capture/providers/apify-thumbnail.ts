import { pickApifyPreviewImageUrl } from "@/lib/performance/apify-preview-image";
import { buildApifyRunInput } from "@/lib/performance/metrics-collector/providers/apify-input";
import { getScreenshotCaptureEnv } from "@/lib/performance/screenshot-capture/config";
import type { ScreenshotCaptureAttempt } from "@/lib/performance/screenshot-capture/types";

type Ctx = {
  platform: string;
  contentUrl: string | null;
  env: ReturnType<typeof getScreenshotCaptureEnv>;
};

export async function tryApifyThumbnail(ctx: Ctx): Promise<ScreenshotCaptureAttempt> {
  const started = Date.now();
  if (!ctx.env.apifyToken) {
    return {
      source: "apify",
      available: false,
      skippedReason: "APIFY_TOKEN not configured.",
      durationMs: Date.now() - started,
    };
  }

  if (!ctx.contentUrl) {
    return {
      source: "apify",
      available: true,
      error: "Publication has no content URL.",
      errorCode: "missing_url",
      durationMs: Date.now() - started,
    };
  }

  const actorId =
    ctx.platform === "tiktok"
      ? ctx.env.apifyTikTokActorId
      : ctx.env.apifyInstagramActorId;

  if (!actorId) {
    return {
      source: "apify",
      available: false,
      skippedReason: "Apify actor id not configured.",
      durationMs: Date.now() - started,
    };
  }

  const runResponse = await fetch(
    `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?token=${ctx.env.apifyToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildApifyRunInput(ctx.platform, ctx.contentUrl)),
      signal: AbortSignal.timeout(120_000),
    }
  );

  if (!runResponse.ok) {
    return {
      source: "apify",
      available: true,
      error: `Apify HTTP ${runResponse.status}`,
      errorCode: "apify_http_error",
      durationMs: Date.now() - started,
    };
  }

  const items = (await runResponse.json()) as unknown[];
  const imageUrl = pickApifyPreviewImageUrl(items[0]);
  if (!imageUrl) {
    return {
      source: "apify",
      available: true,
      error: "Apify returned no thumbnail.",
      errorCode: "apify_empty",
      durationMs: Date.now() - started,
    };
  }

  return {
    source: "apify",
    available: true,
    imageUrl,
    durationMs: Date.now() - started,
  };
}
