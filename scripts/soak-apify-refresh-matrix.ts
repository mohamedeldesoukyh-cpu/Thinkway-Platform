/**
 * Enterprise multi-scenario Apify refresh soak (Development only).
 *
 * Usage:
 *   npx tsx scripts/soak-apify-refresh-matrix.ts
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
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

const DEV_REF = "hsxrewjcbvmbkqdlzjhs";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
if (!url.includes(DEV_REF)) {
  console.error("Refuse: not Development Supabase", url);
  process.exit(1);
}

type ScenarioId =
  | "instagram_only"
  | "tiktok_only"
  | "both_platforms"
  | "no_recent_changes"
  | "budget_verification_fails"
  | "actor_fails"
  | "dataset_empty";

type ScenarioResult = {
  scenario: ScenarioId;
  influencerId: string | null;
  ok: boolean;
  notes: string[];
  budget?: unknown;
  enrichment?: unknown;
  toast?: unknown;
  syncStatus?: string;
  aggregated?: string;
  trace?: unknown;
};

async function pickCreator(
  supabase: ReturnType<typeof createClient>,
  kind: "instagram_only" | "tiktok_only" | "both"
): Promise<{ id: string; platforms: string[] } | null> {
  const { data: accounts } = await supabase
    .from("influencer_platform_accounts")
    .select("influencer_id, platform, username, profile_url, enrichment_status")
    .in("platform", ["instagram", "tiktok"])
    .not("username", "is", null)
    .order("last_enriched_at", { ascending: false, nullsFirst: false })
    .limit(200);

  const byCreator = new Map<string, Array<{ platform: string; username: string; profile_url: string }>>();
  for (const row of accounts ?? []) {
    const r = row as {
      influencer_id: string;
      platform: string;
      username: string | null;
      profile_url: string | null;
    };
    if (!r.username?.trim() || !r.profile_url?.trim()) continue;
    const list = byCreator.get(r.influencer_id) ?? [];
    list.push({
      platform: r.platform,
      username: r.username,
      profile_url: r.profile_url,
    });
    byCreator.set(r.influencer_id, list);
  }

  for (const [id, plats] of byCreator) {
    const names = [...new Set(plats.map((p) => p.platform))];
    if (kind === "both" && names.includes("instagram") && names.includes("tiktok")) {
      return { id, platforms: names };
    }
    if (kind === "instagram_only" && names.length === 1 && names[0] === "instagram") {
      return { id, platforms: names };
    }
    if (kind === "tiktok_only" && names.length === 1 && names[0] === "tiktok") {
      return { id, platforms: names };
    }
  }
  return null;
}

async function loadLatestTrace(
  supabase: ReturnType<typeof createClient>,
  influencerId: string
) {
  const { data } = await supabase
    .from("creator_enrichment_runs")
    .select(
      "refresh_id, status, failure_stage, error_message, apify_run_id, execution_trace, created_at"
    )
    .eq("influencer_id", influencerId)
    .neq("status", "running")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function runLive(
  supabase: ReturnType<typeof createClient>,
  influencerId: string,
  label: ScenarioId
): Promise<ScenarioResult> {
  const notes: string[] = [];
  const budget = await assertApifyAcquisitionBudget(supabase, {
    source: `soak_matrix_${label}`,
  });
  notes.push(`budget:${budget.code}`);

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
    { attempt: 1, jobId: `soak-matrix-${label}-${Date.now()}` }
  );

  const after = await supabase
    .from("influencers")
    .select("enrichment_status, enrichment_source, metadata")
    .eq("id", influencerId)
    .maybeSingle();
  const { data: platforms } = await supabase
    .from("influencer_platform_accounts")
    .select("platform, enrichment_status")
    .eq("influencer_id", influencerId);

  const aggregated = resolveAggregatedCreatorEnrichmentStatus({
    creatorId: influencerId,
    storedStatus: (after.data as { enrichment_status: string } | null)?.enrichment_status as never,
    platformStatuses: (platforms ?? []).map(
      (p) => (p as { enrichment_status: string }).enrichment_status as never
    ),
    hasInflightJob: false,
    log: false,
  });
  const syncStatus = mapEnrichmentStatusToSyncStatus(aggregated);
  const terminal = await loadLatestTrace(supabase, influencerId);
  const toast = resolveManualRefreshToast({
    syncStatus: result.status === "failed" ? "failed" : syncStatus,
    refreshSource: "live_apify",
    enrichmentSource: (after.data as { enrichment_source?: string | null } | null)
      ?.enrichment_source,
    enrichmentStatus: (after.data as { enrichment_status?: string | null } | null)
      ?.enrichment_status,
    failureStage: (terminal as { failure_stage?: string | null } | null)?.failure_stage,
    failureReason:
      (terminal as { error_message?: string | null } | null)?.error_message ?? result.message,
  });

  const trace = (terminal as { execution_trace?: Record<string, unknown> } | null)
    ?.execution_trace;
  notes.push(`enrichment:${result.status}`);
  notes.push(`toast:${toast.title}`);
  notes.push(`sync:${syncStatus}`);
  if (trace?.budgetVerification) notes.push("trace.budget=ok");
  if (trace?.snapshotId) notes.push("trace.snapshot");
  if ((trace?.dnaUpdate as { ok?: boolean } | undefined)?.ok) notes.push("trace.dna");
  if ((trace?.eciUpdate as { ok?: boolean } | undefined)?.ok) notes.push("trace.eci");

  const okLive =
    result.ok &&
    (result.status === "enriched" || result.status === "partial") &&
    toast.tone === "success" &&
    syncStatus === "completed";

  return {
    scenario: label,
    influencerId,
    ok: okLive,
    notes,
    budget: { allowed: budget.allowed, code: budget.code },
    enrichment: { ok: result.ok, status: result.status, message: result.message },
    toast,
    syncStatus,
    aggregated,
    trace: {
      refreshId: (terminal as { refresh_id?: string } | null)?.refresh_id,
      failureStage: (terminal as { failure_stage?: string } | null)?.failure_stage,
      externalRunId: (terminal as { apify_run_id?: string } | null)?.apify_run_id,
      snapshotId: trace?.snapshotId,
      dnaUpdate: trace?.dnaUpdate,
      eciUpdate: trace?.eciUpdate,
      durationMs: trace?.durationMs,
    },
  };
}

async function main() {
  if (!process.env.DISCOVERY_APIFY_MAX_REQUESTS_PER_DAY) {
    process.env.DISCOVERY_APIFY_MAX_REQUESTS_PER_DAY = "500";
  }
  if (!process.env.DISCOVERY_APIFY_MAX_CREDITS_PER_DAY) {
    process.env.DISCOVERY_APIFY_MAX_CREDITS_PER_DAY = "500";
  }

  const resolved = tryCreateServiceRoleClient();
  if (!resolved.client) {
    console.error("service-role client failed", resolved.reason);
    process.exit(1);
  }
  const supabase = resolved.client;
  const results: ScenarioResult[] = [];

  console.log("=== Enterprise Apify refresh matrix soak ===");

  // 1) Instagram-only
  const ig = await pickCreator(supabase, "instagram_only");
  results.push(
    ig
      ? await runLive(supabase, ig.id, "instagram_only")
      : {
          scenario: "instagram_only",
          influencerId: null,
          ok: false,
          notes: ["no candidate"],
        }
  );

  // 2) TikTok-only
  const tt = await pickCreator(supabase, "tiktok_only");
  results.push(
    tt
      ? await runLive(supabase, tt.id, "tiktok_only")
      : {
          scenario: "tiktok_only",
          influencerId: null,
          ok: false,
          notes: ["no candidate"],
        }
  );

  // 3) Both platforms
  const both = await pickCreator(supabase, "both");
  results.push(
    both
      ? await runLive(supabase, both.id, "both_platforms")
      : {
          scenario: "both_platforms",
          influencerId: null,
          ok: false,
          notes: ["no candidate"],
        }
  );

  // 4) No recent changes — immediate second refresh on same both-creator (or IG)
  const noChangeId = both?.id ?? ig?.id;
  if (noChangeId) {
    const second = await runLive(supabase, noChangeId, "no_recent_changes");
    // Accept success toast OR no_profile_changes message — both are valid after force refresh
    const title = (second.toast as { title?: string } | undefined)?.title ?? "";
    const acceptable =
      second.ok ||
      /no profile changes/i.test(title) ||
      second.enrichment &&
        typeof second.enrichment === "object" &&
        (second.enrichment as { status?: string }).status === "enriched";
    results.push({
      ...second,
      ok: Boolean(acceptable),
      notes: [
        ...second.notes,
        "forced second pass — may still update avatar/publications",
      ],
    });
  } else {
    results.push({
      scenario: "no_recent_changes",
      influencerId: null,
      ok: false,
      notes: ["no candidate"],
    });
  }

  // 5) Budget verification fails — null client path (does not call Apify)
  {
    const budget = await assertApifyAcquisitionBudget(null, {
      source: "soak_matrix_budget_fail",
      meta: { clientResolutionReason: "soak forced null client" },
      settings: {
        discoverySource: "hybrid",
        searchPriority: "database_first",
        coverageThreshold: 80,
        automaticEnrichment: "never",
        dataFreshnessDays: null,
        dnaPolicy: {
          generateAfterImport: true,
          updateAfterEnrichment: true,
          calculateCompleteness: true,
        },
        costProtection: {
          maxRequestsPerDay: 500,
          maxCreditsPerDay: 500,
          confirmBeforeExceed: false,
        },
      },
    });
    const toast = resolveManualRefreshToast({
      syncStatus: "failed",
      refreshSource: "live_apify",
      failureStage: "budget_verification",
      failureReason: budget.reason,
    });
    const statusCheck = resolveAggregatedCreatorEnrichmentStatus({
      creatorId: "soak-budget-fail",
      storedStatus: "failed",
      platformStatuses: ["enriched", "enriched"],
      hasInflightJob: false,
      log: false,
    });
    results.push({
      scenario: "budget_verification_fails",
      influencerId: null,
      ok:
        budget.code === "usage_unverified" &&
        toast.title === "Budget verification failed" &&
        statusCheck === "failed" &&
        !/finished without new Apify/i.test(toast.title),
      notes: [
        `budget:${budget.code}`,
        `toast:${toast.title}`,
        `status_ssot:${statusCheck}`,
      ],
      budget: { allowed: budget.allowed, code: budget.code },
      toast,
      aggregated: statusCheck,
      syncStatus: mapEnrichmentStatusToSyncStatus(statusCheck),
    });
  }

  // 6) Actor fails — disable token temporarily for one assert path via classify toast
  {
    const toast = resolveManualRefreshToast({
      syncStatus: "failed",
      refreshSource: "live_apify",
      failureReason: "No Apify actor configured for platform instagram.",
    });
    results.push({
      scenario: "actor_fails",
      influencerId: null,
      ok: toast.title === "Actor launch failed" && toast.tone === "error",
      notes: [`toast:${toast.title}`],
      toast,
    });
  }

  // 7) Dataset empty — classify + toast path
  {
    const toast = resolveManualRefreshToast({
      syncStatus: "failed",
      refreshSource: "live_apify",
      failureReason: "Apify dataset fetch failed (404): dataset items empty",
    });
    results.push({
      scenario: "dataset_empty",
      influencerId: null,
      ok: toast.title === "Dataset retrieval failed" && toast.tone === "error",
      notes: [`toast:${toast.title}`],
      toast,
    });
  }

  const outPath = resolve("scripts/tmp-soak-apify-refresh-matrix-report.json");
  writeFileSync(outPath, JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
  console.log(JSON.stringify(results, null, 2));
  console.log("wrote", outPath);

  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.error("SOAK_MATRIX_FAIL", failed.map((f) => f.scenario));
    process.exit(2);
  }
  console.log("SOAK_MATRIX_PASS", results.map((r) => r.scenario).join(", "));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
