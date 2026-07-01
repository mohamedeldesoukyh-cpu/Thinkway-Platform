#!/usr/bin/env node
/**
 * One-time emergency cleanup: drain Discovery BullMQ queues and reset orphaned
 * queued DB rows. Does NOT delete creators or import records.
 *
 * Run: npx tsx scripts/reset-stuck-enrichment-queued.ts
 */
import "@/lib/performance/script-env-preload";

import { clearDiscoveryEnrichmentQueues } from "@/lib/creator-enrichment/clear-queues";
import { createScriptSupabase, requireScriptEnvVars } from "@/lib/performance/script-env";

async function main(): Promise<void> {
  requireScriptEnvVars(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);

  console.log("\n=== Discovery — Stop queued enrichment/import jobs ===\n");

  const supabase = createScriptSupabase();

  const { count: queuedInfluencersBefore } = await supabase
    .from("influencers")
    .select("id", { count: "exact", head: true })
    .eq("enrichment_status", "queued");

  const { count: runningInfluencersBefore } = await supabase
    .from("influencers")
    .select("id", { count: "exact", head: true })
    .eq("enrichment_status", "running");

  const { count: queuedImportsBefore } = await supabase
    .from("creator_import_files")
    .select("id", { count: "exact", head: true })
    .eq("status", "queued");

  console.log("Before DB counts:");
  console.log(`  influencers enrichment_status=queued: ${queuedInfluencersBefore ?? 0}`);
  console.log(`  influencers enrichment_status=running: ${runningInfluencersBefore ?? 0}`);
  console.log(`  creator_import_files status=queued: ${queuedImportsBefore ?? 0}`);

  console.log("\nDraining BullMQ queues…");
  const queueResults = await clearDiscoveryEnrichmentQueues();
  let totalJobsRemoved = 0;
  for (const result of queueResults) {
    totalJobsRemoved += result.removed;
    if (result.error) {
      console.log(`  ${result.name}: removed=${result.removed} ERROR=${result.error}`);
    } else {
      console.log(`  ${result.name}: removed=${result.removed} job(s)`);
    }
  }

  console.log("\nResetting DB queued rows…");

  const { data: queuedNever, error: queuedNeverError } = await supabase
    .from("influencers")
    .update({ enrichment_status: "never" } as never)
    .eq("enrichment_status", "queued")
    .is("last_enriched_at", null)
    .select("id");

  if (queuedNeverError) throw new Error(queuedNeverError.message);

  const { data: queuedStale, error: queuedStaleError } = await supabase
    .from("influencers")
    .update({ enrichment_status: "failed" } as never)
    .eq("enrichment_status", "queued")
    .not("last_enriched_at", "is", null)
    .select("id");

  if (queuedStaleError) throw new Error(queuedStaleError.message);

  const { data: runningReset, error: runningResetError } = await supabase
    .from("influencers")
    .update({ enrichment_status: "failed" } as never)
    .eq("enrichment_status", "running")
    .select("id");

  if (runningResetError) throw new Error(runningResetError.message);

  const { data: importReset, error: importResetError } = await supabase
    .from("creator_import_files")
    .update({
      status: "uploaded",
      error_message:
        "Queue cleared manually — re-upload or retry when discovery-worker is running.",
    })
    .eq("status", "queued")
    .select("id");

  if (importResetError) throw new Error(importResetError.message);

  const influencersQueuedReset =
    (queuedNever?.length ?? 0) + (queuedStale?.length ?? 0);
  const influencersRunningReset = runningReset?.length ?? 0;
  const importFilesReset = importReset?.length ?? 0;

  const { count: queuedInfluencersAfter } = await supabase
    .from("influencers")
    .select("id", { count: "exact", head: true })
    .eq("enrichment_status", "queued");

  const { count: runningInfluencersAfter } = await supabase
    .from("influencers")
    .select("id", { count: "exact", head: true })
    .eq("enrichment_status", "running");

  const { count: queuedImportsAfter } = await supabase
    .from("creator_import_files")
    .select("id", { count: "exact", head: true })
    .eq("status", "queued");

  console.log("\n=== Summary ===");
  console.log(`BullMQ jobs removed: ${totalJobsRemoved}`);
  console.log(`influencers queued → reset: ${influencersQueuedReset}`);
  console.log(`influencers running → failed: ${influencersRunningReset}`);
  console.log(`creator_import_files queued → uploaded: ${importFilesReset}`);
  console.log("\nAfter DB counts:");
  console.log(`  influencers enrichment_status=queued: ${queuedInfluencersAfter ?? 0}`);
  console.log(`  influencers enrichment_status=running: ${runningInfluencersAfter ?? 0}`);
  console.log(`  creator_import_files status=queued: ${queuedImportsAfter ?? 0}`);
  console.log("");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
