import type { ProviderAttemptResult } from "@/lib/performance/metrics-collector/types";

type Ctx = {
  contentUrl: string | null;
  mediaId: string | null;
  env: { metaGraphAccessToken: string | null };
};

export async function tryMetaGraphProvider(ctx: Ctx): Promise<ProviderAttemptResult> {
  if (!ctx.env.metaGraphAccessToken) {
    return {
      provider: "meta_graph_api",
      available: false,
      skippedReason: "META_GRAPH_ACCESS_TOKEN not configured.",
    };
  }

  const mediaId = ctx.mediaId;
  if (!mediaId) {
    return {
      provider: "meta_graph_api",
      available: true,
      error: "Could not resolve Instagram media id from URL.",
      errorCode: "missing_media_id",
    };
  }

  const url = new URL(`https://graph.facebook.com/v21.0/${mediaId}`);
  url.searchParams.set(
    "fields",
    "insights.metric(impressions,reach,likes,comments,shares,saved,views),like_count,comments_count"
  );
  url.searchParams.set("access_token", ctx.env.metaGraphAccessToken);

  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  const body = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    return {
      provider: "meta_graph_api",
      available: true,
      error: String(body.error ?? `Meta Graph HTTP ${response.status}`),
      errorCode: "meta_graph_error",
    };
  }

  const insights = (body.insights as { data?: Array<{ name: string; values?: Array<{ value: number }> }> })
    ?.data;
  const metricMap = new Map<string, number>();
  for (const item of insights ?? []) {
    const value = item.values?.[0]?.value;
    if (item.name && typeof value === "number") metricMap.set(item.name, value);
  }

  return {
    provider: "meta_graph_api",
    available: true,
    metrics: {
      impressions: metricMap.get("impressions") ?? null,
      reach: metricMap.get("reach") ?? null,
      views: metricMap.get("views") ?? null,
      likes: metricMap.get("likes") ?? (body.like_count as number | undefined) ?? null,
      comments:
        metricMap.get("comments") ?? (body.comments_count as number | undefined) ?? null,
      shares: metricMap.get("shares") ?? null,
      saves: metricMap.get("saved") ?? null,
    },
    complete: metricMap.size > 0,
  };
}
