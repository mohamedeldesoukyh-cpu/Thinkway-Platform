import { Worker, type Job } from "bullmq";

import { processCreatorImportFile } from "@/lib/discovery-import/process.js";
import { enrichImportedPlatformAccount } from "@/lib/discovery-import/enrichment.js";
import type {
  CreatorImportEnrichmentJobPayload,
  CreatorImportJobPayload,
} from "@/lib/discovery-import/types.js";

import { getRedisConnection } from "../queues/connection.js";
import { QUEUES } from "../queues/names.js";
import { supabase } from "../db/supabase.js";

export function startCreatorImportWorker(): Worker<CreatorImportJobPayload> {
  return new Worker<CreatorImportJobPayload>(
    QUEUES.creatorImport,
    async (job: Job<CreatorImportJobPayload>) => {
      const log = await processCreatorImportFile({
        supabase,
        importFileId: job.data.importFileId,
      });
      return {
        importFileId: job.data.importFileId,
        parser: log.parser,
        duration_ms: log.duration_ms,
      };
    },
    { connection: getRedisConnection(), concurrency: 1 }
  );
}

export function startCreatorImportEnrichmentWorker(): Worker<CreatorImportEnrichmentJobPayload> {
  return new Worker<CreatorImportEnrichmentJobPayload>(
    QUEUES.creatorImportEnrich,
    async (job: Job<CreatorImportEnrichmentJobPayload>) => {
      const result = await enrichImportedPlatformAccount(supabase, job.data);
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result;
    },
    { connection: getRedisConnection(), concurrency: 3 }
  );
}
