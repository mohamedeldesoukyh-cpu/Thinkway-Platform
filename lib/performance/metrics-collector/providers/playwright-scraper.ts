import type { ProviderAttemptResult } from "@/lib/performance/metrics-collector/types";

type Ctx = {
  contentUrl: string | null;
  platform: string;
  env: { playwrightEnabled: boolean };
  playwrightExtract?: (
    url: string,
    platform: string
  ) => Promise<import("@/lib/performance/metrics-collector/types").Partial<
    import("@/lib/performance/metrics-collector/types").CollectedMetrics
  > | null>;
};

export async function tryPlaywrightProvider(ctx: Ctx): Promise<ProviderAttemptResult> {
  if (!ctx.playwrightExtract) {
    return {
      provider: "playwright",
      available: false,
      skippedReason: "Playwright extraction runs in discovery-worker only.",
    };
  }

  if (!ctx.contentUrl) {
    return {
      provider: "playwright",
      available: true,
      error: "Publication has no content URL.",
      errorCode: "missing_url",
    };
  }

  const raw = await ctx.playwrightExtract(ctx.contentUrl, ctx.platform);
  if (!raw) {
    return {
      provider: "playwright",
      available: true,
      error: "Playwright could not extract metrics from page.",
      errorCode: "playwright_empty",
      requestPayload: { url: ctx.contentUrl, platform: ctx.platform },
    };
  }

  const { publicationDate, ...metrics } = raw;

  return {
    provider: "playwright",
    available: true,
    metrics,
    publicationDate: publicationDate ?? null,
    complete: Boolean(metrics.views || metrics.likes),
    requestPayload: { url: ctx.contentUrl, platform: ctx.platform },
    responseSummary: {
      fields: Object.keys(metrics).filter((k) => metrics[k as keyof typeof metrics] != null),
      publicationDate: publicationDate ?? null,
    },
  };
}
