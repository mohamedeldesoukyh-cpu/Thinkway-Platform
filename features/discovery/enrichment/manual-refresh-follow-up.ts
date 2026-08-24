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
};

function isAlreadyInProgress(result: RefreshActionSnapshot) {
  return result.ok && !result.queued && /already in progress/i.test(result.message);
}

/** Decide what the Refresh Metrics UI should do after the server action returns. */
export function resolveManualRefreshFollowUp(input: {
  result: RefreshActionSnapshot;
  unifiedId?: string | null;
}): ManualRefreshFollowUp {
  if (input.result.refreshSource === "cached_snapshot" && input.result.ok && !input.result.queued) {
    return { type: "cached" };
  }

  if (input.result.ok && !input.result.queued && !isAlreadyInProgress(input.result)) {
    return { type: "completed" };
  }

  if (input.result.queued || isAlreadyInProgress(input.result)) {
    if (!input.unifiedId) return { type: "queued_without_unified_id" };
    return { type: "poll" };
  }

  return { type: "error", message: input.result.message };
}
