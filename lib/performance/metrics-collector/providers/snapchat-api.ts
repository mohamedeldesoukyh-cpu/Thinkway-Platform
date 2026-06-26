import type { ProviderAttemptResult } from "@/lib/performance/metrics-collector/types";

type Ctx = {
  contentUrl: string | null;
  env: { snapchatApiKey: string | null };
};

export async function trySnapchatProvider(ctx: Ctx): Promise<ProviderAttemptResult> {
  if (!ctx.env.snapchatApiKey) {
    return {
      provider: "snapchat_api",
      available: false,
      skippedReason: "SNAPCHAT_API_KEY not configured.",
    };
  }

  if (!ctx.contentUrl) {
    return {
      provider: "snapchat_api",
      available: true,
      error: "Publication has no content URL.",
      errorCode: "missing_url",
    };
  }

  return {
    provider: "snapchat_api",
    available: true,
    error: "Snapchat public content metrics require Marketing API partnership — use Apify or manual import.",
    errorCode: "snapchat_api_limited",
  };
}
