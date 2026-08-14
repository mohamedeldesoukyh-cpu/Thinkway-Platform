export const SCREENSHOT_SOURCES = [
  "meta_graph_thumbnail",
  "instagram_media_redirect",
  "instagram_oembed",
  "apify",
  "opengraph",
  "playwright",
  "youtube_thumbnail_api",
  "tiktok_oembed",
  "facebook_oembed",
] as const;

export type ScreenshotSource = (typeof SCREENSHOT_SOURCES)[number];

export type PublicationForScreenshot = {
  id: string;
  campaign_header_id: string;
  platform: string;
  content_url: string | null;
  external_media_id: string | null;
  thumbnail_url: string | null;
  screenshot_url: string | null;
};

export type ScreenshotCaptureAttempt = {
  source: ScreenshotSource;
  available: boolean;
  skippedReason?: string;
  error?: string;
  errorCode?: string;
  imageUrl?: string | null;
  imageBuffer?: Buffer | null;
  durationMs?: number;
};

export type ScreenshotCaptureOutcome = {
  publicationId: string;
  status: "completed" | "failed" | "skipped";
  source: ScreenshotSource | null;
  thumbnailUrl: string | null;
  screenshotUrl: string | null;
  message: string;
  attempts: ScreenshotCaptureAttempt[];
};

export type ScreenshotCaptureTrigger =
  | "metrics_collected"
  | "manual_refresh"
  | "bulk_refresh"
  | "scheduled_worker"
  | "screenshot_audit_requeue"
  | "refresh_affected_creator_metrics";

export type PublicationScreenshotJobData = {
  publicationId: string;
  campaignHeaderId: string;
  triggeredBy: ScreenshotCaptureTrigger;
};
