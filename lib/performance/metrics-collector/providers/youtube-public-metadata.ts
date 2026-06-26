import type { ProviderAttemptResult } from "@/lib/performance/metrics-collector/types";

type Ctx = {
  contentUrl: string | null;
  mediaId: string | null;
};

function parseCount(raw: string | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export async function tryYouTubePublicMetadataProvider(
  ctx: Ctx
): Promise<ProviderAttemptResult> {
  const videoId = ctx.mediaId;
  const url = ctx.contentUrl;
  if (!videoId && !url) {
    return {
      provider: "youtube_public_metadata",
      available: true,
      error: "Missing YouTube video id or URL.",
      errorCode: "missing_video_id",
    };
  }

  const oembedUrl = new URL("https://www.youtube.com/oembed");
  oembedUrl.searchParams.set("url", url ?? `https://www.youtube.com/watch?v=${videoId}`);
  oembedUrl.searchParams.set("format", "json");

  const oembedRes = await fetch(oembedUrl, { signal: AbortSignal.timeout(20_000) });
  if (!oembedRes.ok) {
    return {
      provider: "youtube_public_metadata",
      available: true,
      error: `YouTube oEmbed HTTP ${oembedRes.status}`,
      errorCode: "youtube_oembed_error",
    };
  }

  let views: number | null = null;
  let likes: number | null = null;

  if (url) {
    try {
      const pageRes = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ThinkwayMetrics/1.0)" },
        signal: AbortSignal.timeout(25_000),
      });
      if (pageRes.ok) {
        const html = await pageRes.text();
        views =
          parseCount(html.match(/"viewCount"\s*:\s*"(\d+)"/)?.[1]) ??
          parseCount(html.match(/"viewCount"\s*:\s*(\d+)/)?.[1]);
        likes =
          parseCount(html.match(/"likeCount"\s*:\s*"(\d+)"/)?.[1]) ??
          parseCount(html.match(/"likeCount"\s*:\s*(\d+)/)?.[1]);
      }
    } catch {
      // oEmbed succeeded; page scrape optional
    }
  }

  if (views == null && likes == null) {
    return {
      provider: "youtube_public_metadata",
      available: true,
      error: "Public metadata did not expose view/like counts.",
      errorCode: "youtube_public_empty",
    };
  }

  return {
    provider: "youtube_public_metadata",
    available: true,
    metrics: {
      views,
      likes,
      impressions: views,
    },
    complete: views != null,
  };
}
