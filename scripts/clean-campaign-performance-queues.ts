#!/usr/bin/env node
/**
 * Remove stale BullMQ jobs from campaign performance queues.
 * Run: npm run clean:campaign-performance-queues
 */
import "@/lib/performance/script-env-preload";

import {
  CAMPAIGN_PERFORMANCE_QUEUES,
  cleanAllCampaignPerformanceQueues,
} from "@/lib/performance/campaign-performance-queues";
import { requireScriptEnvVars } from "@/lib/performance/script-env";

async function main(): Promise<void> {
  requireScriptEnvVars(["REDIS_URL"]);

  console.log("\n=== Campaign Performance — Queue Cleanup ===\n");
  console.log(`Queues: ${Object.values(CAMPAIGN_PERFORMANCE_QUEUES).join(", ")}\n`);

  const results = await cleanAllCampaignPerformanceQueues();
  let hadError = false;

  for (const result of results) {
    const summary = `failed=${result.cleanedFailed} completed=${result.cleanedCompleted} delayed=${result.cleanedDelayed}`;
    if (result.error) {
      hadError = true;
      console.log(`ERROR ${result.name} — ${result.error}`);
    } else {
      console.log(`CLEAN ${result.name} — ${summary}`);
    }
  }

  console.log(`\n=== Summary: ${hadError ? "COMPLETED WITH ERRORS" : "OK"} ===\n`);
  if (hadError) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
