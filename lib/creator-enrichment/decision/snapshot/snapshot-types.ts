/** Queue depth / inflight signal for a creator. */
export type SnapshotQueueStatus = "idle" | "queued" | "running" | "unknown" | null;

/** Freshness classification for metrics or avatar data. */
export type SnapshotFreshness = "fresh" | "stale" | "unknown" | null;

/** Creator DNA readiness signal. */
export type SnapshotDnaStatus = "complete" | "partial" | "missing" | "unknown" | null;

export type CreatorIntelligenceSnapshotFields = {
  creatorId: string | null;
  influencerId: string | null;
  platformAccountId: string | null;
  enrichmentRunning: boolean | null;
  queueStatus: SnapshotQueueStatus;
  lastEnrichment: string | null;
  lastSuccessfulEnrichment: string | null;
  lastManualRefresh: string | null;
  lastIPLFetch: string | null;
  dnaStatus: SnapshotDnaStatus;
  dnaCompleteness: number | null;
  metricsFreshness: SnapshotFreshness;
  avatarFreshness: SnapshotFreshness;
  countryKnown: boolean | null;
  audienceKnown: boolean | null;
  hasCreatorDNA: boolean | null;
  hasIPLSnapshot: boolean | null;
  metadata: Readonly<Record<string, unknown>>;
};

/** Immutable intelligence snapshot — sole data surface for decision rules. */
export type CreatorIntelligenceSnapshot = Readonly<CreatorIntelligenceSnapshotFields>;

export type CreatorIntelligenceSnapshotData = CreatorIntelligenceSnapshotFields;
