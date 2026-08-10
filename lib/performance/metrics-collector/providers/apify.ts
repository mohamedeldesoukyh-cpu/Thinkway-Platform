import type { MetricsCollectorEnv } from "@/lib/performance/metrics-collector/config";
import { pickApifyAuthorAvatarUrl } from "@/lib/performance/apify-author-avatar";
import { pickApifyAuthorFollowerCount } from "@/lib/performance/apify-author-followers";
import { pickApifyPreviewImageUrl } from "@/lib/performance/apify-preview-image";
import {
  apifyActorIdForPlatform,
  resolveApifyRunInput,
} from "@/lib/performance/metrics-collector/providers/apify-input";
import { extractPublicationContentFromApifyRow } from "@/lib/performance/metrics-collector/extract-publication-content";
import { mapApifyPayloadToMetrics } from "@/lib/performance/metrics-collector/providers/apify-mapper";
import { extractPublicationDateFromProviderRow } from "@/lib/performance/metrics-collector/extract-publication-date";
import { normalizedContentToStorageFields } from "@/lib/performance/content-normalizer";
import { hasAnyMetric } from "@/lib/performance/metrics-collector/merge-metrics";
import { publicationMetricsFailureStageForCode } from "@/lib/performance/metrics-collector/publication-metrics-failure-stage";
import type { PublicationContent } from "@/lib/performance/metrics-collector/types";
import type { ProviderAttemptResult } from "@/lib/performance/metrics-collector/types";

type Ctx = {
  publication: { content_url: string | null };
  platform: string;
  contentUrl: string | null;
  env: Pick<
    MetricsCollectorEnv,
    | "apifyToken"
    | "apifyInstagramActorId"
    | "apifyTikTokActorId"
    | "apifyFacebookActorId"
    | "apifyYouTubeActorId"
    | "apifySnapchatActorId"
  >;
};

type ApifyRunMeta = {
  runId: string | null;
  datasetId: string | null;
  runStatus: string | null;
};

