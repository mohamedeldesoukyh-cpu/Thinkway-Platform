#!/usr/bin/env node
/**
 * Release 1.2 — Readiness audit (structural checks only).
 * Does NOT claim PASS on fixtures — verifies codebase hooks exist.
 *
 * Run: node scripts/validate-release-1-2-readiness.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs", "release", "1.2");

/** Release 1.2 validation fixtures — what future E2E WILL test (not PASS today). */
const FIXTURES = [
  { id: "babyjoy", label: "BabyJoy", phases: [1, 2, 3] },
  { id: "cocacola", label: "Coca-Cola", phases: [3, 5] },
  { id: "samsung", label: "Samsung", phases: [4, 6] },
  { id: "loreal", label: "L'Oréal", phases: [2, 3] },
  { id: "visit_egypt", label: "Visit Egypt", phases: [1, 3] },
  { id: "netflix", label: "Netflix", phases: [3, 7] },
  { id: "talabat", label: "Talabat", phases: [1, 5] },
  { id: "adidas", label: "Adidas", phases: [1, 2, 3] },
  { id: "red_bull", label: "Red Bull", phases: [4, 6] },
  { id: "emirates_nbd", label: "Emirates NBD", phases: [2, 5, 7] },
];

const REQUIRED_FILES = [
  { path: "lib/creators/unified-browse.ts", label: "Unified browse SSOT" },
  { path: "lib/creators/dedupe-creators.ts", label: "Creator dedupe module" },
  { path: "lib/creators/fts-search.ts", label: "FTS search / search_creators RPC client" },
  { path: "features/ai/tools/campaign-search-intent.ts", label: "Campaign NL intent parser" },
  { path: "features/ai/tools/progressive-creator-search.ts", label: "Progressive DB search" },
  { path: "features/creator-dna/types/index.ts", label: "Creator DNA types" },
  { path: "features/creator-dna/services/conflict-resolver.ts", label: "DNA conflict resolver" },
  { path: "features/creator-dna/writers/creator-dna-writer.ts", label: "DNA writer (IPL bridge)" },
  { path: "lib/creator-enrichment/service.ts", label: "Apify enrichment service" },
  { path: "lib/intelligence-persistence/index.ts", label: "IPL entry point" },
  { path: "lib/intelligence-persistence/adapters/apify-adapter.ts", label: "Apify IPL adapter" },
  { path: "features/ai-workflows/validate-creator-integrity.ts", label: "ERS-1 validator" },
  { path: "features/creator-dna/validate-ers4-creator-dna.ts", label: "ERS-4 DNA validator" },
  { path: "supabase/migrations/20260704120000_creator_dna.sql", label: "Creator DNA migration" },
  { path: "supabase/migrations/20260703150000_intelligence_persistence_layer.sql", label: "IPL migration" },
];

const REQUIRED_MIGRATION_TABLES = [
  { migration: "20260704120000_creator_dna.sql", tables: ["creator_dna", "creator_dna_staging", "creator_dna_versions", "creator_dna_lineage_events"] },
  { migration: "20260703150000_intelligence_persistence_layer.sql", tables: ["ipl_snapshots", "ipl_provider_runs", "ipl_refresh_policies"] },
  { migration: "20260611015000_discovery_engine.sql", tables: ["discovered_profiles", "profile_metrics"] },
];

/** Release 1.2 NEW tables — expected absent until implemented. */
const PLANNED_NEW_TABLES = [
  "client_profiles",
  "client_profile_versions",
  "campaign_learning",
  "campaign_learning_creator_outcomes",
  "influencer_metrics_history",
  "discovery_coverage_decisions",
  "search_intent_log",
];

const DOC_FILES = [
  "RELEASE_1_2_ARCHITECTURE.md",
  "DATABASE_FIRST_DISCOVERY.md",
  "CREATOR_DNA_SPECIFICATION.md",
  "SEARCH_ENGINE_SPECIFICATION.md",
  "CAMPAIGN_LEARNING_SPECIFICATION.md",
];

function fileExists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

function readFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function checkFileContent(relPath, patterns) {
  if (!fileExists(relPath)) return { ok: false, missing: patterns };
  const content = readFile(relPath);
  const missing = patterns.filter((p) => !content.includes(p));
  return { ok: missing.length === 0, missing };
}

const checks = [];
let passed = 0;
let failed = 0;
let warnings = 0;

function record(category, name, ok, detail, severity = "error") {
  checks.push({ category, name, ok, detail, severity });
  if (ok) passed += 1;
  else if (severity === "warn") warnings += 1;
  else failed += 1;
}

// --- Documentation ---
for (const doc of DOC_FILES) {
  const rel = `docs/release/1.2/${doc}`;
  record("docs", doc, fileExists(rel), fileExists(rel) ? "present" : "missing");
}

// --- Core modules ---
for (const { path: rel, label } of REQUIRED_FILES) {
  record("modules", label, fileExists(rel), rel);
}

