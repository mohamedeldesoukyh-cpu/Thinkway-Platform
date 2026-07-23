import { Queue, Worker } from "bullmq";

import {
  AUTOMATIC_ENRICHMENT_ACQUISITION_DISABLED_REASON,
  isAutomaticEnrichmentAndAcquisitionDisabled,
  logBlockedAutomaticAction,
} from "@/lib/discovery/operational-safety.js";

import { getRedisConnection } from "../queues/connection.js";
import { QUEUES } from "../queues/names.js";
import { supabase } from "../db/supabase.js";

export function startRefreshWorker(): Worker {
  const enrichmentQueue = new Queue(QUEUES.enrichment, {
    connection: getRedisConnection(),
  });

  return new Worker(
    QUEUES.refresh,
    async () => {
      if (isAutomaticEnrichmentAndAcquisitionDisabled()) {
        logBlockedAutomaticAction(
          "legacy_discovery_enrich_enqueue",
          AUTOMATIC_ENRICHMENT_ACQUISITION_DISABLED_REASON
        );
        return { queued: 0, skipped: true };
      }

      const now = new Date().toISOString();
      const { data: dueProfiles, error } = await supabase
        .from("discovered_profiles")
        .select("id")
        .lte("next_refresh_at", now)
        .neq("stage", "verified")
        .limit(50);

      if (error) throw new Error(error.message);

      for (const row of dueProfiles ?? []) {
        await enrichmentQueue.add(
          "refresh-profile",
          { profileId: row.id as string },
          { removeOnComplete: 100, removeOnFail: 50 }
        );
      }

      return { queued: dueProfiles?.length ?? 0 };
    },
    { connection: getRedisConnection(), concurrency: 1 }
  );
}
