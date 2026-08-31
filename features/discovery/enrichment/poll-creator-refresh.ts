import { logManualRefreshTrace } from "@/lib/creator-enrichment/manual-refresh-trace";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import type { CreatorMetricsSyncStatus } from "@/lib/services/creators/creator-enrichment-service";
import type { CreatorRefreshPollStatus } from "@/lib/services/creators/creator-enrichment-service-shared";

import {
  getCreatorEnrichmentStatusAction,
  getCreatorRefreshPollStatusAction,
  getUnifiedCreatorAfterRefreshAction,
} from "./actions";
import {
  MAX_POLL_ATTEMPTS,
  POLL_INTERVAL_MS,
  isActiveSyncStatus,
  isTerminalSyncStatus,
  pollGiveUpStatus,
  shouldAbortOpaquePending,
} from "./poll-creator-refresh-policy";

export {
  MAX_PENDING_STREAK_BEFORE_ACTIVE,
  MAX_POLL_ATTEMPTS,
  MAX_POLL_MS,
  POLL_INTERVAL_MS,
  isActiveSyncStatus,
  isTerminalSyncStatus,
  pollGiveUpStatus,
  shouldAbortOpaquePending,
} from "./poll-creator-refresh-policy";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function failPoll(
  callbacks: CreatorRefreshPollCallbacks,
  lastPoll: CreatorRefreshPollStatus | null,
  reason: string,
  influencerId: string
): "timeout" {
  logManualRefreshTrace("ui_poll_complete", {
    influencerId,
    syncStatus: "failed",
    reason,
  });
  callbacks.onComplete?.("failed", null, lastPoll);
  return "timeout";
}

function giveUpPoll(
  callbacks: CreatorRefreshPollCallbacks,
  lastPoll: CreatorRefreshPollStatus | null,
  lastStatus: CreatorMetricsSyncStatus | null,
  reason: string,
  influencerId: string,
  seenActive: boolean
): CreatorMetricsSyncStatus | "timeout" {
  const status = pollGiveUpStatus(lastStatus, seenActive);
  if (status === "failed") {
    return failPoll(callbacks, lastPoll, reason, influencerId);
  }
  logManualRefreshTrace("ui_poll_complete", {
    influencerId,
    syncStatus: status,
    reason,
    stillRunning: true,
  });
  callbacks.onComplete?.(status, null, lastPoll);
  return status;
}

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
  let seenActive = false;
  let lastPoll: CreatorRefreshPollStatus | null = null;

  try {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
      await sleep(POLL_INTERVAL_MS);
      let poll: CreatorRefreshPollStatus;
      try {
        poll = await getCreatorRefreshPollStatusAction(input.influencerId);
      } catch {
        pendingStreak += 1;
        if (shouldAbortOpaquePending({ seenActive, pendingStreak })) {
          return failPoll(callbacks, lastPoll, "poll_error_streak", input.influencerId);
        }
        continue;
      }
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
      if (isActiveSyncStatus(status)) {
        seenActive = true;
        pendingStreak = 0;
      } else if (status === "pending") {
        pendingStreak += 1;
        if (shouldAbortOpaquePending({ seenActive, pendingStreak })) {
          return failPoll(callbacks, lastPoll, "pending_streak", input.influencerId);
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

    return giveUpPoll(callbacks, lastPoll, lastStatus, "max_attempts", input.influencerId, seenActive);
  } catch {
    return giveUpPoll(callbacks, lastPoll, lastStatus, "poll_exception", input.influencerId, seenActive);
  }
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
      let status: CreatorMetricsSyncStatus;
      try {
        status = await getCreatorEnrichmentStatusAction(target.influencerId);
      } catch {
        continue;
      }
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

  for (const leftover of pending) {
    callbacks.onComplete?.({
      unifiedId: leftover.unifiedId,
      influencerId: leftover.influencerId,
      status: pollGiveUpStatus(lastStatuses.get(leftover.influencerId) ?? null),
    });
  }
}
