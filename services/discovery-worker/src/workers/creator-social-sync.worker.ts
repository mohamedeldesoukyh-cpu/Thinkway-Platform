import { Worker, type Job } from "bullmq";

import { processCreatorSocialSyncJob } from "@/lib/creator-social/sync/process.js";

import { getRedisConnection } from "../queues/connection.js";
import { QUEUES } from "../queues/names.js";
import { supabase } from "../db/supabase.js";

export type CreatorSocialSyncJobData = {
  connectionId: string;
  influencerId: string;
  trigger: "initial" | "manual" | "retry";
};

export function startCreatorSocialSyncWorker(): Worker<CreatorSocialSyncJobData> {
  return new Worker<CreatorSocialSyncJobData>(
    QUEUES.creatorSocialSync,
    async (job: Job<CreatorSocialSyncJobData>) => {
      return processCreatorSocialSyncJob(supabase as never, {
        connectionId: job.data.connectionId,
        influencerId: job.data.influencerId,
      });
    },
    {
      connection: getRedisConnection(),
      concurrency: 2,
    }
  );
}
