import { logManualRefreshTrace } from "@/lib/creator-enrichment/manual-refresh-trace";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import type { CreatorMetricsSyncStatus } from "@/lib/services/creators/creator-enrichment-service";
import type { CreatorRefreshPollStatus } from "@/lib/services/creators/creator-enrichment-service-shared";

import {
  getCreatorEnrichmentStatusAction,
  getCreatorRefreshPollStatusAction,
  getUnifiedCreatorAfterRefreshAction,
} from "./actions";

const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_ATTEMPTS = 20;
/** Stop early when Auth/DB only returns opaque "pending" (worker offline / stuck). */
const MAX_PENDING_STREAK = 4;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTerminalSyncStatus(status: CreatorMetricsSyncStatus): boolean {
  return status === "completed" || status === "failed";
}

/** Statuses that mean "still working" — everything else should end the poll. */
function isActiveSyncStatus(status: CreatorMetricsSyncStatus): boolean {
  return status === "queued" || status === "collecting";
}

export type CreatorRefreshPollCallbacks = {
  onUpdated: (creator: UnifiedCreatorResult) => void;
  onStatusChange?: (status: CreatorMetricsSyncStatus) => void;
  onComplete?: (
    status: CreatorMetricsSyncStatus,
    creator?: UnifiedCreatorResult | null,
    poll?: CreatorRefreshPollStatus | null
  ) => void;
};

export type CreatorBatchRefreshPollCallbacks = {
  onUpdated: (creator: UnifiedCreatorResult) => void;
  onStatusChange?: (input: {
    unifiedId: string;
    influencerId: string;
    status: CreatorMetricsSyncStatus;
  }) => void;
  onComplete?: (input: {
    unifiedId: string;
    influencerId: string;
    status: CreatorMetricsSyncStatus;
  }) => void;
};

/** Poll enrichment until complete, then refetch the unified creator row. */
export async function pollCreatorAfterRefresh(
  input: {
    unifiedId: string;
    influencerId: string;
  },
  callbacks: CreatorRefreshPollCallbacks
): Promise<CreatorMetricsSyncStatus | "timeout"> {
  let lastStatus: CreatorMetricsSyncStatus | null = null;
  let pendingStreak = 0;
  let lastPoll: CreatorRefreshPollStatus | null = null;

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    await sleep(POLL_INTERVAL_MS);
    const poll = await getCreatorRefreshPollStatusAction(input.influencerId);
    lastPoll = poll;
    const status = poll.syncStatus;
    logManualRefreshTrace("ui_poll_status", {
      influencerId: input.influencerId,
      unifiedId: input.unifiedId,
      attempt: attempt + 1,
      syncStatus: status,
      failureStage: poll.failureStage,
      refreshId: poll.refreshId,
    });
    if (status === "pending") {
      pendingStreak += 1;
      if (pendingStreak >= MAX_PENDING_STREAK) {
        logManualRefreshTrace("ui_poll_complete", {
          influencerId: input.influencerId,
          syncStatus: "failed",
          reason: "pending_streak",
        });
        callbacks.onComplete?.("failed", null, lastPoll);
        return "timeout";
      }
    } else {
      pendingStreak = 0;
    }
    if (status !== lastStatus) {
      lastStatus = status;
      callbacks.onStatusChange?.(status);
    }
    if (isTerminalSyncStatus(status)) {
      logManualRefreshTrace("ui_poll_complete", {
        influencerId: input.influencerId,
        syncStatus: status,
        attempt: attempt + 1,
        failureStage: poll.failureStage,
        refreshId: poll.refreshId,
      });
      let creator: UnifiedCreatorResult | null = null;
      if (status === "completed" || status === "failed") {
        creator = await getUnifiedCreatorAfterRefreshAction(input.unifiedId);
        if (creator) callbacks.onUpdated(creator);
      }
      callbacks.onComplete?.(status, creator, lastPoll);
      return status;
    }
    // "pending" or unknown non-active statuses should not spin forever.
    if (!isActiveSyncStatus(status) && status !== "pending") {
      logManualRefreshTrace("ui_poll_complete", {
        influencerId: input.influencerId,
        syncStatus: status,
        reason: "non_active",
      });
      callbacks.onComplete?.(status === "failed" ? "failed" : "completed", null, lastPoll);
      return status;
    }
  }

  logManualRefreshTrace("ui_poll_complete", {
    influencerId: input.influencerId,
    syncStatus: "failed",
    reason: "max_attempts",
  });
  callbacks.onComplete?.("failed", null, lastPoll);
  return "timeout";
}

/** Poll a batch of creators and patch each as enrichment completes. */
export async function pollCreatorsAfterBatchRefresh(
  targets: Array<{ unifiedId: string; influencerId: string | null }>,
  callbacks: CreatorBatchRefreshPollCallbacks
): Promise<void> {
  const pending = targets.filter(
    (target): target is { unifiedId: string; influencerId: string } =>
      Boolean(target.influencerId)
  );
  if (pending.length === 0) return;

  const lastStatuses = new Map<string, CreatorMetricsSyncStatus>();

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS && pending.length > 0; attempt += 1) {
    await sleep(POLL_INTERVAL_MS);

    for (let i = pending.length - 1; i >= 0; i -= 1) {
      const target = pending[i];
      if (!target) continue;
      const status = await getCreatorEnrichmentStatusAction(target.influencerId);
      const prev = lastStatuses.get(target.influencerId);
      if (status !== prev) {
        lastStatuses.set(target.influencerId, status);
        callbacks.onStatusChange?.({
          unifiedId: target.unifiedId,
          influencerId: target.influencerId,
          status,
        });
      }
      if (!isTerminalSyncStatus(status)) continue;

      callbacks.onComplete?.({
        unifiedId: target.unifiedId,
        influencerId: target.influencerId,
        status,
      });
      if (status === "completed") {
        const creator = await getUnifiedCreatorAfterRefreshAction(target.unifiedId);
        if (creator) callbacks.onUpdated(creator);
      }
      pending.splice(i, 1);
    }
  }
}