export async function tryApifyProvider(ctx: Ctx): Promise<ProviderAttemptResult> {
  if (!ctx.env.apifyToken) {
    return {
      provider: "apify",
      available: false,
      skippedReason: "APIFY_TOKEN not configured.",
      errorCode: "provider_unavailable",
      responseSummary: {
        failure_stage: "provider_unavailable",
        actor_invoked: false,
        metrics_found: false,
      },
    };
  }

  const url = ctx.contentUrl ?? ctx.publication.content_url;
  if (!url) {
    return {
      provider: "apify",
      available: true,
      error: "Publication has no content URL.",
      errorCode: "missing_url",
      responseSummary: {
        failure_stage: "unsupported_url",
        actor_invoked: false,
        metrics_found: false,
      },
    };
  }

  const actorId = apifyActorIdForPlatform(ctx.platform, ctx.env);
  if (!actorId) {
    return {
      provider: "apify",
      available: false,
      skippedReason:
        ctx.platform === "snapchat"
          ? "APIFY_SNAPCHAT_ACTOR_ID not configured."
          : "Apify actor id not configured.",
      errorCode: "provider_unavailable",
      responseSummary: {
        failure_stage: "provider_unavailable",
        actor_invoked: false,
        metrics_found: false,
      },
    };
  }

  const resolved = resolveApifyRunInput(ctx.platform, url, actorId);
  if (!resolved.ok) {
    return {
      provider: "apify",
      available: true,
      error: resolved.error,
      errorCode: resolved.errorCode,
      requestPayload: {
        actorId,
        platform: ctx.platform,
        url,
        facebookUrlKind: resolved.facebookUrlKind ?? null,
        actor_invoked: false,
      },
      responseSummary: {
        failure_stage: resolved.failureStage,
        actor_invoked: false,
        apify_run_id: null,
        dataset_id: null,
        metrics_found: false,
        facebookUrlKind: resolved.facebookUrlKind ?? null,
      },
    };
  }

  const input = resolved.input;
  const launch = await launchApifyRunAndFetchItems({
    token: ctx.env.apifyToken,
    actorId,
    input,
  });

  if (!launch.ok) {
    return {
      provider: "apify",
      available: true,
      error: launch.error,
      errorCode: launch.errorCode,
      requestPayload: { actorId, platform: ctx.platform, input, url },
      responseSummary: {
        failure_stage: publicationMetricsFailureStageForCode(launch.errorCode),
        actor_invoked: launch.actorInvoked,
        apify_run_id: launch.meta.runId,
        dataset_id: launch.meta.datasetId,
        run_status: launch.meta.runStatus,
        metrics_found: false,
        facebookUrlKind: resolved.facebookUrlKind ?? null,
      },
    };
  }

  const { items, meta } = launch;
  const payload = items[0];
  const row =
    payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;

  if (!row) {
    return {
      provider: "apify",
      available: true,
      error: "Apify returned an empty dataset for this Facebook URL.",
      errorCode: "empty_dataset",
      requestPayload: { actorId, platform: ctx.platform, input, url },
      responseSummary: {
        failure_stage: "empty_dataset",
        actor_invoked: true,
        apify_run_id: meta.runId,
        dataset_id: meta.datasetId,
        run_status: meta.runStatus,
        metrics_found: false,
        itemCount: items.length,
        facebookUrlKind: resolved.facebookUrlKind ?? null,
      },
    };
  }

  if (typeof row.status === "string" && row.status.toLowerCase() === "unavailable") {
    return {
      provider: "apify",
      available: true,
      error: "Facebook content is unavailable to the Apify actor.",
      errorCode: "apify_unavailable_item",
      requestPayload: { actorId, platform: ctx.platform, input, url },
      responseSummary: {
        failure_stage: "metrics_parsing",
        actor_invoked: true,
        apify_run_id: meta.runId,
        dataset_id: meta.datasetId,
        run_status: meta.runStatus,
        metrics_found: false,
        itemStatus: row.status,
        facebookUrlKind: resolved.facebookUrlKind ?? null,
      },
    };
  }

  const metrics = mapApifyPayloadToMetrics(ctx.platform, payload);
  const previewImageUrl = pickApifyPreviewImageUrl(payload);
  const authorAvatarUrl = pickApifyAuthorAvatarUrl(ctx.platform, payload);
  const authorFollowerCount = pickApifyAuthorFollowerCount(ctx.platform, payload);
  const publicationDate = extractPublicationDateFromProviderRow(row);
  const publicationContent = buildApifyPublicationContent(ctx.platform, row, payload);

  if (!metrics || !hasAnyMetric(metrics)) {
    const apifyError =
      row.errorDescription ?? row.error ?? row.message ?? "Apify returned no usable metrics.";

    return {
      provider: "apify",
      available: true,
      error: String(apifyError),
      errorCode: row.error ? "apify_item_error" : "metrics_parsing",
      requestPayload: { actorId, platform: ctx.platform, input, url },
      responseSummary: {
        failure_stage: publicationMetricsFailureStageForCode(
          row.error ? "apify_item_error" : "metrics_parsing"
        ),
        actor_invoked: true,
        apify_run_id: meta.runId,
        dataset_id: meta.datasetId,
        run_status: meta.runStatus,
        metrics_found: false,
        keys: Object.keys(row),
        error: row.error ?? null,
        facebookUrlKind: resolved.facebookUrlKind ?? null,
      },
    };
  }

  return {
    provider: "apify",
    available: true,
    metrics,
    publicationContent,
    publicationDate,
    complete: Boolean(metrics.views || metrics.likes || metrics.comments),
    requestPayload: { actorId, platform: ctx.platform, input, url },
    responseSummary: {
      failure_stage: null,
      actor_invoked: true,
      apify_run_id: meta.runId,
      dataset_id: meta.datasetId,
      run_status: meta.runStatus,
      metrics_found: true,
      itemCount: items.length,
      previewImageUrl,
      authorAvatarUrl,
      authorFollowerCount,
      publicationDate,
      facebookUrlKind: resolved.facebookUrlKind ?? null,
      publicationContent: publicationContent
        ? {
            caption: Boolean(publicationContent.caption),
            hashtag_count: publicationContent.hashtag_count,
            mention_count: publicationContent.mention_count,
          }
        : null,
      fields: Object.keys(metrics).filter(
        (key) => metrics[key as keyof typeof metrics] != null
      ),
    },
  };
}

