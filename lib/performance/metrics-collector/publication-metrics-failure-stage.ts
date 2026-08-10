/**
 * Publication metrics failure stages (execution-trace vocabulary).
 * Aligns with creator enrichment stage discipline without forking a second metrics model.
 */

export const PUBLICATION_METRICS_FAILURE_STAGES = [
  "budget_verification",
  "provider_unavailable",
  "provider_permission",
  "unsupported_url",
  "actor_launch",
  "dataset_retrieval",
  "empty_dataset",
  "metrics_parsing",
  "provider_exception",
  "unknown",
] as const;

export type PublicationMetricsFailureStage =
  (typeof PUBLICATION_METRICS_FAILURE_STAGES)[number];

/** Soft acquisition outcomes → manual_required (not Failed). */
export const SOFT_PUBLICATION_METRICS_ERROR_CODES = new Set([
  "budget_blocked",
  "budget_unverified",
  "provider_unavailable",
  "provider_permission",
  "missing_media_id",
  "meta_graph_error",
  "unsupported_url",
  "unsupported_url_type",
  "apify_empty",
  "apify_item_error",
  "apify_unavailable_item",
  "empty_dataset",
  "metrics_parsing",
  "no_metrics",
]);

/** Hard infrastructure / unexpected failures → Failed. */
export const HARD_PUBLICATION_METRICS_ERROR_CODES = new Set([
  "apify_http_error",
  "actor_launch_failed",
  "dataset_retrieval_failed",
  "provider_exception",
  "job_exhausted",
]);

export function isSoftPublicationMetricsFailure(
  errorCode: string | null | undefined
): boolean {
  if (!errorCode) return true;
  if (HARD_PUBLICATION_METRICS_ERROR_CODES.has(errorCode)) return false;
  if (SOFT_PUBLICATION_METRICS_ERROR_CODES.has(errorCode)) return true;
  // Unknown codes default soft so UI does not over-report Failed.
  return true;
}

export function publicationMetricsFailureStageForCode(
  errorCode: string | null | undefined
): PublicationMetricsFailureStage {
  switch (errorCode) {
    case "budget_blocked":
    case "budget_unverified":
      return "budget_verification";
    case "provider_unavailable":
      return "provider_unavailable";
    case "provider_permission":
    case "missing_media_id":
    case "meta_graph_error":
      return "provider_permission";
    case "unsupported_url":
    case "unsupported_url_type":
      return "unsupported_url";
    case "actor_launch_failed":
    case "apify_http_error":
      return "actor_launch";
    case "dataset_retrieval_failed":
      return "dataset_retrieval";
    case "apify_empty":
    case "empty_dataset":
      return "empty_dataset";
    case "apify_item_error":
    case "apify_unavailable_item":
    case "metrics_parsing":
    case "no_metrics":
      return "metrics_parsing";
    case "provider_exception":
      return "provider_exception";
    default:
      return "unknown";
  }
}
