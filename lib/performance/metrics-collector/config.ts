export type MetricsCollectorEnv = {
  metaGraphAccessToken: string | null;
  brightDataApiKey: string | null;
  brightDataInstagramDatasetId: string | null;
  apifyToken: string | null;
  apifyInstagramActorId: string | null;
  apifyTikTokActorId: string | null;
  apifyFacebookActorId: string | null;
  /** Profile/page enrichment — distinct from post metrics scraper. */
  apifyFacebookProfileActorId: string | null;
  apifyYouTubeActorId: string | null;
  apifySnapchatActorId: string | null;
  tiktokClientKey: string | null;
  tiktokClientSecret: string | null;
  youtubeApiKey: string | null;
  facebookGraphAccessToken: string | null;
  snapchatApiKey: string | null;
  playwrightEnabled: boolean;
};

export function getMetricsCollectorEnv(): MetricsCollectorEnv {
  return {
    metaGraphAccessToken: process.env.META_GRAPH_ACCESS_TOKEN?.trim() || null,
    brightDataApiKey: process.env.BRIGHTDATA_API_KEY?.trim() || null,
    brightDataInstagramDatasetId:
      process.env.BRIGHTDATA_INSTAGRAM_DATASET_ID?.trim() || null,
    apifyToken: process.env.APIFY_TOKEN?.trim() || null,
    apifyInstagramActorId:
      process.env.APIFY_INSTAGRAM_ACTOR_ID?.trim() || "apify/instagram-scraper",
    apifyTikTokActorId:
      process.env.APIFY_TIKTOK_ACTOR_ID?.trim() || "clockworks/tiktok-scraper",
    apifyFacebookActorId:
      process.env.APIFY_FACEBOOK_ACTOR_ID?.trim() || "apify/facebook-posts-scraper",
    apifyFacebookProfileActorId:
      process.env.APIFY_FACEBOOK_PROFILE_ACTOR_ID?.trim() ||
      "apify/facebook-pages-scraper",
    apifyYouTubeActorId:
      process.env.APIFY_YOUTUBE_ACTOR_ID?.trim() || "streamers/youtube-scraper",
    apifySnapchatActorId: process.env.APIFY_SNAPCHAT_ACTOR_ID?.trim() || null,
    tiktokClientKey: process.env.TIKTOK_CLIENT_KEY?.trim() || null,
    tiktokClientSecret: process.env.TIKTOK_CLIENT_SECRET?.trim() || null,
    youtubeApiKey: process.env.YOUTUBE_API_KEY?.trim() || null,
    facebookGraphAccessToken:
      process.env.FACEBOOK_GRAPH_ACCESS_TOKEN?.trim() ||
      process.env.META_GRAPH_ACCESS_TOKEN?.trim() ||
      null,
    snapchatApiKey: process.env.SNAPCHAT_API_KEY?.trim() || null,
    playwrightEnabled: process.env.METRICS_PLAYWRIGHT_ENABLED === "true",
  };
}
