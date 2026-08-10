import type { ProviderAttemptResult } from "@/lib/performance/metrics-collector/types";
import { tryMetaGraphProvider } from "@/lib/performance/metrics-collector/providers/meta-graph-api";

type Ctx = {
  contentUrl: string | null;
  mediaId: string | null;
  env: { facebookGraphAccessToken: string | null };
};

export async function tryFacebookGraphProvider(ctx: Ctx): Promise<ProviderAttemptResult> {
  if (!ctx.env.facebookGraphAccessToken) {
    return {
      provider: "facebook_graph_api",
      available: false,
      skippedReason: "FACEBOOK_GRAPH_ACCESS_TOKEN not configured.",
      errorCode: "provider_unavailable",
      responseSummary: {
        failure_stage: "provider_unavailable",
        actor_invoked: false,
        metrics_found: false,
      },
    };
  }

  if (!ctx.mediaId) {
    return {
      provider: "facebook_graph_api",
      available: true,
      error: "Could not resolve Facebook post id from URL.",
      errorCode: "missing_media_id",
      responseSummary: {
        failure_stage: "provider_permission",
        actor_invoked: false,
        metrics_found: false,
      },
    };
  }

  const result = await tryMetaGraphProvider({
    contentUrl: ctx.contentUrl,
    mediaId: ctx.mediaId,
    env: { metaGraphAccessToken: ctx.env.facebookGraphAccessToken },
  });

  return {
    ...result,
    provider: "facebook_graph_api" as const,
    errorCode:
      result.errorCode === "meta_graph_error"
        ? "provider_permission"
        : result.errorCode,
    responseSummary: {
      ...(result.responseSummary ?? {}),
      failure_stage: result.error
        ? result.errorCode === "missing_media_id"
          ? "provider_permission"
          : "provider_permission"
        : null,
      metrics_found: Boolean(result.metrics && Object.values(result.metrics).some((v) => v != null)),
    },
  };
}