// --- Migration table definitions ---
for (const { migration, tables } of REQUIRED_MIGRATION_TABLES) {
  const rel = `supabase/migrations/${migration}`;
  if (!fileExists(rel)) {
    record("migrations", migration, false, "migration file missing");
    continue;
  }
  const content = readFile(rel);
  for (const table of tables) {
    const pattern = `public.${table}`;
    record(
      "migrations",
      `${table} in ${migration}`,
      content.includes(pattern),
      content.includes(pattern) ? "defined" : `no reference to ${pattern}`
    );
  }
}

// --- DB-first hooks (partial — document gaps honestly) ---
const browseHooks = checkFileContent("lib/creators/unified-browse.ts", [
  "browseUnifiedCreators",
  "searchCreators",
  "dedupeByCreatorId",
]);
record(
  "db-first",
  "unified-browse uses FTS + dedupe",
  browseHooks.ok,
  browseHooks.ok ? "hooks present" : `missing: ${browseHooks.missing?.join(", ")}`
);

const progressiveHooks = checkFileContent("features/ai/tools/progressive-creator-search.ts", [
  "executeProgressiveCreatorSearch",
  "browseUnifiedCreators",
]);
record(
  "db-first",
  "progressive search calls browseUnifiedCreators",
  progressiveHooks.ok,
  progressiveHooks.ok ? "present" : "missing progressive hooks"
);

const hasCoverageGate = fileExists("lib/creators/discovery-coverage.ts");
record(
  "db-first",
  "evaluateDiscoveryCoverage module",
  hasCoverageGate,
  hasCoverageGate ? "present" : "NOT IMPLEMENTED — Phase 1 gap (expected)",
  hasCoverageGate ? "error" : "warn"
);

// --- DNA merge rules ---
const mergeRules = checkFileContent("features/creator-dna/services/conflict-resolver.ts", [
  "resolveConflicts",
  "compositeScore",
  "DNA_SOURCE_PRIORITY",
]);
record(
  "dna",
  "Conflict resolver with source priority",
  mergeRules.ok,
  mergeRules.ok ? "present" : `missing: ${mergeRules.missing?.join(", ")}`
);

// --- Planned NEW tables (should NOT exist in migrations yet) ---
const allMigrations = fs
  .readdirSync(path.join(ROOT, "supabase/migrations"))
  .filter((f) => f.endsWith(".sql"));
const migrationContent = allMigrations.map((f) => readFile(`supabase/migrations/${f}`)).join("\n");

for (const table of PLANNED_NEW_TABLES) {
  const exists = migrationContent.includes(`public.${table}`) || migrationContent.includes(`CREATE TABLE ${table}`);
  record(
    "planned-new",
    `${table} migration`,
    !exists,
    exists ? "already exists (ahead of spec)" : "not yet migrated (expected for pre-implementation)",
    exists ? "error" : "warn"
  );
}

// --- Historical metrics placeholder ---
const histPlaceholder = checkFileContent("lib/creators/historical-metrics.ts", [
  "Placeholder until influencer_metrics_history",
]);
record(
  "learning",
  "Internal historical metrics placeholder documented",
  histPlaceholder.ok,
  histPlaceholder.ok ? "gap documented in code" : "placeholder comment missing"
);

// --- Fixture registry ---
for (const fixture of FIXTURES) {
  record(
    "fixtures",
    `${fixture.label} registered for validation`,
    true,
    `phases: ${fixture.phases.join(", ")} — WILL TEST (not PASS)`,
    "warn"
  );
}

// --- Summary ---
const summary = {
  timestamp: new Date().toISOString(),
  release: "1.2",
  mode: "readiness-audit",
  note: "Structural checks only. Does not claim fixture PASS.",
  totals: { passed, failed, warnings, checks: checks.length },
  fixtures: FIXTURES,
  tableCounts: {
    existsOperationalDiscoveryIplDna: 28,
    proposedNew: PLANNED_NEW_TABLES.length,
  },
  recommendedPhase1Start:
    "Implement evaluateDiscoveryCoverage() + discovery_coverage_decisions in lib/creators/unified-browse.ts; wire Apify backfill enqueue in discovery-worker.",
  checks,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
const outJson = path.join(OUT_DIR, "release-1-2-readiness-results.json");
fs.writeFileSync(outJson, JSON.stringify(summary, null, 2));

console.log("\n=== Release 1.2 Readiness Audit ===\n");
console.log(`Checks: ${passed} passed, ${failed} failed, ${warnings} warnings (${checks.length} total)\n`);

for (const c of checks.filter((x) => !x.ok && x.severity === "error")) {
  console.log(`  FAIL  [${c.category}] ${c.name}: ${c.detail}`);
}
for (const c of checks.filter((x) => !x.ok && x.severity === "warn")) {
  console.log(`  WARN  [${c.category}] ${c.name}: ${c.detail}`);
}

console.log(`\nReport: ${path.relative(ROOT, outJson)}`);
console.log(`\nRecommended Phase 1 start: ${summary.recommendedPhase1Start}\n`);

process.exit(failed > 0 ? 1 : 0);
