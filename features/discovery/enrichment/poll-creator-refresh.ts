import type { UnifiedCreatorResult } from "@/lib/creators/types";
import type { CreatorMetricsSyncStatus } from "@/lib/services/creators/creator-enrichment-service";

import {
  getCreatorEnrichmentStatusAction,
  getUnifiedCreatorAfterRefreshAction,
} from "./actions";

const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_ATTEMPTS = 40;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTerminalSyncStatus(status: CreatorMetricsSyncStatus): boolean {
  return status === "completed" || status === "failed";
}

export type CreatorRefreshPollCallbacks = {
  onUpdated: (creator: UnifiedCreatorResult) => void;
  onStatusChange?: (status: CreatorMetricsSyncStatus) => void;
  onComplete?: (status: CreatorMetricsSyncStatus) => void;
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

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    await sleep(POLL_INTERVAL_MS);
    const status = await getCreatorEnrichmentStatusAction(input.influencerId);
    if (status !== lastStatus) {
      lastStatus = status;
      callbacks.onStatusChange?.(status);
    }
    if (!isTerminalSyncStatus(status)) continue;

    callbacks.onComplete?.(status);
    if (status === "completed") {
      const creator = await getUnifiedCreatorAfterRefreshAction(input.unifiedId);
      if (creator) callbacks.onUpdated(creator);
    }
    return status;
  }

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
