import type { ProviderAttemptResult } from "@/lib/performance/metrics-collector/types";
import { extractPublicationDateFromProviderRow } from "@/lib/performance/metrics-collector/extract-publication-date";

type Ctx = {
  contentUrl: string | null;
  env: {
    brightDataApiKey: string | null;
    brightDataInstagramDatasetId: string | null;
  };
};

export async function tryBrightDataProvider(ctx: Ctx): Promise<ProviderAttemptResult> {
  if (!ctx.env.brightDataApiKey || !ctx.env.brightDataInstagramDatasetId) {
    return {
      provider: "brightdata",
      available: false,
      skippedReason: "Bright Data credentials not configured.",
    };
  }

  if (!ctx.contentUrl) {
    return {
      provider: "brightdata",
      available: true,
      error: "Publication has no content URL.",
      errorCode: "missing_url",
    };
  }

  const response = await fetch(
    `https://api.brightdata.com/datasets/v3/trigger?dataset_id=${encodeURIComponent(ctx.env.brightDataInstagramDatasetId)}&include_errors=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ctx.env.brightDataApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{ url: ctx.contentUrl }]),
      signal: AbortSignal.timeout(60_000),
    }
  );

  if (!response.ok) {
    return {
      provider: "brightdata",
      available: true,
      error: `Bright Data HTTP ${response.status}`,
      errorCode: "brightdata_http_error",
    };
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const row = (Array.isArray(payload) ? payload[0] : payload) as Record<string, unknown> | undefined;
  const publicationDate = extractPublicationDateFromProviderRow(row ?? null);

  return {
    provider: "brightdata",
    available: true,
    metrics: {
      views: typeof row?.views === "number" ? row.views : null,
      likes: typeof row?.likes === "number" ? row.likes : null,
      comments: typeof row?.comments === "number" ? row.comments : null,
      shares: typeof row?.shares === "number" ? row.shares : null,
      impressions: typeof row?.impressions === "number" ? row.impressions : null,
      reach: typeof row?.reach === "number" ? row.reach : null,
    },
    publicationDate,
    complete: false,
  };
}
