/**
 * Batch Profile Acquisition — one Apify actor run per chunk, then offline import + DNA.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { writeEnrichmentRun } from "@/lib/creator-enrichment/audit";
import { fetchBatchProfileRowsWithRetry } from "@/lib/creator-enrichment/batch-profile-apify-fetch";
import {
  estimateBatchProfileAcquisitionUsage,
  getBatchProfileAcquisitionConfig,
} from "@/lib/creator-enrichment/batch-profile-acquisition-policy";
import type {
  BatchProfileAcquisitionJobData,
  BatchProfileAcquisitionProgress,
  BatchProfileAcquisitionResult,
  BatchProfileTarget,
} from "@/lib/creator-enrichment/batch-profile-acquisition-types";
import {
  chunkBatchTargets,
  groupBatchTargetsByPlatform,
} from "@/lib/creator-enrichment/batch-profile-target-resolver";
import { priorityForTrigger } from "@/lib/creator-enrichment/policy";
import { groupApifyRowsIntoCreators } from "@/lib/discovery/apify-dataset-grouping";
import { importApifyStoredPayloadWithDnaPipeline } from "@/lib/discovery/apify-import-pipeline";
import type { SocialPlatform } from "@/lib/social/platforms";

type AnySupabase = SupabaseClient;

function emptyProgress(
  creatorsTotal: number,
  estimatedApifyRuns: number,
  estimatedCredits: number,
  batchesTotal: number
): BatchProfileAcquisitionProgress {
  return {
    acquisition_mode: "batch_profile",
    status: "running",
    creators_total: creatorsTotal,
    creators_imported: 0,
    creators_merged: 0,
    creators_failed: 0,
    creators_skipped: 0,
    batches_total: batchesTotal,
    batches_completed: 0,
    current_batch: null,
    apify_runs: [],
    estimated_apify_runs: estimatedApifyRuns,
    estimated_credits: estimatedCredits,
    actual_credits_estimate: 0,
    platforms: {},
    errors: [],
  };
}

async function updateDiscoveryJob(
  supabase: AnySupabase,
  jobId: string,
  patch: Record<string, unknown>
): Promise<void> {
  await supabase.from("discovery_jobs").update(patch).eq("id", jobId);
}

async function markCreatorsQueued(
  supabase: AnySupabase,
  influencerIds: string[]
): Promise<void> {
  const unique = [...new Set(influencerIds.filter(Boolean))];
  if (unique.length === 0) return;
  await supabase
    .from("influencers")
    .update({ enrichment_status: "queued" } as never)
    .in("id", unique);
}

async function markCreatorOutcome(
  supabase: AnySupabase,
  target: BatchProfileTarget,
  input: {
    ok: boolean;
    merged: boolean;
    apifyRunId: string | null;
    trigger: BatchProfileAcquisitionJobData["trigger"];
    requestedBy?: string | null;
    message: string;
    jobId: string;
  }
): Promise<void> {
  if (!target.influencerId) return;

  const status = input.ok ? "enriched" : "failed";
  await supabase
    .from("influencers")
    .update({
      enrichment_status: status,
      last_enriched_at: input.ok ? new Date().toISOString() : undefined,
      apify_run_id: input.apifyRunId ?? undefined,
    } as never)
    .eq("id", target.influencerId);

  await writeEnrichmentRun(supabase, {
    influencerId: target.influencerId,
    discoveredProfileId: target.discoveredProfileId,
    platformAccountId: target.platformAccountId,
    trigger: input.trigger,
    priority: priorityForTrigger(input.trigger),
    status: input.ok ? (input.merged ? "completed" : "completed") : "failed",
    source: "batch_profile_acquisition",
    apifyRunId: input.apifyRunId,
    forced: true,
    errorMessage: input.ok ? null : input.message,
    jobId: input.jobId,
    requestedBy: input.requestedBy ?? null,
    completedAt: new Date().toISOString(),
  });
}

function findBundleForTarget(
  bundles: ReturnType<typeof groupApifyRowsIntoCreators>,
  username: string
) {
  const normalized = username.replace(/^@+/, "").trim().toLowerCase();
  return bundles.find((b) => b.username === normalized) ?? null;
}

export async function runBatchProfileAcquisition(
  supabase: AnySupabase,
  input: BatchProfileAcquisitionJobData
): Promise<BatchProfileAcquisitionResult> {
  const config = getBatchProfileAcquisitionConfig();
  const targets = input.targets;

  const platformGroups = groupBatchTargetsByPlatform(targets);
  let batchesTotal = 0;
  for (const [, platformTargets] of platformGroups) {
    batchesTotal += chunkBatchTargets(platformTargets, config.batchSize).length;
  }

  const estimatedApifyRuns = [...platformGroups.entries()].reduce(
    (sum, [platform, platformTargets]) => {
      const usage = estimateBatchProfileAcquisitionUsage({
        profileCount: platformTargets.length,
        platform,
        config,
      });
      return sum + usage.estimatedApifyRuns;
    },
    0
  );

  const estimatedCredits = [...platformGroups.entries()].reduce(
    (sum, [platform, platformTargets]) => {
      const usage = estimateBatchProfileAcquisitionUsage({
        profileCount: platformTargets.length,
        platform,
        config,
      });
      return sum + usage.estimatedCredits;
    },
    0
  );

  const progress = emptyProgress(
    targets.length,
    estimatedApifyRuns,
    estimatedCredits,
    batchesTotal
  );

  await markCreatorsQueued(
    supabase,
    targets.map((t) => t.influencerId).filter((id): id is string => Boolean(id))
  );

  await updateDiscoveryJob(supabase, input.jobId, {
    status: "running",
    started_at: new Date().toISOString(),
    result: progress,
  });

  let creatorsImported = 0;
  let creatorsMerged = 0;
  let creatorsFailed = 0;
  let creatorsSkipped = 0;
  const apifyRunIds: string[] = [];
  let batchIndex = 0;

  for (const [platform, platformTargets] of platformGroups) {
    const chunks = chunkBatchTargets(platformTargets, config.batchSize);
    const platformKey = platform as SocialPlatform;

    progress.platforms[platform] = {
      batches_completed: 0,
      batches_total: chunks.length,
      creators_processed: 0,
    };

    for (const chunk of chunks) {
      batchIndex += 1;
      progress.current_batch = batchIndex;
      progress.batches_completed = batchIndex - 1;
      await updateDiscoveryJob(supabase, input.jobId, {
        result: { ...progress },
      });

      const profileUrls = chunk.map((t) => t.profileUrl);
      const usernames = chunk.map((t) => t.username);

      const fetchResult = await fetchBatchProfileRowsWithRetry({
        platform: platformKey,
        profileUrls,
        usernames,
        timeoutMs: config.timeoutMs,
        maxRetries: config.maxRetries,
        retryBackoffMs: config.retryBackoffMs,
      });

      apifyRunIds.push(...fetchResult.apifyRunIds);
      progress.apify_runs = [...apifyRunIds];
      const creditsThisBatch = estimateBatchProfileAcquisitionUsage({
        profileCount: chunk.length,
        platform,
        config,
      }).estimatedCredits;
      progress.actual_credits_estimate = Number(
        (progress.actual_credits_estimate + creditsThisBatch).toFixed(4)
      );

      if (!fetchResult.ok) {
        progress.errors.push(
          `Batch ${batchIndex} (${platform}): ${fetchResult.reason}`
        );
        creatorsFailed += chunk.length;
        for (const target of chunk) {
          await markCreatorOutcome(supabase, target, {
            ok: false,
            merged: false,
            apifyRunId: fetchResult.apifyRunIds[0] ?? null,
            trigger: input.trigger,
            requestedBy: input.requestedBy,
            message: fetchResult.reason,
            jobId: input.jobId,
          });
        }
        progress.platforms[platform].creators_processed += chunk.length;
        progress.batches_completed = batchIndex;
        progress.creators_failed = creatorsFailed;
        await updateDiscoveryJob(supabase, input.jobId, { result: { ...progress } });
        continue;
      }

      const allRows = [...fetchResult.profileRows, ...fetchResult.postRows];
      const bundles = groupApifyRowsIntoCreators(allRows, platformKey);
      const primaryRunId = fetchResult.apifyRunIds[0] ?? null;

      for (const target of chunk) {
        const bundle = findBundleForTarget(bundles, target.username);
        if (!bundle) {
          creatorsFailed += 1;
          progress.errors.push(
            `${target.username}: no Apify rows in batch dataset for profile URL.`
          );
          await markCreatorOutcome(supabase, target, {
            ok: false,
            merged: false,
            apifyRunId: primaryRunId,
            trigger: input.trigger,
            requestedBy: input.requestedBy,
            message: "Creator not found in batch Apify dataset.",
            jobId: input.jobId,
          });
          continue;
        }

        if (bundle.profileRows.length === 0 && bundle.postRows.length === 0) {
          creatorsSkipped += 1;
          continue;
        }

        try {
          const result = await importApifyStoredPayloadWithDnaPipeline(supabase, {
            platform,
            username: target.username,
            profileUrl: target.profileUrl,
            profileRows: bundle.profileRows,
            postRows: bundle.postRows,
            apifyRunId: primaryRunId,
            uploadAvatar: input.uploadAvatars ?? false,
          });

          if (!result.ok) {
            creatorsFailed += 1;
            progress.errors.push(`${target.username}: ${result.message}`);
            await markCreatorOutcome(supabase, target, {
              ok: false,
              merged: false,
              apifyRunId: primaryRunId,
              trigger: input.trigger,
              requestedBy: input.requestedBy,
              message: result.message,
              jobId: input.jobId,
            });
            continue;
          }

          if (result.merged) creatorsMerged += 1;
          else creatorsImported += 1;

          await markCreatorOutcome(
            supabase,
            {
              ...target,
              influencerId: result.influencerId ?? target.influencerId,
              platformAccountId: result.platformAccountId ?? target.platformAccountId,
              discoveredProfileId: result.discoveredProfileId ?? target.discoveredProfileId,
            },
            {
              ok: true,
              merged: result.merged,
              apifyRunId: primaryRunId,
              trigger: input.trigger,
              requestedBy: input.requestedBy,
              message: result.message,
              jobId: input.jobId,
            }
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Import failed.";
          creatorsFailed += 1;
          progress.errors.push(`${target.username}: ${message}`);
          await markCreatorOutcome(supabase, target, {
            ok: false,
            merged: false,
            apifyRunId: primaryRunId,
            trigger: input.trigger,
            requestedBy: input.requestedBy,
            message,
            jobId: input.jobId,
          });
        }
      }

      progress.platforms[platform].creators_processed += chunk.length;
      progress.platforms[platform].batches_completed += 1;
      progress.batches_completed = batchIndex;
      progress.creators_imported = creatorsImported;
      progress.creators_merged = creatorsMerged;
      progress.creators_failed = creatorsFailed;
      progress.creators_skipped = creatorsSkipped;
      progress.current_batch = null;
      await updateDiscoveryJob(supabase, input.jobId, { result: { ...progress } });
    }
  }

  const profilesAdded = creatorsImported + creatorsMerged;
  const ok = profilesAdded > 0;
  progress.status = ok ? "completed" : "failed";
  progress.batches_completed = batchesTotal;
  progress.current_batch = null;

  const reason = ok
    ? `Batch profile acquisition enriched ${profilesAdded} creator(s) via ${apifyRunIds.length} Apify run(s).`
    : `Batch profile acquisition completed with 0 successful imports (${creatorsFailed} failed).`;

  await updateDiscoveryJob(supabase, input.jobId, {
    status: ok ? "completed" : "failed",
    completed_at: new Date().toISOString(),
    profiles_discovered: profilesAdded,
    profiles_enriched: profilesAdded,
    error_message: ok ? null : reason,
    result: progress,
  });

  return {
    ok,
    jobId: input.jobId,
    creatorsTotal: targets.length,
    creatorsImported,
    creatorsMerged,
    creatorsFailed,
    creatorsSkipped,
    apifyRunIds,
    estimatedCredits: progress.actual_credits_estimate || estimatedCredits,
    reason,
    progress,
  };
}
