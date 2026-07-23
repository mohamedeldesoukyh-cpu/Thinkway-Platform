import type { CreatorIntelligenceSnapshot } from "./snapshot-types";

/**
 * Canonical Creator Intelligence Snapshot model.
 *
 * Phase 2.2: populated via {@link CreatorIntelligenceSnapshotProvider} only —
 * rules must not perform I/O.
 */
export type { CreatorIntelligenceSnapshot } from "./snapshot-types";

export function createEmptyCreatorIntelligenceSnapshot(): CreatorIntelligenceSnapshot {
  return Object.freeze({
    creatorId: null,
    influencerId: null,
    platformAccountId: null,
    enrichmentRunning: null,
    queueStatus: null,
    lastEnrichment: null,
    lastSuccessfulEnrichment: null,
    lastManualRefresh: null,
    lastIPLFetch: null,
    dnaStatus: null,
    dnaCompleteness: null,
    metricsFreshness: null,
    avatarFreshness: null,
    countryKnown: null,
    audienceKnown: null,
    hasCreatorDNA: null,
    hasIPLSnapshot: null,
    metadata: Object.freeze({ phase: "2.1", populated: false, snapshotVersion: "2.4" }),
  });
}

export function isCreatorIntelligenceSnapshot(
  value: unknown
): value is CreatorIntelligenceSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as CreatorIntelligenceSnapshot;
  return (
    "creatorId" in snapshot &&
    "hasCreatorDNA" in snapshot &&
    "hasIPLSnapshot" in snapshot &&
    Object.isFrozen(snapshot)
  );
}
