import { Worker, type Job } from "bullmq";

import {
  checkAcquisitionJobCancelled,
  finalizeCancelledDiscoveryJob,
} from "@/lib/discovery/acquisition-session.js";
import { runDatasetAcquisitionBackfill } from "@/lib/discovery/dataset-acquisition-orchestrator.js";
import type { EnterpriseAcquisitionJobData } from "@/lib/discovery/enterprise-acquisition-types.js";
import { assertApifyAcquisitionBudget } from "@/lib/discovery/control-center/apify-budget.js";
import {
  AUTOMATIC_ENRICHMENT_ACQUISITION_DISABLED_REASON,
  isAutomaticEnrichmentAndAcquisitionDisabled,
  logBlockedAutomaticAction,
} from "@/lib/discovery/operational-safety.js";

import { supabase } from "../db/supabase.js";
import { getRedisConnection } from "../queues/connection.js";
import { QUEUES } from "../queues/names.js";

async function markJobRunning(jobId: string): Promise<void> {
  await supabase
    .from("discovery_jobs")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

export function startEnterpriseAcquisitionWorker(): Worker<EnterpriseAcquisitionJobData> {
  return new Worker<EnterpriseAcquisitionJobData>(
    QUEUES.enterpriseAcquisition,
    async (job: Job<EnterpriseAcquisitionJobData>) => {
      const data = job.data;

      if (isAutomaticEnrichmentAndAcquisitionDisabled()) {
        logBlockedAutomaticAction(
          "enterprise_acquisition_worker",
          AUTOMATIC_ENRICHMENT_ACQUISITION_DISABLED_REASON,
          { jobId: data.jobId, searchId: data.searchId }
        );
        await finalizeCancelledDiscoveryJob(
          supabase,
          data.jobId,
          AUTOMATIC_ENRICHMENT_ACQUISITION_DISABLED_REASON
        );
        return {
          ok: false,
          cancelled: true,
          reason: AUTOMATIC_ENRICHMENT_ACQUISITION_DISABLED_REASON,
        };
      }

      const budget = await assertApifyAcquisitionBudget(supabase, {
        source: "enterprise_acquisition_worker",
        meta: { jobId: data.jobId, searchId: data.searchId, platform: data.platform },
      });
      if (!budget.allowed) {
        await finalizeCancelledDiscoveryJob(supabase, data.jobId, budget.reason);
        return {
          ok: false,
          cancelled: true,
          reason: budget.reason,
        };
      }

      const preCheck = await checkAcquisitionJobCancelled(
        supabase,
        data.jobId,
        data.searchSessionId
      );
      if (preCheck.cancelled) {
        await finalizeCancelledDiscoveryJob(
          supabase,
          data.jobId,
          preCheck.reason ?? "Cancelled before worker started."
        );
        return {
          ok: false,
          cancelled: true,
          reason: preCheck.reason ?? "cancelled",
        };
      }

      await markJobRunning(data.jobId);

      const acquisition = await runDatasetAcquisitionBackfill(supabase, {
        searchId: data.searchId,
        searchSessionId: data.searchSessionId,
        platform: data.platform,
        jobPayload: data.jobPayload,
        countryCode: data.countryCode,
        categoryTags: data.categoryTags,
        intelligence: data.intelligence as never,
        discoveryJobId: data.jobId,
      });

      return {
        ok: acquisition.ok,
        cancelled: acquisition.cancelled === true,
        profiles_added: acquisition.creatorsImported + acquisition.creatorsMerged,
        creators_imported: acquisition.creatorsImported,
        creators_merged: acquisition.creatorsMerged,
        creators_failed: acquisition.creatorsFailed,
        apify_run_id: acquisition.apifyRunId,
        dataset_id: acquisition.datasetId,
        reason: acquisition.reason,
      };
    },
    { connection: getRedisConnection(), concurrency: 1 }
  );
}
