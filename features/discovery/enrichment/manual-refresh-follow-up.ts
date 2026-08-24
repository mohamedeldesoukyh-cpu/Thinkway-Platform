export type ManualRefreshFollowUp =
  | { type: "cached" }
  | { type: "completed" }
  | { type: "poll" }
  | { type: "queued_without_unified_id" }
  | { type: "error"; message: string };

type RefreshActionSnapshot = {
  ok: boolean;
  queued: boolean;
  message: string;
  refreshSource?: string | null;
  skipped?: boolean;
};

function isAlreadyInProgress(result: RefreshActionSnapshot) {
  if (!result.ok || result.queued) return false;
  return /already in progress|already_running|enrichment_already_in_progress/i.test(
    result.message
  );
}

/** Decide what the Refresh Metrics UI should do after the server action returns. */
export function resolveManualRefreshFollowUp(input: {
  result: RefreshActionSnapshot;
  unifiedId?: string | null;
}): ManualRefreshFollowUp {
  if (input.result.refreshSource === "cached_snapshot" && input.result.ok && !input.result.queued) {
    return { type: "cached" };
  }

  if (input.result.ok && !input.result.queued && isAlreadyInProgress(input.result)) {
    if (!input.unifiedId) return { type: "queued_without_unified_id" };
    return { type: "poll" };
  }

  if (input.result.skipped) {
    return { type: "error", message: input.result.message };
  }

  if (input.result.ok && !input.result.queued && !isAlreadyInProgress(input.result)) {
    return { type: "completed" };
  }

  if (input.result.queued) {
    if (!input.unifiedId) return { type: "queued_without_unified_id" };
    return { type: "poll" };
  }

  return { type: "error", message: input.result.message };
}
