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
    };
  }

  if (!ctx.mediaId) {
    return {
      provider: "facebook_graph_api",
      available: true,
      error: "Could not resolve Facebook post id from URL.",
      errorCode: "missing_media_id",
    };
  }

  return tryMetaGraphProvider({
    contentUrl: ctx.contentUrl,
    mediaId: ctx.mediaId,
    env: { metaGraphAccessToken: ctx.env.facebookGraphAccessToken },
  }).then((result) => ({ ...result, provider: "facebook_graph_api" as const }));
}
