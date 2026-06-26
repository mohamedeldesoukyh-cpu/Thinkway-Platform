export const PUBLICATION_MEDIA_BUCKET = "campaign-publication-media" as const;

export const PUBLICATION_SCREENSHOT_QUEUE = "publication-screenshot" as const;

export function getScreenshotCaptureEnv() {
  return {
    metaGraphAccessToken: process.env.META_GRAPH_ACCESS_TOKEN?.trim() || null,
    apifyToken: process.env.APIFY_TOKEN?.trim() || null,
    apifyInstagramActorId:
      process.env.APIFY_INSTAGRAM_ACTOR_ID?.trim() || "apify/instagram-scraper",
    apifyTikTokActorId:
      process.env.APIFY_TIKTOK_ACTOR_ID?.trim() || "clockworks/tiktok-scraper",
    youtubeApiKey: process.env.YOUTUBE_API_KEY?.trim() || null,
    playwrightEnabled: process.env.METRICS_PLAYWRIGHT_ENABLED === "true",
  };
}