type LaunchResult =
  | {
      ok: true;
      items: unknown[];
      meta: ApifyRunMeta;
      actorInvoked: true;
    }
  | {
      ok: false;
      error: string;
      errorCode: string;
      meta: ApifyRunMeta;
      actorInvoked: boolean;
    };

async function launchApifyRunAndFetchItems(input: {
  token: string;
  actorId: string;
  input: Record<string, unknown>;
}): Promise<LaunchResult> {
  const emptyMeta: ApifyRunMeta = { runId: null, datasetId: null, runStatus: null };

  const runResponse = await fetch(
    `https://api.apify.com/v2/acts/${encodeURIComponent(input.actorId)}/runs?token=${input.token}&waitForFinish=120`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input.input),
      signal: AbortSignal.timeout(130_000),
    }
  );

  const runBody = (await runResponse.json().catch(() => null)) as
    | { data?: Record<string, unknown>; error?: { message?: string } }
    | Record<string, unknown>
    | null;

  if (!runResponse.ok) {
    const message =
      (runBody && "error" in runBody && runBody.error && typeof runBody.error === "object"
        ? (runBody.error as { message?: string }).message
        : null) ?? `Apify HTTP ${runResponse.status}`;
    return {
      ok: false,
      error: String(message),
      errorCode: "actor_launch_failed",
      meta: emptyMeta,
      actorInvoked: false,
    };
  }

  let data =
    runBody && typeof runBody === "object" && "data" in runBody && runBody.data
      ? (runBody.data as Record<string, unknown>)
      : ((runBody as Record<string, unknown> | null) ?? {});

  let meta: ApifyRunMeta = {
    runId: typeof data.id === "string" ? data.id : null,
    datasetId: typeof data.defaultDatasetId === "string" ? data.defaultDatasetId : null,
    runStatus: typeof data.status === "string" ? data.status : null,
  };

  // waitForFinish can still return early (READY/RUNNING) — poll until terminal.
  if (
    meta.runId &&
    meta.runStatus &&
    !["SUCCEEDED", "SUCCEEDED_WITH_ISSUES", "FAILED", "ABORTED", "TIMED-OUT"].includes(
      meta.runStatus
    )
  ) {
    const polled = await pollApifyRunUntilSettled(input.token, meta.runId);
    if (polled) {
      data = polled;
      meta = {
        runId: typeof polled.id === "string" ? polled.id : meta.runId,
        datasetId:
          typeof polled.defaultDatasetId === "string"
            ? polled.defaultDatasetId
            : meta.datasetId,
        runStatus: typeof polled.status === "string" ? polled.status : meta.runStatus,
      };
    }
  }

  if (meta.runStatus && !["SUCCEEDED", "SUCCEEDED_WITH_ISSUES"].includes(meta.runStatus)) {
    return {
      ok: false,
      error: `Apify run ended with status ${meta.runStatus}.`,
      errorCode: "actor_launch_failed",
      meta,
      actorInvoked: true,
    };
  }

  if (!meta.datasetId) {
    return {
      ok: false,
      error: "Apify run completed without a dataset id.",
      errorCode: "dataset_retrieval_failed",
      meta,
      actorInvoked: true,
    };
  }

  const itemsResponse = await fetch(
    `https://api.apify.com/v2/datasets/${encodeURIComponent(meta.datasetId)}/items?token=${input.token}&clean=true&format=json`,
    { signal: AbortSignal.timeout(60_000) }
  );

  if (!itemsResponse.ok) {
    return {
      ok: false,
      error: `Apify dataset HTTP ${itemsResponse.status}`,
      errorCode: "dataset_retrieval_failed",
      meta,
      actorInvoked: true,
    };
  }

  const items = (await itemsResponse.json()) as unknown[];
  if (!Array.isArray(items)) {
    return {
      ok: false,
      error: "Apify dataset response was not an array.",
      errorCode: "dataset_retrieval_failed",
      meta,
      actorInvoked: true,
    };
  }

  return { ok: true, items, meta, actorInvoked: true };
}

