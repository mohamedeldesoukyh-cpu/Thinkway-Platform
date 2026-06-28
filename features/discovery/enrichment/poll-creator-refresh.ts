import type { UnifiedCreatorResult } from "@/lib/creators/types";
import type { CreatorMetricsSyncStatus } from "@/lib/services/creators/creator-enrichment-service";

import {
  getCreatorEnrichmentStatusAction,
  getUnifiedCreatorAfterRefreshAction,
} from "./actions";

const POLL_INTERVAL_MS = 2_500;
const MAX_POLL_ATTEMPTS = 48;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTerminalSyncStatus(status: CreatorMetricsSyncStatus): boolean {
  return status === "completed" || status === "failed";
}

/** Poll enrichment until complete, then refetch the unified creator row. */
export async function pollCreatorAfterRefresh(
  input: {
    unifiedId: string;
    influencerId: string;
  },
  onUpdated: (creator: UnifiedCreatorResult) => void
): Promise<void> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt += 1) {
    await sleep(POLL_INTERVAL_MS);
    const status = await getCreatorEnrichmentStatusAction(input.influencerId);
    if (!isTerminalSyncStatus(status)) continue;

    const creator = await getUnifiedCreatorAfterRefreshAction(input.unifiedId);
    if (creator) onUpdated(creator);
    return;
  }
}

/** Poll a batch of creators and patch each as enrichment completes. */
export async function pollCreatorsAfterBatchRefresh(
  targets: Array<{ unifiedId: string; influencerId: string | null }>,
  onUpdated: (creator: UnifiedCreatorResult) => void
): Promise<void> {
  const pending = targets.filter(
    (target): target is { unifiedId: string; influencerId: string } =>
      Boolean(target.influencerId)
  );
  if (pending.length === 0) return;

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS && pending.length > 0; attempt += 1) {
    await sleep(POLL_INTERVAL_MS);

    for (let i = pending.length - 1; i >= 0; i -= 1) {
      const target = pending[i];
      if (!target) continue;
      const status = await getCreatorEnrichmentStatusAction(target.influencerId);
      if (!isTerminalSyncStatus(status)) continue;

      const creator = await getUnifiedCreatorAfterRefreshAction(target.unifiedId);
      if (creator) onUpdated(creator);
      pending.splice(i, 1);
    }
  }
}
