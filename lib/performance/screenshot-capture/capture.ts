import type { SupabaseClient } from "@supabase/supabase-js";

import { detectPublicationPlatform } from "@/lib/performance/metrics-collector/detect-platform";
import { getScreenshotCaptureEnv } from "@/lib/performance/screenshot-capture/config";
import {
  outcomeFromAttempts,
  persistExternalPublicationPreview,
  persistPublicationScreenshot,
  writeScreenshotSyncLog,
} from "@/lib/performance/screenshot-capture/persist";
import { tryApifyThumbnail } from "@/lib/performance/screenshot-capture/providers/apify-thumbnail";
import { tryMetaGraphThumbnail } from "@/lib/performance/screenshot-capture/providers/meta-graph-thumbnail";
import { tryFacebookOembedThumbnail } from "@/lib/performance/screenshot-capture/providers/facebook-oembed";
import { tryOpenGraphThumbnail } from "@/lib/performance/screenshot-capture/providers/opengraph";
import { tryPlaywrightScreenshot } from "@/lib/performance/screenshot-capture/providers/playwright-screenshot";
import { tryTikTokOembedThumbnail } from "@/lib/performance/screenshot-capture/providers/tiktok-oembed";
import { tryYouTubeThumbnail } from "@/lib/performance/screenshot-capture/providers/youtube-thumbnail";
import {
  detectImageContentType,
  fetchImageBuffer,
  uploadPublicationMedia,
} from "@/lib/performance/screenshot-capture/storage";
import type {
  PublicationForScreenshot,
  ScreenshotCaptureAttempt,
  ScreenshotCaptureOutcome,
  ScreenshotCaptureTrigger,
  ScreenshotSource,
} from "@/lib/performance/screenshot-capture/types";

type CaptureOptions = {
  triggeredBy: ScreenshotCaptureTrigger;
  playwrightCapture?: (url: string) => Promise<Buffer | null>;
  force?: boolean;
};

function providerChainForPlatform(platform: string): ScreenshotSource[] {
  if (platform === "instagram") {
    return ["meta_graph_thumbnail", "apify", "opengraph", "playwright"];
  }
  if (platform === "tiktok") {
    return ["tiktok_oembed", "apify", "playwright"];
  }
  if (platform === "youtube") {
    return ["youtube_thumbnail_api", "opengraph", "playwright"];
  }
  if (platform === "facebook") {
    return ["facebook_oembed", "opengraph", "playwright"];
  }
  return ["opengraph", "playwright"];
}

async function runAttempt(
  source: ScreenshotSource,
  ctx: {
    platform: string;
    contentUrl: string | null;
    mediaId: string | null;
    env: ReturnType<typeof getScreenshotCaptureEnv>;
    playwrightCapture?: (url: string) => Promise<Buffer | null>;
  }
): Promise<ScreenshotCaptureAttempt> {
  switch (source) {
    case "meta_graph_thumbnail":
      return tryMetaGraphThumbnail({ mediaId: ctx.mediaId, env: ctx.env });
    case "apify":
      return tryApifyThumbnail({ platform: ctx.platform, contentUrl: ctx.contentUrl, env: ctx.env });
    case "opengraph":
      return tryOpenGraphThumbnail({ contentUrl: ctx.contentUrl });
    case "tiktok_oembed":
      return tryTikTokOembedThumbnail({ contentUrl: ctx.contentUrl });
    case "youtube_thumbnail_api":
      return tryYouTubeThumbnail({
        mediaId: ctx.mediaId,
        contentUrl: ctx.contentUrl,
        env: ctx.env,
      });
    case "facebook_oembed":
      return tryFacebookOembedThumbnail({ contentUrl: ctx.contentUrl });
    case "playwright":
      return tryPlaywrightScreenshot({
        contentUrl: ctx.contentUrl,
        playwrightCapture: ctx.playwrightCapture,
      });
    default:
      return {
        source,
        available: false,
        skippedReason: "Unknown provider.",
      };
  }
}

async function resolveImageBuffer(
  attempt: ScreenshotCaptureAttempt,
  referer?: string | null
): Promise<Buffer | null> {
  if (attempt.imageBuffer) return attempt.imageBuffer;
  if (attempt.imageUrl) return fetchImageBuffer(attempt.imageUrl, { referer });
  return null;
}

/**
 * Capture publication thumbnail/screenshot via provider chain and persist to storage.
 */