async function pollApifyRunUntilSettled(
  token: string,
  runId: string,
  maxWaitMs = 120_000
): Promise<Record<string, unknown> | null> {
  const started = Date.now();
  while (Date.now() - started < maxWaitMs) {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    const response = await fetch(
      `https://api.apify.com/v2/actor-runs/${encodeURIComponent(runId)}?token=${token}`,
      { signal: AbortSignal.timeout(30_000) }
    );
    if (!response.ok) return null;
    const body = (await response.json()) as { data?: Record<string, unknown> };
    const data = body.data ?? null;
    if (!data) return null;
    const status = typeof data.status === "string" ? data.status : null;
    if (
      status &&
      ["SUCCEEDED", "SUCCEEDED_WITH_ISSUES", "FAILED", "ABORTED", "TIMED-OUT"].includes(status)
    ) {
      return data;
    }
  }
  return null;
}

function buildApifyPublicationContent(
  platform: string,
  row: Record<string, unknown> | null,
  payload: unknown
): PublicationContent | null {
  const extracted = extractPublicationContentFromApifyRow(platform, payload);
  if (!extracted) return null;

  const storage = normalizedContentToStorageFields(extracted);
  const hashtagsFromProvider = hasProviderHashtags(row);
  const mentionsFromProvider = hasProviderMentions(row);

  return {
    ...storage,
    caption_source: "sync",
    hashtags_source: hashtagsFromProvider ? "sync" : "derived",
    mentions_source: mentionsFromProvider ? "sync" : "derived",
  };
}

function hasProviderHashtags(row: Record<string, unknown> | null): boolean {
  if (!row) return false;
  const hashtags = row.hashtags;
  if (Array.isArray(hashtags) && hashtags.length > 0) return true;
  const challenges = row.challenges;
  if (Array.isArray(challenges) && challenges.length > 0) return true;
  const textExtra = row.textExtra;
  return (
    Array.isArray(textExtra) &&
    textExtra.some((item) => item && typeof item === "object" && (item as { type?: string }).type === "hashtag")
  );
}

function hasProviderMentions(row: Record<string, unknown> | null): boolean {
  if (!row) return false;
  const mentions = row.mentions;
  if (Array.isArray(mentions) && mentions.length > 0) return true;
  const detailedMentions = row.detailedMentions;
  if (Array.isArray(detailedMentions) && detailedMentions.length > 0) return true;
  const textExtra = row.textExtra;
  if (
    Array.isArray(textExtra) &&
    textExtra.some((item) => item && typeof item === "object" && (item as { type?: string }).type === "user")
  ) {
    return true;
  }
  if (typeof row.ownerUsername === "string" && row.ownerUsername.trim().length > 0) return true;
  if (typeof row.author === "string" && row.author.trim().length > 0) return true;
  const authorMeta = row.authorMeta;
  return (
    authorMeta != null &&
    typeof authorMeta === "object" &&
    typeof (authorMeta as { name?: unknown }).name === "string" &&
    ((authorMeta as { name: string }).name).trim().length > 0
  );
}
