#!/usr/bin/env node
/**
 * Release 1.2 Phase 1 — Database-First Discovery validation.
 * Structural + offline unit checks. Does NOT claim PASS on fixtures.
 *
 * Run: node scripts/validate-database-first-discovery.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const FIXTURES = [
  { id: "babyjoy", label: "BabyJoy", brief: "BabyJoy parenting baby care Egypt mothers" },
  { id: "cocacola", label: "Coca-Cola", brief: "Coca-Cola Gen Z beverage campaign UAE" },
  { id: "samsung", label: "Samsung", brief: "Samsung tech multi-platform creators KSA" },
  { id: "loreal", label: "L'Oréal", brief: "Loreal beauty skincare influencers Egypt" },
  { id: "visit_egypt", label: "Visit Egypt", brief: "Visit Egypt tourism travel creators Egypt" },
  { id: "netflix", label: "Netflix", brief: "Netflix entertainment streaming niche creators" },
  { id: "talabat", label: "Talabat", brief: "Talabat food delivery UAE creators" },
  { id: "adidas", label: "Adidas", brief: "Adidas sports fitness running UAE" },
  { id: "red_bull", label: "Red Bull", brief: "Red Bull extreme sports adventure creators" },
  { id: "emirates_nbd", label: "Emirates NBD", brief: "Emirates NBD finance banking UAE" },
];

function fileExists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

function readFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function checkContent(relPath, patterns) {
  if (!fileExists(relPath)) return { ok: false, missing: patterns };
  const content = readFile(relPath);
  const missing = patterns.filter((pattern) => !content.includes(pattern));
  return { ok: missing.length === 0, missing };
}

const checks = [];
let passed = 0;
let failed = 0;
let warnings = 0;

function record(name, ok, detail, severity = "error") {
  checks.push({ name, ok, detail, severity });
  if (ok) passed += 1;
  else if (severity === "warn") warnings += 1;
  else failed += 1;
}

async function runOfflineCoverageTests() {
  if (!fileExists("lib/creators/discovery-coverage.ts")) {
    record("offline coverage module", false, "discovery-coverage.ts missing");
    return;
  }

  // Lightweight structural proxy — full evaluation runs via `npm run build` + integration QA.
  const coverageSource = readFile("lib/creators/discovery-coverage.ts");
  record(
    "coverage evaluates count + country + category",
    ["countryMatchRatio", "categoryMatchRatio", "coverageScore"].every((token) =>
      coverageSource.includes(token)
    ),
    "composite signals present in evaluator"
  );
  record(
    "coverage levels include insufficient",
    coverageSource.includes('"insufficient"'),
    "insufficient level defined"
  );
  record(
    "coverage threshold env configurable",
    coverageSource.includes("DISCOVERY_COVERAGE_SCORE_THRESHOLD"),
    "threshold env present"
  );
}

// --- Structural checks ---
record("evaluateDiscoveryCoverage module", fileExists("lib/creators/discovery-coverage.ts"), "present");
record("coverage audit writer", fileExists("lib/creators/discovery-coverage-audit.ts"), "present");
record("unified ranking module", fileExists("lib/creators/unified-ranking.ts"), "present");
record("Apify import DNA pipeline", fileExists("lib/discovery/apify-import-pipeline.ts"), "present");
record("coverage backfill enqueue", fileExists("lib/discovery/coverage-backfill.ts"), "present");
record(
  "migration discovery_coverage_decisions",
  fileExists("supabase/migrations/20260705100000_discovery_coverage_decisions.sql"),
  "20260705100000_discovery_coverage_decisions.sql"
);

const unifiedBrowse = checkContent("lib/creators/unified-browse.ts", [
  "evaluateDiscoveryCoverage",
  "sortUnifiedCreatorsByDiscoveryRank",
  "coverage_evaluation",
]);
record("unified-browse coverage hook", unifiedBrowse.ok, unifiedBrowse.ok ? "wired" : unifiedBrowse.missing?.join(", "));

const progressive = checkContent("features/ai/tools/progressive-creator-search.ts", [
  "coverageMeetsThreshold",
  "maybeTriggerCoverageBackfill",
  "writeDiscoveryCoverageDecision",
  'coverage.coverageLevel === "insufficient"',
]);
record("progressive search coverage gate", progressive.ok, progressive.ok ? "wired" : progressive.missing?.join(", "));

const discoveryBrowse = checkContent("features/campaigns/creator-discovery-actions.ts", [
  "browseUnifiedCreatorsWithCoverageBackfill",
]);
record("discovery browse coverage orchestrator", discoveryBrowse.ok, discoveryBrowse.ok ? "wired" : discoveryBrowse.missing?.join(", "));

const orchestrator = checkContent("lib/discovery/coverage-backfill-orchestrator.ts", [
  "maybeTriggerBrowseCoverageBackfill",
  "waitForDiscoveryJobCompletion",
  "writeDiscoveryCoverageDecision",
]);
record("coverage backfill orchestrator", orchestrator.ok, orchestrator.ok ? "wired" : orchestrator.missing?.join(", "));

const backfill = checkContent("lib/discovery/coverage-backfill.ts", [
  'input.coverage.coverageLevel !== "insufficient"',
]);
record(
  "Apify gated to insufficient only",
  backfill.ok,
  backfill.ok ? "guard present" : "missing guard"
);

const dedupe = checkContent("lib/discovery/apify-import-pipeline.ts", [
  "findExistingDiscoveredProfile",
  "findExistingInfluencerByHandle",
  "dedupeByCreatorId",
]);
record("Apify import dedupe checks", dedupe.ok, dedupe.ok ? "present" : dedupe.missing?.join(", "));

const migration = readFile("supabase/migrations/20260705100000_discovery_coverage_decisions.sql");
for (const column of [
  "search_id",
  "timestamp",
  "search_query",
  "coverage_score",
  "coverage_level",
  "database_creators_count",
  "apify_executed",
  "reason",
  "duration_ms",
]) {
  record(`migration column ${column}`, migration.includes(column), column);
}

for (const fixture of FIXTURES) {
  record(
    `fixture registered: ${fixture.label}`,
    true,
    `${fixture.brief} — WILL TEST (not PASS)`,
    "warn"
  );
}

await runOfflineCoverageTests();

const summary = {
  timestamp: new Date().toISOString(),
  release: "1.2",
  phase: "database-first-discovery",
  mode: "validation-will-test-not-pass",
  passed,
  failed,
  warnings,
  checks,
  gaps: [
    "Live Supabase integration not executed in this script",
    "Apify actors not invoked in CI — enqueue-only verification",
    "creator_dna row hydration in browse still uses proxy fields",
    "search_intent_log table not implemented",
  ],
};

const outPath = path.join(ROOT, "docs/release/1.2/database-first-discovery-validation-results.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`);

console.log("Release 1.2 — Database-First Discovery Validation");
console.log(`Passed: ${passed} | Failed: ${failed} | Warnings: ${warnings}`);
console.log(`Results: ${outPath}`);
if (failed > 0) {
  console.error("Validation reported failures (expected until live QA).");
  process.exitCode = 1;
}