export async function capturePublicationScreenshot(
  supabase: SupabaseClient,
  publication: PublicationForScreenshot,
  options: CaptureOptions
): Promise<ScreenshotCaptureOutcome> {
  if (!options.force && publication.screenshot_url) {
    return {
      publicationId: publication.id,
      status: "skipped",
      source: null,
      thumbnailUrl: publication.thumbnail_url,
      screenshotUrl: publication.screenshot_url,
      message: "Screenshot already captured.",
      attempts: [],
    };
  }

  const detection = detectPublicationPlatform({
    id: publication.id,
    campaign_header_id: publication.campaign_header_id,
    platform: publication.platform,
    content_url: publication.content_url,
    external_media_id: publication.external_media_id,
    publication_type: "post",
  });

  const chain = providerChainForPlatform(detection.platform);
  const env = getScreenshotCaptureEnv();
  const contentUrl = detection.canonicalUrl ?? publication.content_url;
  const attempts: ScreenshotCaptureAttempt[] = [];

  let winningSource: ScreenshotSource | null = null;
  let imageBuffer: Buffer | null = null;
  let winningImageUrl: string | null = null;

  for (let i = 0; i < chain.length; i += 1) {
    const source = chain[i]!;
    const attempt = await runAttempt(source, {
      platform: detection.platform,
      contentUrl,
      mediaId: detection.mediaId,
      env,
      playwrightCapture: options.playwrightCapture,
    });
    attempts.push(attempt);

    const status =
      attempt.imageUrl || attempt.imageBuffer
        ? "success"
        : attempt.skippedReason
          ? "skipped"
          : "failed";

    await writeScreenshotSyncLog(supabase, {
      publicationId: publication.id,
      campaignHeaderId: publication.campaign_header_id,
      status,
      source,
      attemptOrder: i + 1,
      message: attempt.skippedReason ?? attempt.error ?? "Provider attempt completed.",
      errorCode: attempt.errorCode,
      error: attempt.error ?? null,
      triggeredBy: options.triggeredBy,
      durationMs: attempt.durationMs,
      completed: true,
    });

    if (attempt.imageUrl || attempt.imageBuffer) {
      imageBuffer = await resolveImageBuffer(attempt, contentUrl);
      if (imageBuffer) {
        winningSource = source;
        break;
      }
      if (attempt.imageUrl && (source === "apify" || source === "opengraph" || source === "meta_graph_thumbnail" || source === "tiktok_oembed" || source === "youtube_thumbnail_api" || source === "facebook_oembed")) {
        winningSource = source;
        winningImageUrl = attempt.imageUrl;
        break;
      }
    }
  }

  if (winningImageUrl && winningSource && !imageBuffer) {
    await persistExternalPublicationPreview(supabase, {
      publicationId: publication.id,
      campaignHeaderId: publication.campaign_header_id,
      previewUrl: winningImageUrl,
      source: winningSource,
    });

    return outcomeFromAttempts(
      publication.id,
      attempts,
      winningImageUrl,
      winningImageUrl,
      winningSource
    );
  }

  if (!imageBuffer || !winningSource) {
    return outcomeFromAttempts(publication.id, attempts, null, null, null);
  }

  const contentType = detectImageContentType(imageBuffer);
  const ext = contentType === "image/png" ? "png" : contentType === "image/jpeg" ? "jpg" : "webp";

  const thumbnailPath = await uploadPublicationMedia(
    supabase,
    publication.id,
    `thumbnail.${ext}`,
    imageBuffer,
    contentType
  );

  let screenshotPath = thumbnailPath;
  if (winningSource === "playwright") {
    screenshotPath = await uploadPublicationMedia(
      supabase,
      publication.id,
      `screenshot.${ext}`,
      imageBuffer,
      contentType
    );
  } else {
    screenshotPath = await uploadPublicationMedia(
      supabase,
      publication.id,
      `screenshot.${ext}`,
      imageBuffer,
      contentType
    );
  }

  await persistPublicationScreenshot(supabase, {
    publicationId: publication.id,
    campaignHeaderId: publication.campaign_header_id,
    thumbnailPath,
    screenshotPath,
    source: winningSource,
  });

  return outcomeFromAttempts(
    publication.id,
    attempts,
    thumbnailPath,
    screenshotPath,
    winningSource
  );
}

export async function capturePublicationScreenshotById(
  supabase: SupabaseClient,
  input: {
    publicationId: string;
    campaignHeaderId: string;
    triggeredBy: ScreenshotCaptureTrigger;
    playwrightCapture?: (url: string) => Promise<Buffer | null>;
    force?: boolean;
  }
): Promise<ScreenshotCaptureOutcome> {
  const { data, error } = await supabase
    .from("campaign_publications")
    .select(
      "id, campaign_header_id, platform, content_url, external_media_id, thumbnail_url, screenshot_url"
    )
    .eq("id", input.publicationId)
    .eq("campaign_header_id", input.campaignHeaderId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Publication not found.");

  return capturePublicationScreenshot(supabase, data as PublicationForScreenshot, {
    triggeredBy: input.triggeredBy,
    playwrightCapture: input.playwrightCapture,
    force: input.force,
  });
}
