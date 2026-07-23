import type { CreatorIntelligenceSnapshotData } from "./snapshot-types";

const TRACKED_FIELDS = [
  "creatorId",
  "influencerId",
  "platformAccountId",
  "enrichmentRunning",
  "queueStatus",
  "lastEnrichment",
  "lastSuccessfulEnrichment",
  "lastManualRefresh",
  "lastIPLFetch",
  "dnaStatus",
  "dnaCompleteness",
  "metricsFreshness",
  "avatarFreshness",
  "countryKnown",
  "audienceKnown",
  "hasCreatorDNA",
  "hasIPLSnapshot",
] as const satisfies ReadonlyArray<keyof CreatorIntelligenceSnapshotData>;

export type SnapshotCompletenessReport = {
  snapshotCompleteness: number;
  populatedFields: string[];
  trackedFieldCount: number;
};

export function computeSnapshotCompleteness(
  snapshot: CreatorIntelligenceSnapshotData
): SnapshotCompletenessReport {
  const populatedFields: string[] = [];

  for (const field of TRACKED_FIELDS) {
    const value = snapshot[field];
    if (value !== null && value !== undefined) {
      populatedFields.push(field);
    }
  }

  const trackedFieldCount = TRACKED_FIELDS.length;
  const snapshotCompleteness = Math.round(
    (populatedFields.length / trackedFieldCount) * 100
  );

  return {
    snapshotCompleteness,
    populatedFields,
    trackedFieldCount,
  };
}
