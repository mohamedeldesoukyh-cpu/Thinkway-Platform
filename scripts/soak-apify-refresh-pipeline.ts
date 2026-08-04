/**
 * Dev soak: Apify manual refresh pipeline (budget → actor → snapshot → DNA → ECI → status).
 * Target: Development Supabase hsxrewjcbvmbkqdlzjhs only.
 *
 * Usage:
 *   npx tsx scripts/tmp-soak-apify-refresh-pipeline.ts
 *   npx tsx scripts/tmp-soak-apify-refresh-pipeline.ts --influencer=<uuid>
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { assertApifyAcquisitionBudget } from "../lib/discovery/control-center/apify-budget";
import { runCreatorEnrichment } from "../lib/creator-enrichment/service";
import { resolveAggregatedCreatorEnrichmentStatus } from "../lib/creator-enrichment/status-resolution";
import { resolveManualRefreshToast } from "../lib/creator-enrichment/refresh-failure-stage";
import { mapEnrichmentStatusToSyncStatus } from "../lib/services/creators/creator-enrichment-service-shared";
import { tryCreateServiceRoleClient } from "../lib/supabase/service-role-client";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i <= 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}

loadEnvFile(resolve(".env"));
loadEnvFile(resolve(".env.local"));

// Dev Control Center is seeded 0/0. Env caps unlock acquisition without bypassing the gate.
if (!process.env.DISCOVERY_APIFY_MAX_REQUESTS_PER_DAY) {
  process.env.DISCOVERY_APIFY_MAX_REQUESTS_PER_DAY = "500";
}
if (!process.env.DISCOVERY_APIFY_MAX_CREDITS_PER_DAY) {
  process.env.DISCOVERY_APIFY_MAX_CREDITS_PER_DAY = "500";
}

const DEV_REF = "hsxrewjcbvmbkqdlzjhs";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
if (!url.includes(DEV_REF)) {
  console.error("Refuse: NEXT_PUBLIC_SUPABASE_URL is not Development", url);
  process.exit(1);
}

const argInfluencer = process.argv
  .find((a) => a.startsWith("--influencer="))
  ?.slice("--influencer=".length);

async function main() {
  console.log("=== Apify refresh pipeline soak (Development) ===");

  const resolved = tryCreateServiceRoleClient();
  console.log("service_role_client", {
    ok: Boolean(resolved.client),
    reason: resolved.reason,
  });
  if (!resolved.client) {
    process.exit(1);
  }
  const supabase = resolved.client;

  const budget = await assertApifyAcquisitionBudget(supabase, {
    source: "soak_apify_refresh_pipeline",
  });
  console.log("budget_gate", {
    allowed: budget.allowed,
    code: budget.code,
    reason: budget.reason,
    caps: budget.caps,
    usage: budget.usage ?? null,
  });
  if (!budget.allowed) {
    console.error("Budget gate failed — UI toast must report Budget verification failed (not Refresh finished).");
    const toast = resolveManualRefreshToast({
      syncStatus: "failed",
      refreshSource: "live_apify",
      failureStage: "budget_verification",
      failureReason: budget.reason,
    });
    console.log("expected_toast", toast);
    process.exit(2);
  }

  let influencerId = argInfluencer?.trim() || "";
  if (!influencerId) {
    const { data: candidates, error } = await supabase
      .from("influencer_platform_accounts")
      .select("influencer_id, platform, username, handle, profile_url, enrichment_status")
      .eq("platform", "instagram")
      .not("username", "is", null)
      .order("last_enriched_at", { ascending: false, nullsFirst: false })
      .limit(20);
    if (error) throw new Error(error.message);
    const pick = (candidates ?? []).find(
      (row) =>
        Boolean((row as { username?: string }).username?.trim()) &&
        Boolean((row as { profile_url?: string }).profile_url?.trim())
    ) as { influencer_id: string; username: string } | undefined;
    if (!pick) {
      console.error("No Instagram creator candidate found");
      process.exit(1);
    }
    influencerId = pick.influencer_id;
    console.log("picked_creator", pick);
  }

  const before = await supabase
    .from("influencers")
    .select("id, full_name, enrichment_status, enrichment_source, last_enriched_at")
    .eq("id", influencerId)
    .maybeSingle();
  console.log("before", before.data);

  const { data: platformsBefore } = await supabase
    .from("influencer_platform_accounts")
    .select("platform, enrichment_status")
    .eq("influencer_id", influencerId);

  console.log("platforms_before", platformsBefore);

  // Simulate historical false-positive: if influencer were failed with enriched platforms
  const falsePositive = resolveAggregatedCreatorEnrichmentStatus({
    creatorId: influencerId,
    storedStatus: "failed",
    platformStatuses: (platformsBefore ?? []).map(
      (p) => (p as { enrichment_status: string }).enrichment_status as never
    ),
    hasInflightJob: false,
    log: false,
  });
  console.log("status_ssot_check_failed_vs_historical", {
    resolved: falsePositive,
    sync: mapEnrichmentStatusToSyncStatus(falsePositive),
    expect: "failed",
  });

  console.log("running runCreatorEnrichment force live_apify…");
  const result = await runCreatorEnrichment(
    supabase,
    {
      influencerId,
      trigger: "manual",
      priority: 1,
      force: true,
      scope: "all",
      dataSource: "live_apify",
    },
    { attempt: 1, jobId: `soak-refresh-${Date.now()}` }
  );
  console.log("enrichment_result", result);

  const after = await supabase
    .from("influencers")
    .select("id, enrichment_status, enrichment_source, last_enriched_at, metadata, apify_run_id")
    .eq("id", influencerId)
    .maybeSingle();
  console.log("after_influencer", after.data);

  const { data: platformsAfter } = await supabase
    .from("influencer_platform_accounts")
    .select("platform, enrichment_status")
    .eq("influencer_id", influencerId);
  const aggregated = resolveAggregatedCreatorEnrichmentStatus({
    creatorId: influencerId,
    storedStatus: (after.data as { enrichment_status: string } | null)?.enrichment_status as never,
    platformStatuses: (platformsAfter ?? []).map(
      (p) => (p as { enrichment_status: string }).enrichment_status as never
    ),
    hasInflightJob: false,
    log: false,
  });
  const syncStatus = mapEnrichmentStatusToSyncStatus(aggregated);
  console.log("after_status", { aggregated, syncStatus, platformsAfter });

  const { data: runs } = await supabase
    .from("creator_enrichment_runs")
    .select(
      "id, refresh_id, status, failure_stage, error_message, apify_run_id, execution_trace, created_at, completed_at"
    )
    .eq("influencer_id", influencerId)
    .order("created_at", { ascending: false })
    .limit(3);
  console.log("recent_runs", JSON.stringify(runs, null, 2));

  const terminal = (runs ?? []).find(
    (r) => (r as { status: string }).status !== "running"
  ) as
    | {
        refresh_id: string | null;
        status: string;
        failure_stage: string | null;
        error_message: string | null;
        execution_trace: Record<string, unknown> | null;
        apify_run_id: string | null;
      }
    | undefined;

  const toast = resolveManualRefreshToast({
    syncStatus: result.status === "failed" ? "failed" : syncStatus,
    refreshSource: "live_apify",
    enrichmentSource: (after.data as { enrichment_source?: string | null } | null)
      ?.enrichment_source,
    enrichmentStatus: (after.data as { enrichment_status?: string | null } | null)
      ?.enrichment_status,
    failureStage: terminal?.failure_stage,
    failureReason: terminal?.error_message ?? result.message,
  });
  console.log("expected_ui_toast", toast);

  const trace = terminal?.execution_trace ?? {};
  console.log("trace_summary", {
    refreshId: terminal?.refresh_id ?? trace.refreshId,
    budgetVerification: trace.budgetVerification,
    actorId: trace.actorId,
    externalRunId: terminal?.apify_run_id ?? trace.externalRunId,
    datasetId: trace.datasetId,
    snapshotId: trace.snapshotId,
    dnaUpdate: trace.dnaUpdate,
    eciUpdate: trace.eciUpdate,
    finalStatus: terminal?.status ?? trace.finalStatus,
    failureStage: terminal?.failure_stage ?? trace.failureStage,
    failureReason: terminal?.error_message ?? trace.failureReason,
    durationMs: trace.durationMs,
  });

  const okLive =
    result.ok &&
    (result.status === "enriched" || result.status === "partial") &&
    Boolean(terminal?.apify_run_id || (trace.externalRunId as string | undefined)) &&
    toast.tone === "success";

  if (okLive) {
    console.log("SOAK_PASS live Apify refresh");
    process.exit(0);
  }

  if (result.status === "failed") {
    console.log("SOAK_FAIL_REPORTED_CORRECTLY", {
      note: "Failure must never toast Refresh finished / completed from historical enrichment",
      syncStatus,
      toast,
    });
    process.exit(result.message?.includes("budget") ? 2 : 3);
  }

  console.log("SOAK_PARTIAL_OR_UNEXPECTED", { result, toast, syncStatus });
  process.exit(4);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
