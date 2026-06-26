import type { MetricsCollectorEnv } from "@/lib/performance/metrics-collector/config";
import type {
  MetricsProviderId,
  PlaywrightMetricsExtractFn,
  ProviderAttemptResult,
  PublicationForCollection,
} from "@/lib/performance/metrics-collector/types";
import { tryApifyProvider } from "@/lib/performance/metrics-collector/providers/apify";
import { tryBrightDataProvider } from "@/lib/performance/metrics-collector/providers/brightdata";
import { tryFacebookGraphProvider } from "@/lib/performance/metrics-collector/providers/facebook-graph-api";
import { tryMetaGraphProvider } from "@/lib/performance/metrics-collector/providers/meta-graph-api";
import { tryPlaywrightProvider } from "@/lib/performance/metrics-collector/providers/playwright-scraper";
import { trySnapchatProvider } from "@/lib/performance/metrics-collector/providers/snapchat-api";
import { tryTikTokApiProvider } from "@/lib/performance/metrics-collector/providers/tiktok-api";
import { tryYouTubeDataApiProvider } from "@/lib/performance/metrics-collector/providers/youtube-data-api";
import { tryYouTubePublicMetadataProvider } from "@/lib/performance/metrics-collector/providers/youtube-public-metadata";

type ProviderContext = {
  publication: PublicationForCollection;
  platform: string;
  contentUrl: string | null;
  mediaId: string | null;
  env: MetricsCollectorEnv;
  playwrightExtract?: PlaywrightMetricsExtractFn;
};

const PROVIDERS: Record<
  MetricsProviderId,
  (ctx: ProviderContext) => Promise<ProviderAttemptResult>
> = {
  meta_graph_api: tryMetaGraphProvider,
  brightdata: tryBrightDataProvider,
  apify: tryApifyProvider,
  playwright: tryPlaywrightProvider,
  tiktok_api: tryTikTokApiProvider,
  youtube_data_api: tryYouTubeDataApiProvider,
  youtube_public_metadata: tryYouTubePublicMetadataProvider,
  facebook_graph_api: tryFacebookGraphProvider,
  snapchat_api: trySnapchatProvider,
  manual_import: async () => ({
    provider: "manual_import",
    available: false,
    skippedReason: "Manual import is not an automated provider.",
  }),
};

export async function runProvider(
  providerId: MetricsProviderId,
  ctx: ProviderContext
): Promise<ProviderAttemptResult> {
  const handler = PROVIDERS[providerId];
  if (!handler) {
    return {
      provider: providerId,
      available: false,
      skippedReason: "Unknown provider.",
    };
  }

  const started = Date.now();
  try {
    const result = await handler(ctx);
    return { ...result, durationMs: Date.now() - started };
  } catch (error) {
    return {
      provider: providerId,
      available: true,
      error: error instanceof Error ? error.message : String(error),
      errorCode: "provider_exception",
      durationMs: Date.now() - started,
    };
  }
}
