/**
 * Phase 2.2 — sole infrastructure gateway for Creator Intelligence Snapshot data.
 *
 * All database, queue, and service reads for decision rules flow through this module.
 * Rules must not import this file — only the snapshot provider may call these helpers.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { calculateDnaCompleteness } from "@/features/creator-dna/services/dna-completeness-engine";
import { CreatorDNAService } from "@/features/creator-dna/services/creator-dna-service";
import { envelopeHasValue } from "@/features/creator-dna/services/field-envelope";
import type { CreatorDnaLifecycle, CreatorDNADocument } from "@/features/creator-dna/types";
import { creatorHasInflightEnrichmentJob } from "@/lib/creator-enrichment/queue-operations";
import { getGovernancePolicy } from "@/lib/creator-enrichment/governance/policy/policy-engine";
import {
  getCreatorMetricsSyncStatus,
  type CreatorMetricsSyncStatus,
} from "@/lib/services/creators/creator-enrichment-service-shared";
import type { Database } from "@/types/database";

import type {
  CreatorIntelligenceSnapshotData,
  SnapshotDnaStatus,
  SnapshotFreshness,
  SnapshotQueueStatus,
} from "./snapshot-types";
import {
  buildSnapshotVersionMetadata,
  SNAPSHOT_VERSION,
} from "./snapshot-version";

type AnySupabase = SupabaseClient<Database>;

type InfluencerRow = {
  last_enriched_at: string | null;
  country_code: string | null;
};

type EnrichmentRunRow = {
  started_at: string | null;
  completed_at: string | null;
  status: string;
  trigger: string;
};

type IplSnapshotRow = {
  id: string;
  fetched_at: string;
};

export type SnapshotGatherInput = {
  influencerId: string;
  platformAccountId?: string | null;
  supabase: AnySupabase | null;
};

export async function resolveSnapshotSupabase(
  supabase: AnySupabase | null
): Promise<AnySupabase | null> {
  if (supabase) return supabase;
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    return createSupabaseAdminClient();
  } catch {
    return null;
  }
}

function mapSyncStatusToQueueStatus(
  syncStatus: CreatorMetricsSyncStatus
): SnapshotQueueStatus {
  switch (syncStatus) {
    case "collecting":
      return "running";
    case "queued":
      return "queued";
    case "pending":
    case "completed":
    case "failed":
      return "idle";
    default:
      return "unknown";
  }
}

function mapLifecycleToDnaStatus(
  lifecycle: CreatorDnaLifecycle | null | undefined
): SnapshotDnaStatus {
  if (!lifecycle) return "unknown";
  switch (lifecycle) {
    case "IMPORTED":
    case "BASELINE":
      return "partial";
    case "ENRICHED":
    case "ACTIVE":
    case "STRATEGIC":
    case "ARCHIVED":
      return "complete";
    default:
      return "unknown";
  }
}

function metricsFreshnessFromLastEnriched(
  lastEnrichedAt: string | null
): SnapshotFreshness {
  if (!lastEnrichedAt) return "stale";
  const windowMs = getGovernancePolicy().freshnessWindowDays * 24 * 60 * 60 * 1000;
  const ts = Date.parse(lastEnrichedAt);
  if (Number.isNaN(ts)) return "stale";
  return Date.now() - ts >= windowMs ? "stale" : "fresh";
}

function countryKnownFromStoredValues(
  influencer: InfluencerRow | null,
  document: CreatorDNADocument | null
): boolean | null {
  if (influencer?.country_code?.trim()) return true;
  if (document && envelopeHasValue(document.audience.country)) return true;
  if (!influencer && !document) return null;
  return false;
}

function audienceKnownFromStoredValues(document: CreatorDNADocument | null): boolean | null {
  if (!document) return null;
  const audience = document.audience;
  const known =
    envelopeHasValue(audience.interests) ||
    envelopeHasValue(audience.countries) ||
    envelopeHasValue(audience.audienceGender) ||
    envelopeHasValue(audience.audienceAgeBands) ||
    envelopeHasValue(audience.audienceCities);
  return known;
}

async function fetchInfluencerRow(
  supabase: AnySupabase,
  influencerId: string
): Promise<InfluencerRow | null> {
  const { data, error } = await supabase
    .from("influencers")
    .select("last_enriched_at, country_code")
    .eq("id", influencerId)
    .maybeSingle();

  if (error || !data) return null;
  return data as InfluencerRow;
}

async function fetchEnrichmentRunHistory(
  supabase: AnySupabase,
  influencerId: string
): Promise<EnrichmentRunRow[]> {
  const { data, error } = await supabase
    .from("creator_enrichment_runs")
    .select("started_at, completed_at, status, trigger")
    .eq("influencer_id", influencerId)
    .order("started_at", { ascending: false })
    .limit(50);

  if (error || !data) return [];
  return data as EnrichmentRunRow[];
}

async function fetchLatestIplSnapshot(
  supabase: AnySupabase,
  influencerId: string,
  platformAccountId?: string | null
): Promise<IplSnapshotRow | null> {
  let query = supabase
    .from("ipl_snapshots")
    .select("id, fetched_at")
    .eq("influencer_id", influencerId)
    .order("fetched_at", { ascending: false })
    .limit(1);

  if (platformAccountId) {
    query = query.eq("platform_account_id", platformAccountId);
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return data as IplSnapshotRow;
}

function resolveLastSuccessfulEnrichment(
  lastEnrichedAt: string | null,
  runs: EnrichmentRunRow[]
): string | null {
  if (lastEnrichedAt) return lastEnrichedAt;

  const successful = runs.find(
    (run) => run.status === "completed" || run.status === "partial"
  );
  return successful?.completed_at ?? successful?.started_at ?? null;
}

function resolveLastEnrichment(runs: EnrichmentRunRow[]): string | null {
  return runs[0]?.started_at ?? null;
}

function resolveLastManualRefresh(runs: EnrichmentRunRow[]): string | null {
  const manual = runs.find((run) => run.trigger === "manual");
  return manual?.started_at ?? null;
}

/** Gathers real platform intelligence for a single creator. */
export async function gatherCreatorIntelligenceSnapshot(
  input: SnapshotGatherInput
): Promise<CreatorIntelligenceSnapshotData> {
  const startedAt = Date.now();
  const dataSourcesUsed: string[] = [];
  const influencerId = input.influencerId.trim();
  const platformAccountId = input.platformAccountId ?? null;

  const supabase = await resolveSnapshotSupabase(input.supabase);
  if (!supabase) {
    return buildUnavailableSnapshot(influencerId, platformAccountId, startedAt, [
      "unavailable",
    ]);
  }

  const dnaService = new CreatorDNAService(supabase);

  const [influencer, syncStatus, hasInflight, dnaRecord, iplSnapshot, runs] =
    await Promise.all([
      fetchInfluencerRow(supabase, influencerId),
      getCreatorMetricsSyncStatus(supabase, influencerId),
      creatorHasInflightEnrichmentJob(influencerId),
      dnaService.getCreatorDNA(influencerId),
      fetchLatestIplSnapshot(supabase, influencerId, platformAccountId),
      fetchEnrichmentRunHistory(supabase, influencerId),
    ]);

  dataSourcesUsed.push("influencers");
  dataSourcesUsed.push("creator_enrichment_runs");
  dataSourcesUsed.push("bullmq");
  if (dnaRecord) dataSourcesUsed.push("creator_dna");
  if (iplSnapshot) dataSourcesUsed.push("ipl_snapshot");

  const lastEnrichedAt = influencer?.last_enriched_at ?? null;
  const document = dnaRecord?.document ?? null;
  const dnaCompleteness = document
    ? calculateDnaCompleteness(document).dnaCompleteness
    : null;
  const dnaStatus = document
    ? mapLifecycleToDnaStatus(document.meta.lifecycle)
    : dnaRecord
      ? "unknown"
      : "missing";

  const queueStatus = mapSyncStatusToQueueStatus(syncStatus);

  const enrichmentRunning =
    syncStatus === "queued" || syncStatus === "collecting" || hasInflight;

  const snapshotBuildMs = Date.now() - startedAt;

  return {
    creatorId: influencerId,
    influencerId,
    platformAccountId,
    enrichmentRunning,
    queueStatus,
    lastEnrichment: resolveLastEnrichment(runs),
    lastSuccessfulEnrichment: resolveLastSuccessfulEnrichment(lastEnrichedAt, runs),
    lastManualRefresh: resolveLastManualRefresh(runs),
    lastIPLFetch: iplSnapshot?.fetched_at ?? null,
    dnaStatus,
    dnaCompleteness,
    metricsFreshness: metricsFreshnessFromLastEnriched(lastEnrichedAt),
    avatarFreshness: null,
    countryKnown: countryKnownFromStoredValues(influencer, document),
    audienceKnown: audienceKnownFromStoredValues(document),
    hasCreatorDNA: Boolean(dnaRecord),
    hasIPLSnapshot: Boolean(iplSnapshot),
    metadata: buildSnapshotVersionMetadata({
      snapshotBuiltAt: new Date().toISOString(),
      snapshotBuildMs,
      dataSourcesUsed,
      lastMetricsUpdate: lastEnrichedAt,
      iplSnapshotId: iplSnapshot?.id ?? null,
      syncStatus,
      hasInflightJob: hasInflight,
    }),
  };
}

function buildUnavailableSnapshot(
  influencerId: string,
  platformAccountId: string | null,
  startedAt: number,
  dataSourcesUsed: string[]
): CreatorIntelligenceSnapshotData {
  return {
    creatorId: influencerId,
    influencerId,
    platformAccountId,
    enrichmentRunning: null,
    queueStatus: "unknown",
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
    metadata: buildSnapshotVersionMetadata({
      snapshotBuiltAt: new Date().toISOString(),
      snapshotBuildMs: Date.now() - startedAt,
      dataSourcesUsed,
      unavailable: true,
    }),
  };
}

/** Batch operations have no single creator — return scoped empty intelligence. */
export function buildBatchScopeSnapshot(
  startedAt: number
): CreatorIntelligenceSnapshotData {
  return {
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
    metadata: buildSnapshotVersionMetadata({
      snapshotBuiltAt: new Date().toISOString(),
      snapshotBuildMs: Date.now() - startedAt,
      dataSourcesUsed: [],
      batchScope: true,
    }),
  };
}
