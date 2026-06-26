import type { ProviderAttemptResult } from "@/lib/performance/metrics-collector/types";

type Ctx = {
  contentUrl: string | null;
  mediaId: string | null;
  env: { tiktokClientKey: string | null; tiktokClientSecret: string | null };
};

export async function tryTikTokApiProvider(ctx: Ctx): Promise<ProviderAttemptResult> {
  if (!ctx.env.tiktokClientKey || !ctx.env.tiktokClientSecret) {
    return {
      provider: "tiktok_api",
      available: false,
      skippedReason: "TikTok API credentials not configured.",
    };
  }

  if (!ctx.contentUrl && !ctx.mediaId) {
    return {
      provider: "tiktok_api",
      available: true,
      error: "Missing TikTok content URL or media id.",
      errorCode: "missing_url",
    };
  }

  return {
    provider: "tiktok_api",
    available: true,
    error:
      "TikTok official video metrics API requires approved Research/Display product access — falling through to external providers.",
    errorCode: "tiktok_api_not_licensed",
  };
}
