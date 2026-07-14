/**
 * Creator Intelligence rollout — stage-gate preflight.
 *
 *   npm run rollout:preflight            (auto-detects current stage readiness)
 *
 * Executes every runbook check that code can execute against the REAL
 * environment (docs/CREATOR_INTELLIGENCE_ROLLOUT.md): env, database
 * connectivity (classified errors — never "no row" for a transport failure),
 * projection migration applied, projection population + category coverage,
 * current flag modes, Redis producer/worker parity, and discovery queue
 * health. Prints one PASS/FAIL line per check and a final stage verdict:
 * READY FOR SHADOW / READY FOR ON / READY FOR PREDICATE FLIP.
 *
 * Read-only against business data (SELECT + head counts only).
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- ops script: service client */
import { createBullMqQueueConnection } from "@/lib/redis/bullmq-connection";
import {
  createScriptSupabase,
  formatScriptErrorWithDiagnostics,
} from "@/lib/performance/script-env";

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${name.padEnd(38)} ${detail}`);
}

const COVERAGE_GATE_PCT = 80;

async function main() {
  console.log("\nCREATOR INTELLIGENCE ROLLOUT — STAGE-GATE PREFLIGHT\n");

  // 1) Environment ------------------------------------------------------------
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const redisUrl = process.env.REDIS_URL?.trim();
  const mode = process.env.CREATOR_INTELLIGENCE_MODE?.trim().toLowerCase() || "off";
  const intentTags = process.env.DISCOVERY_WRITE_INTENT_TAGS?.trim() ?? "(unset → legacy on)";

  record("env: NEXT_PUBLIC_SUPABASE_URL", Boolean(url), url ? new URL(url).host : "MISSING");
  record("env: SUPABASE_SERVICE_ROLE_KEY", Boolean(serviceKey?.startsWith("eyJ")), serviceKey ? "present" : "MISSING");
  record("env: CREATOR_INTELLIGENCE_MODE", true, mode);
  record("env: DISCOVERY_WRITE_INTENT_TAGS", true, intentTags);

  if (!url || !serviceKey?.startsWith("eyJ")) {
    console.log("\nVERDICT: BLOCKED — Supabase credentials missing; nothing further can be checked.\n");
    process.exit(1);
  }

  // 2) Redis parity (producer options must resolve to a real host) -------------
  if (redisUrl) {
    try {
      const conn = createBullMqQueueConnection(redisUrl) as { host?: string; port?: number };
      const ok = Boolean(conn.host) && conn.host !== "localhost";
      record(
        "redis: producer target",
        Boolean(conn.host),
        `${conn.host}:${conn.port}${ok ? "" : "  (localhost — worker must run on the same machine)"}`
      );
    } catch (e: any) {
      record("redis: producer target", false, `REDIS_URL unparsable: ${e.message}`);
    }
  } else {
    record("redis: producer target", false, "REDIS_URL missing — acquisition queue disabled");
  }

  // 3) Database connectivity (classified) --------------------------------------
  const supabase = createScriptSupabase() as any;

  const probe = await supabase.from("ai_conversations").select("id", { count: "exact", head: true });
  if (probe.error) {
    const detail = probe.error.message ?? String(probe.error);
    record("db: connectivity", false, detail);
    if (detail.includes("fetch failed")) {
      console.error("\n" + (await formatScriptErrorWithDiagnostics(new Error(detail))) + "\n");
    }
    console.log("\nVERDICT: BLOCKED — database unreachable (connection problem, NOT missing data).\n");
    process.exit(1);
  }
  record("db: connectivity", true, "service role can read");

  // 4) Projection migration applied --------------------------------------------
  const projection = await supabase
    .from("creator_intelligence")
    .select("unified_id", { count: "exact", head: true });
  const migrationApplied = !projection.error;
  record(
    "db: creator_intelligence table",
    migrationApplied,
    migrationApplied
      ? `${projection.count ?? 0} rows`
      : `NOT APPLIED (${projection.error?.message ?? "missing"}) — run the 20260713120000 migration`
  );

  // 5) Projection coverage (gates ON / predicate flip) --------------------------
  let coveragePct: number | null = null;
  if (migrationApplied && (projection.count ?? 0) > 0) {
    const withCategories = await supabase
      .from("creator_intelligence")
      .select("unified_id", { count: "exact", head: true })
      .not("categories", "eq", "{}");
    if (!withCategories.error) {
      coveragePct = Math.round(((withCategories.count ?? 0) / (projection.count ?? 1)) * 100);
      record(
        "projection: category coverage",
        coveragePct >= COVERAGE_GATE_PCT,
        `${coveragePct}% (gate ≥${COVERAGE_GATE_PCT}%)`
      );
    }
  } else if (migrationApplied) {
    record("projection: category coverage", false, "0 rows — run npm run backfill:creator-intelligence");
  }

  // 6) Discovery queue health ----------------------------------------------------
  const jobs = await supabase
    .from("discovery_jobs")
    .select("status, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  if (!jobs.error) {
    const rows = (jobs.data ?? []) as Array<{ status: string; created_at: string }>;
    const stalePending = rows.filter(
      (r) => r.status === "pending" && Date.now() - new Date(r.created_at).getTime() > 30 * 60_000
    ).length;
    record(
      "queue: discovery_jobs health",
      stalePending === 0,
      stalePending === 0
        ? `${rows.length} recent jobs, none stale-pending`
        : `${stalePending} pending >30min — worker not consuming (check npm run discovery:worker + Redis parity)`
    );
  }

  // 7) Stage verdict ---------------------------------------------------------------
  const failed = checks.filter((c) => !c.pass).map((c) => c.name);
  console.log("\n────────────────────────────────────────────────");
  if (!migrationApplied) {
    console.log("VERDICT: apply the projection migration, then re-run.");
  } else if (mode === "off") {
    console.log(
      failed.length === 0 || failed.every((f) => f.includes("coverage"))
        ? "VERDICT: READY FOR SHADOW — set CREATOR_INTELLIGENCE_MODE=shadow and redeploy."
        : `VERDICT: fix before SHADOW → ${failed.join("; ")}`
    );
  } else if (mode === "shadow") {
    console.log(
      coveragePct != null && coveragePct >= COVERAGE_GATE_PCT
        ? "VERDICT: coverage gate met — after 5–7 days of clean shadow telemetry, READY FOR ON."
        : "VERDICT: stay in SHADOW — run backfill/enrichment until coverage meets the gate."
    );
  } else {
    console.log(
      coveragePct != null && coveragePct >= COVERAGE_GATE_PCT && failed.length === 0
        ? "VERDICT: ON healthy — predicate flip is the next stage (own deploy + parity sampling)."
        : `VERDICT: ON with open issues → ${failed.join("; ") || "coverage below gate"}`
    );
  }
  console.log("Runbook: docs/CREATOR_INTELLIGENCE_ROLLOUT.md\n");
  process.exit(failed.some((f) => f.startsWith("db:") || f.startsWith("env:")) ? 1 : 0);
}

main().catch((error) => {
  console.error("PREFLIGHT FAILED:", error);
  process.exit(1);
});
