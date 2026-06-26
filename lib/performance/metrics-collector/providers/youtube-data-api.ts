import type { ProviderAttemptResult } from "@/lib/performance/metrics-collector/types";

type Ctx = {
  mediaId: string | null;
  contentUrl: string | null;
  env: { youtubeApiKey: string | null };
};

export async function tryYouTubeDataApiProvider(ctx: Ctx): Promise<ProviderAttemptResult> {
  if (!ctx.env.youtubeApiKey) {
    return {
      provider: "youtube_data_api",
      available: false,
      skippedReason: "YOUTUBE_API_KEY not configured.",
    };
  }

  const videoId = ctx.mediaId;
  if (!videoId) {
    return {
      provider: "youtube_data_api",
      available: true,
      error: "Could not resolve YouTube video id from URL.",
      errorCode: "missing_video_id",
    };
  }

  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.searchParams.set("part", "statistics");
  url.searchParams.set("id", videoId);
  url.searchParams.set("key", ctx.env.youtubeApiKey);

  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  const body = (await response.json()) as {
    items?: Array<{ statistics?: Record<string, string> }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    return {
      provider: "youtube_data_api",
      available: true,
      error: body.error?.message ?? `YouTube API HTTP ${response.status}`,
      errorCode: "youtube_api_error",
    };
  }

  const stats = body.items?.[0]?.statistics;
  if (!stats) {
    return {
      provider: "youtube_data_api",
      available: true,
      error: "YouTube returned no statistics.",
      errorCode: "youtube_empty",
    };
  }

  const views = stats.viewCount ? Number(stats.viewCount) : null;
  const likes = stats.likeCount ? Number(stats.likeCount) : null;
  const comments = stats.commentCount ? Number(stats.commentCount) : null;

  return {
    provider: "youtube_data_api",
    available: true,
    metrics: {
      views,
      likes,
      comments,
      impressions: views,
    },
    complete: Boolean(views && likes != null),
  };
}
