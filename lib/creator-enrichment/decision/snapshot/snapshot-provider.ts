import type { CreatorEnrichmentDecisionContext } from "@/lib/creator-enrichment/decision/decision-context";

import { createEmptyCreatorIntelligenceSnapshot } from "./creator-intelligence-snapshot";
import {
  buildBatchScopeSnapshot,
  gatherCreatorIntelligenceSnapshot,
} from "./snapshot-sources";
import type { CreatorIntelligenceSnapshot, CreatorIntelligenceSnapshotData } from "./snapshot-types";

/**
 * Sole gateway for gathering creator intelligence used by decision rules.
 *
 * Phase 2.2: reads existing platform data via {@link gatherCreatorIntelligenceSnapshot}.
 * Later phases must implement all I/O here — not in individual rules.
 */
export type CreatorIntelligenceSnapshotProvider = {
  provide(
    context: CreatorEnrichmentDecisionContext
  ): Promise<CreatorIntelligenceSnapshotData>;
};

/** Phase 2.1 test double — returns empty placeholder data with no I/O. */
export class PlaceholderCreatorIntelligenceSnapshotProvider
  implements CreatorIntelligenceSnapshotProvider
{
  async provide(
    _context: CreatorEnrichmentDecisionContext
  ): Promise<CreatorIntelligenceSnapshotData> {
    return createEmptyCreatorIntelligenceSnapshot();
  }
}

/** Phase 2.2 — reads real platform intelligence from existing services. */
export class PlatformCreatorIntelligenceSnapshotProvider
  implements CreatorIntelligenceSnapshotProvider
{
  async provide(
    context: CreatorEnrichmentDecisionContext
  ): Promise<CreatorIntelligenceSnapshotData> {
    if (!context.creatorId?.trim()) {
      const startedAt = Date.now();
      return buildBatchScopeSnapshot(startedAt);
    }

    return gatherCreatorIntelligenceSnapshot({
      influencerId: context.creatorId,
      platformAccountId: context.platformAccountId,
      supabase: context.supabase,
    });
  }
}

let defaultProvider: CreatorIntelligenceSnapshotProvider | null = null;

export function getDefaultSnapshotProvider(): CreatorIntelligenceSnapshotProvider {
  if (!defaultProvider) {
    defaultProvider = new PlatformCreatorIntelligenceSnapshotProvider();
  }
  return defaultProvider;
}

/** Test helper — reset provider singleton between tests. */
export function resetDefaultSnapshotProviderForTests(): void {
  defaultProvider = null;
}

/** Test helper — install a custom provider singleton. */
export function setDefaultSnapshotProviderForTests(
  provider: CreatorIntelligenceSnapshotProvider
): void {
  defaultProvider = provider;
}

export function freezeSnapshot(
  data: CreatorIntelligenceSnapshotData
): CreatorIntelligenceSnapshot {
  return Object.freeze({
    ...data,
    metadata: Object.freeze({ ...data.metadata }),
  });
}
