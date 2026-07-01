import { Worker, type Job } from "bullmq";



import {

  finalizeCreatorImportFile,

  prepareCreatorImportFile,

  processCreatorImportChunk,

} from "@/lib/discovery-import/process.js";

import {

  CREATOR_IMPORT_CHUNK_WORKER_OPTIONS,

  CREATOR_IMPORT_WORKER_OPTIONS,

} from "@/lib/discovery-import/worker-options.js";

import type {

  CreatorImportChunkJobPayload,

  CreatorImportFinalizeJobPayload,

  CreatorImportJobPayload,

} from "@/lib/discovery-import/types.js";



import { getRedisConnection } from "../queues/connection.js";

import { QUEUES } from "../queues/names.js";

import { supabase } from "../db/supabase.js";

import { attachCreatorImportWorkerEvents } from "./creator-import-worker-events.js";



export function startCreatorImportWorker(): Worker<

  CreatorImportJobPayload | CreatorImportFinalizeJobPayload

> {

  const worker = new Worker<

    CreatorImportJobPayload | CreatorImportFinalizeJobPayload

  >(

    QUEUES.creatorImport,

    async (

      job: Job<CreatorImportJobPayload | CreatorImportFinalizeJobPayload>

    ) => {

      if (job.name === "finalize-import") {

        const log = await finalizeCreatorImportFile({

          supabase,

          importFileId: job.data.importFileId,

          payload: job.data as CreatorImportFinalizeJobPayload,

        });

        return {

          importFileId: job.data.importFileId,

          parser: log.parser,

          duration_ms: log.duration_ms,

          stage: "finalize",

          skipped: log.finalize_skipped ?? false,

          skipReason: log.finalize_skip_reason,

        };

      }



      const prepareResult = await prepareCreatorImportFile({

        supabase,

        importFileId: job.data.importFileId,

      });

      return {

        importFileId: job.data.importFileId,

        stage: "prepare",

        ...prepareResult,

      };

    },

    { connection: getRedisConnection(), ...CREATOR_IMPORT_WORKER_OPTIONS }

  );



  attachCreatorImportWorkerEvents(worker, "creator-import");

  return worker;

}



export function startCreatorImportChunkWorker(): Worker<CreatorImportChunkJobPayload> {

  const worker = new Worker<CreatorImportChunkJobPayload>(

    QUEUES.creatorImportChunk,

    async (job: Job<CreatorImportChunkJobPayload>) => {

      const result = await processCreatorImportChunk({

        supabase,

        importFileId: job.data.importFileId,

        payload: job.data,

        job,

      });

      return {

        importFileId: job.data.importFileId,

        chunkIndex: result.chunkIndex,

        skipped: result.skipped,

        skipReason: result.skipReason,

        progress: job.progress,

      };

    },

    { connection: getRedisConnection(), ...CREATOR_IMPORT_CHUNK_WORKER_OPTIONS }

  );



  attachCreatorImportWorkerEvents(worker, "creator-import-chunk");

  return worker;

}

