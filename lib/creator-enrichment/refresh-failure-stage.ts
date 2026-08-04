/**
 * Manual refresh failure stages + user-facing toast copy.
 * Never reuse budget messaging for unrelated failures.
 */

export const REFRESH_FAILURE_STAGES = [
  "budget_verification",
  "actor_launch",
  "dataset_retrieval",
  "snapshot_import",
  "dna_enrichment",
  "eci_generation",
  "no_profile_changes",
  "unknown",
] as const;

export type RefreshFailureStage = (typeof REFRESH_FAILURE_STAGES)[number];

export type RefreshToastTone = "success" | "message" | "error";

export type RefreshToastContent = {
  tone: RefreshToastTone;
  title: string;
  description?: string;
};

const STAGE_TOAST: Record<RefreshFailureStage, RefreshToastContent> = {
  budget_verification: {
    tone: "error",
    title: "Budget verification failed",
    description:
      "Apify daily budget usage could not be verified or limits blocked acquisition. Check Discovery Control Center and DISCOVERY_APIFY_MAX_* on Vercel and Railway.",
  },
  actor_launch: {
    tone: "error",
    title: "Actor launch failed",
    description: "Apify did not start a profile actor run for this refresh.",
  },
  dataset_retrieval: {
    tone: "error",
    title: "Dataset retrieval failed",
    description: "The Apify run started but dataset items could not be retrieved.",
  },
  snapshot_import: {
    tone: "error",
    title: "Snapshot import failed",
    description: "Provider data could not be persisted as an intelligence snapshot.",
  },
  dna_enrichment: {
    tone: "error",
    title: "DNA enrichment failed",
    description: "Profile snapshot imported, but Creator DNA bridge did not complete.",
  },
  eci_generation: {
    tone: "error",
    title: "ECI generation failed",
    description: "Creator DNA updated, but Enterprise Creator Intelligence did not regenerate.",
  },
  no_profile_changes: {
    tone: "message",
    title: "No profile changes detected",
    description: "Live Apify refresh completed without meaningful field updates.",
  },
  unknown: {
    tone: "error",
    title: "Creator refresh failed",
    description: "Confirm discovery-worker is running and review the refresh execution trace.",
  },
};

/** Classify a free-text / structured failure into a refresh stage. */
export function classifyRefreshFailureStage(
  reason: string | null | undefined,
  explicitStage?: string | null
): RefreshFailureStage {
  if (explicitStage && (REFRESH_FAILURE_STAGES as readonly string[]).includes(explicitStage)) {
    return explicitStage as RefreshFailureStage;
  }

  const r = (reason ?? "").toLowerCase();
  if (!r.trim()) return "unknown";

  if (
    r.includes("budget") ||
    r.includes("usage_unverified") ||
    r.includes("usage could not be verified") ||
    r.includes("request limit") ||
    r.includes("credit limit") ||
    r.includes("maxrequestsperday") ||
    r.includes("maxcreditsperday") ||
    r.includes("service-role") ||
    r.includes("service role") ||
    r.includes("supabase client was null")
  ) {
    return "budget_verification";
  }
  if (
    r.includes("dataset") ||
    r.includes("dataset_id") ||
    r.includes("dataset items")
  ) {
    return "dataset_retrieval";
  }
  if (r.includes("dna")) {
    return "dna_enrichment";
  }
  if (
    r.includes("eci") ||
    r.includes("creator intelligence") ||
    r.includes("intelligence bundle")
  ) {
    return "eci_generation";
  }
  if (
    r.includes("snapshot") ||
    r.includes("normalize") ||
    r.includes("raw payload") ||
    r.includes("ipl persist")
  ) {
    return "snapshot_import";
  }
  if (
    r.includes("actor") ||
    r.includes("apify run") ||
    r.includes("start run") ||
    r.includes("apify_token") ||
    r.includes("apify token") ||
    r.includes("no apify actor")
  ) {
    return "actor_launch";
  }
  if (
    r.includes("no change") ||
    r.includes("no profile change") ||
    r.includes("without new") ||
    r.includes("unchanged")
  ) {
    return "no_profile_changes";
  }

  return "unknown";
}

export function toastContentForRefreshFailureStage(
  stage: RefreshFailureStage,
  failureReason?: string | null
): RefreshToastContent {
  const base = STAGE_TOAST[stage];
  if (failureReason?.trim() && stage !== "budget_verification") {
    return {
      ...base,
      description: failureReason.trim(),
    };
  }
  if (failureReason?.trim() && stage === "budget_verification") {
    // Keep stage title; surface the concrete verification detail.
    return {
      ...base,
      description: failureReason.trim(),
    };
  }
  return base;
}

/**
 * Resolve toast for a finished manual live_apify poll.
 * Failed sync → stage-specific error. Completed without Apify source → no changes
 * (never budget copy). Completed with Apify source → success.
 */
export function resolveManualRefreshToast(input: {
  syncStatus: "completed" | "failed" | string;
  refreshSource?: string | null;
  enrichmentSource?: string | null;
  enrichmentStatus?: string | null;
  failureStage?: string | null;
  failureReason?: string | null;
}): RefreshToastContent {
  const live = input.refreshSource === "live_apify";

  if (input.syncStatus === "failed") {
    const stage = classifyRefreshFailureStage(input.failureReason, input.failureStage);
    return toastContentForRefreshFailureStage(stage, input.failureReason);
  }

  if (!live) {
    return { tone: "success", title: "Creator metrics updated" };
  }

  const liveFromApify =
    input.enrichmentSource === "apify" &&
    (input.enrichmentStatus === "enriched" || input.enrichmentStatus === "partial");

  if (liveFromApify) {
    return { tone: "success", title: "Creator refreshed live from Apify" };
  }

  // Completed poll without Apify attribution — never imply budget failure.
  if (input.failureStage || input.failureReason) {
    const stage = classifyRefreshFailureStage(input.failureReason, input.failureStage);
    return toastContentForRefreshFailureStage(stage, input.failureReason);
  }

  return toastContentForRefreshFailureStage("no_profile_changes");
}
