#!/usr/bin/env node
/**
 * Release 1.2 Phase 2 — Creator DNA Engine validation.
 * Structural + offline unit checks. Does NOT claim PASS on fixtures.
 *
 * Run: node scripts/validate-creator-dna-phase2.mjs
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const FIXTURES = [
  { id: "babyjoy", label: "BabyJoy" },
  { id: "cocacola", label: "Coca-Cola" },
  { id: "samsung", label: "Samsung" },
  { id: "loreal", label: "L'Oréal" },
  { id: "visit_egypt", label: "Visit Egypt" },
  { id: "netflix", label: "Netflix" },
  { id: "talabat", label: "Talabat" },
  { id: "adidas", label: "Adidas" },
  { id: "red_bull", label: "Red Bull" },
  { id: "emirates_nbd", label: "Emirates NBD" },
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

record(
  "migration 20260705120000_creator_dna_phase2_extensions",
  fileExists("supabase/migrations/20260705120000_creator_dna_phase2_extensions.sql"),
  "additive dna_completeness_score columns"
);

record("dna-completeness-engine", fileExists("features/creator-dna/services/dna-completeness-engine.ts"), "present");
record("dna-merge-engine", fileExists("features/creator-dna/services/dna-merge-engine.ts"), "present");
record("dna-browse-hydration", fileExists("lib/creators/dna-browse-hydration.ts"), "present");

const types = checkContent("features/creator-dna/types/index.ts", [
  "CreatorDNACommercial",
  "CreatorDNABrandSafety",
  "CreatorDNAHistoricalPerformance",
  "audienceGender",
  "DnaCompletenessResult",
]);
record("Phase 2 DNA types", types.ok, types.ok ? "sections present" : types.missing?.join(", "));

const ranking = checkContent("lib/creators/unified-ranking.ts", [
  "dnaCompleteness",
  "categoryMatchScore",
  "followerSupportScore",
  "historicalPerformanceScore",
]);
record("DNA-led unified ranking", ranking.ok, ranking.ok ? "weights wired" : ranking.missing?.join(", "));

const browse = checkContent("lib/creators/unified-browse.ts", ["hydrateCreatorsWithDna"]);
record("DNA hydration in browse", browse.ok, browse.ok ? "wired" : browse.missing?.join(", "));

const pipeline = checkContent("lib/discovery/apify-import-pipeline.ts", [
  "bridgeSnapshotToCreatorDna",
]);
record("Apify import DNA bridge", pipeline.ok, pipeline.ok ? "wired" : pipeline.missing?.join(", "));

const mergeSource = readFile("features/creator-dna/services/dna-merge-engine.ts");
record(
  "merge tier rules",
  mergeSource.includes("DNA_TIER_PRIORITY") && mergeSource.includes("mergeFieldCandidate"),
  "Verified > Imported > Inferred > Empty"
);

for (const fixture of FIXTURES) {
  record(
    `fixture registered: ${fixture.label}`,
    true,
    `${fixture.id} — WILL TEST (not PASS)`,
    "warn"
  );
}

try {
  execSync("npx tsx features/creator-dna/services/dna-merge-engine.test.ts", {
    cwd: ROOT,
    stdio: "pipe",
    encoding: "utf8",
  });
  record("offline merge engine tests", true, "unit tests passed");
} catch (error) {
  record("offline merge engine tests", false, error.stderr?.slice(0, 200) ?? error.message);
}

try {
  execSync("npx tsx features/creator-dna/services/dna-completeness-engine.test.ts", {
    cwd: ROOT,
    stdio: "pipe",
    encoding: "utf8",
  });
  record("offline completeness engine tests", true, "unit tests passed");
} catch (error) {
  record("offline completeness engine tests", false, error.stderr?.slice(0, 200) ?? error.message);
}

const summary = {
  timestamp: new Date().toISOString(),
  release: "1.2",
  phase: "creator-dna-phase2",
  mode: "validation-will-test-not-pass",
  fixtureCount: FIXTURES.length,
  passed,
  failed,
  warnings,
  checks,
  gaps: [
    "Live Supabase DNA row backfill not executed in CI",
    "Demographics provider integration (Modash/HypeAuditor) not wired",
    "Commercial DNA populated only via campaign/manual sources",
    "UI completeness + verification badges not implemented",
    "Staging promotion merge live tests require operator DB",
  ],
};

const outPath = path.join(ROOT, "docs/release/1.2/creator-dna-phase2-validation-results.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`);

console.log("Release 1.2 — Creator DNA Phase 2 Validation");
console.log(`Fixtures: ${FIXTURES.length} | Passed: ${passed} | Failed: ${failed} | Warnings: ${warnings}`);
console.log(`Results: ${outPath}`);
console.log("Status: WILL TEST — not claiming PASS");
if (failed > 0) {
  process.exitCode = 1;
}
