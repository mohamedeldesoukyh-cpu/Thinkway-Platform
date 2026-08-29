import { Worker, type Job } from "bullmq";

import { getRedisConnection } from "../queues/connection.js";
import { QUEUES } from "../queues/names.js";
import { supabase } from "../db/supabase.js";

export type CampaignScriptTranslateJobData = {
  campaignHeaderId: string;
  scriptId: string;
  sourceRevisionId: string;
  targetLanguage: "en" | "ar";
  forceRegenerate: boolean;
  assignmentId?: string | null;
};

export function startCampaignScriptTranslateWorker(): Worker<CampaignScriptTranslateJobData> {
  return new Worker<CampaignScriptTranslateJobData>(
    QUEUES.campaignScriptTranslate,
    async (job: Job<CampaignScriptTranslateJobData>) => {
      const { processCampaignScriptTranslationJob } = await import(
        "@/lib/campaign-script/apply-translation.js"
      );

      const outcome = await processCampaignScriptTranslationJob(
        supabase as never,
        job.data,
        { attemptsMade: job.attemptsMade }
      );

      return {
        campaignHeaderId: job.data.campaignHeaderId,
        sourceRevisionId: job.data.sourceRevisionId,
        outcome: outcome.outcome,
      };
    },
    {
      connection: getRedisConnection(),
      concurrency: 2,
    }
  );
}
