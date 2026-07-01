import { FlowProducer, Queue } from "bullmq";

import { CAMPAIGN_PERFORMANCE_JOB_OPTIONS } from "@/lib/performance/campaign-performance-queue-options";
import {
  CREATOR_IMPORT_CHUNK_LOCK_DURATION_MS,
  CREATOR_IMPORT_PREPARE_LOCK_DURATION_MS,
  CREATOR_IMPORT_QUEUES,
} from "@/lib/discovery-import/constants";
import { getConnectionOptions } from "@/lib/discovery-import/queue-connection";

export { CREATOR_IMPORT_QUEUES };

import type {
  CreatorImportChunkJobPayload,
  CreatorImportFinalizeJobPayload,
  CreatorImportJobPayload,
} from "./types";



const IMPORT_JOB_OPTIONS = {

  ...CAMPAIGN_PERFORMANCE_JOB_OPTIONS,

  attempts: 3,

  backoff: { type: "exponential" as const, delay: 5000 },

  lockDuration: CREATOR_IMPORT_PREPARE_LOCK_DURATION_MS,

} as const;



const CHUNK_JOB_OPTIONS = {

  ...IMPORT_JOB_OPTIONS,

  lockDuration: CREATOR_IMPORT_CHUNK_LOCK_DURATION_MS,

} as const;

export function isCreatorImportQueueAvailable(): boolean {

  return Boolean(process.env.REDIS_URL);

}



export async function enqueueCreatorImportJob(

  payload: CreatorImportJobPayload

): Promise<{ queued: boolean; reason?: string; jobId?: string }> {

  const connection = getConnectionOptions();

  if (!connection) {

    return { queued: false, reason: "REDIS_URL not configured" };

  }



  const queue = new Queue(CREATOR_IMPORT_QUEUES.import, { connection });

  const job = await queue.add("prepare-import", payload, {

    ...IMPORT_JOB_OPTIONS,

    jobId: `creator-import-${payload.importFileId}`,

  });

  await queue.close();

  return { queued: true, jobId: job.id };

}



export type EnqueueCreatorImportChunkFlowInput = CreatorImportFinalizeJobPayload & {

  fileType: string;

  sourceName: string | null;

  uploadedBy: string | null;

  sourceStoragePath: string;

};



/** Queue one finalize parent job and one chunk child job per 100 creators. */

export async function enqueueCreatorImportChunkFlow(

  input: EnqueueCreatorImportChunkFlowInput

): Promise<{ flowJobId: string; totalChunks: number }> {

  const connection = getConnectionOptions();

  if (!connection) {

    throw new Error("REDIS_URL not configured");

  }



  const flowProducer = new FlowProducer({ connection });



  try {

    const finalizePayload: CreatorImportFinalizeJobPayload = {

      importFileId: input.importFileId,

      totalChunks: input.totalChunks,

      parser: input.parser,

      extractedTextLength: input.extractedTextLength,

      extractionMethod: input.extractionMethod,

      warning: input.warning,

    };



    const children = Array.from({ length: input.totalChunks }, (_, chunkIndex) => {

      const chunkPayload: CreatorImportChunkJobPayload = {

        importFileId: input.importFileId,

        chunkIndex,

        totalChunks: input.totalChunks,

        fileType: input.fileType,

        sourceName: input.sourceName,

        uploadedBy: input.uploadedBy,

        sourceStoragePath: input.sourceStoragePath,

      };



      return {

        name: "process-chunk",

        queueName: CREATOR_IMPORT_QUEUES.chunk,

        data: chunkPayload,

        opts: {

          ...CHUNK_JOB_OPTIONS,

          jobId: `creator-import-chunk-${input.importFileId}-${chunkIndex}`,

        },

      };

    });



    const flow = await flowProducer.add({

      name: "finalize-import",

      queueName: CREATOR_IMPORT_QUEUES.import,

      data: finalizePayload,

      opts: {

        ...IMPORT_JOB_OPTIONS,

        jobId: `creator-import-finalize-${input.importFileId}`,

      },

      children,

    });



    return {

      flowJobId: flow.job.id ?? `creator-import-finalize-${input.importFileId}`,

      totalChunks: input.totalChunks,

    };

  } finally {

    await flowProducer.close().catch(() => {});

  }

}



async function queueHasInflightImportFileJob(

  queueName: string,

  importFileId: string

): Promise<boolean> {

  const connection = getConnectionOptions();

  if (!connection) return false;



  const queue = new Queue(queueName, { connection });

  try {

    const jobs = await queue.getJobs(
      ["active", "waiting", "delayed", "waiting-children"],
      0,
      499
    );

    return jobs.some((job) => {

      const data = job.data as { importFileId?: string };

      return data.importFileId === importFileId;

    });

  } catch {

    return false;

  } finally {

    await queue.close().catch(() => {});

  }

}



/** True when an import file job is waiting or actively processing. */

export async function creatorImportFileHasInflightJob(

  importFileId: string

): Promise<boolean> {

  const queues = [

    CREATOR_IMPORT_QUEUES.import,

    CREATOR_IMPORT_QUEUES.chunk,

  ] as const;



  for (const queueName of queues) {

    if (await queueHasInflightImportFileJob(queueName, importFileId)) {

      return true;

    }

  }



  return false;

}

