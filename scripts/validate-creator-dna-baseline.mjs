#!/usr/bin/env node
/**
 * Phase 3 — Creator DNA Baseline validation.
 * Requires Phase 2 coverage report before running.
 *
 * Run:
 *   npm run validate:creator-dna-baseline
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const REPORT_JSON = "docs/release/1.2/creator-dna-baseline-coverage-report.json";
const CHECKPOINT = "docs/release/1.2/creator-dna-baseline-checkpoint.json";

const NO_APIFY_PATTERNS = [
  "features/creator-dna/services/baseline-dna-mapper.ts",
  "features/creator-dna/services/baseline-dna-populator.ts",
  "scripts/backfill-creator-dna-baseline.ts",
];

const checks = [];
let passed = 0;
let failed = 0;

function record(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  if (ok) passed += 1;
  else failed += 1;
}

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function fileExists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

record(
  "Phase 2 coverage report exists",
  fileExists(REPORT_JSON),
  REPORT_JSON
);

let report = null;
if (fileExists(REPORT_JSON)) {
  try {
    report = JSON.parse(read(REPORT_JSON));
    record("Coverage report is valid JSON", true);
  } catch (error) {
    record("Coverage report is valid JSON", false, String(error));
  }
}

if (report?.totals) {
  const { creators, dnaDocuments, missingDna, averageCompleteness } = report.totals;
  record(
    "Every creator has one DNA document",
    creators === dnaDocuments && missingDna === 0,
    `creators=${creators} dna=${dnaDocuments} missing=${missingDna}`
  );
  record(
    "Average completeness reported",
    Number.isFinite(averageCompleteness),
    `average=${averageCompleteness}`
  );
  record(
    "Completeness distribution present",
    report.completenessDistribution != null,
    Object.keys(report.completenessDistribution ?? {}).join(", ")
  );
  record(
    "Platform breakdown present",
    report.platformBreakdown != null && Object.keys(report.platformBreakdown).length > 0,
    `platforms=${Object.keys(report.platformBreakdown ?? {}).length}`
  );
  record(
    "Top missing fields reported",
    Array.isArray(report.topMissingFields) && report.topMissingFields.length > 0,
    `fields=${report.topMissingFields?.length ?? 0}`
  );
  record(
    "Backfill created vs merged counts recorded",
    Number.isFinite(report.totals.createdDuringBackfill) &&
      Number.isFinite(report.totals.mergedDuringBackfill),
    `created=${report.totals.createdDuringBackfill} merged=${report.totals.mergedDuringBackfill}`
  );
}

record(
  "Checkpoint cleared after successful backfill",
  !fileExists(CHECKPOINT) || read(CHECKPOINT).trim().length === 0,
  CHECKPOINT
);

for (const relPath of NO_APIFY_PATTERNS) {
  if (!fileExists(relPath)) {
    record(`No Apify in ${relPath}`, false, "file missing");
    continue;
  }
  const content = read(relPath);
  const hasApifyClient =
    /fetchProfileWithIpl|apify-client|runActor|APIFY_TOKEN/i.test(content) &&
    !content.includes("no Apify");
  record(`No Apify calls in ${relPath}`, !hasApifyClient);
}

record(
  "mergeEvidence is sole canonical write path",
  read("features/creator-dna/services/creator-dna-service.ts").includes("mergeEvidence") &&
    read("features/creator-dna/services/baseline-dna-populator.ts").includes("mergeEvidence"),
  "baseline → mergeEvidence"
);

record(
  "updateField delegates to mergeEvidence",
  /async updateField[\s\S]*mergeEvidence/.test(
    read("features/creator-dna/services/creator-dna-service.ts")
  )
);

record(
  "Mandatory baseline hooks present",
  [
    "features/vendors/actions.ts",
    "lib/discovery/promote-profile.ts",
    "lib/discovery/add-creator-by-profile-url.ts",
    "lib/discovery-import/upsert.ts",
  ].every((file) => read(file).includes("CreatorBaselineDna")),
  "requireCreatorBaselineDna / ensureCreatorBaselineDna"
);

record(
  "Lifecycle + sources metadata types",
  read("features/creator-dna/types/index.ts").includes("sources:") &&
    read("features/creator-dna/types/index.ts").includes("CreatorDnaLifecycle")
);

record(
  "lastIntelligenceUpdate metadata",
  read("features/creator-dna/types/index.ts").includes("lastIntelligenceUpdate")
);

try {
  execSync("npx tsx features/creator-dna/services/dna-lifecycle.test.ts", {
    cwd: ROOT,
    stdio: "pipe",
  });
  record("dna-lifecycle unit tests", true);
} catch (error) {
  record(
    "dna-lifecycle unit tests",
    false,
    error instanceof Error ? error.message : String(error)
  );
}

try {
  execSync("npx tsx features/creator-dna/services/dna-merge-engine.test.ts", {
    cwd: ROOT,
    stdio: "pipe",
  });
  record("dna-merge-engine never-downgrade tests", true);
} catch (error) {
  record(
    "dna-merge-engine never-downgrade tests",
    false,
    error instanceof Error ? error.message : String(error)
  );
}

const resultsPath = path.join(
  ROOT,
  "docs/release/1.2/creator-dna-baseline-validation-results.json"
);
const payload = {
  timestamp: new Date().toISOString(),
  phase: "creator-dna-baseline",
  sprintComplete: failed === 0,
  passed,
  failed,
  checks,
  coverageReport: report,
};

fs.mkdirSync(path.dirname(resultsPath), { recursive: true });
fs.writeFileSync(resultsPath, JSON.stringify(payload, null, 2), "utf8");

console.log("Creator DNA Baseline — Phase 3 Validation");
console.log(`Passed: ${passed}  Failed: ${failed}`);
for (const check of checks) {
  console.log(`${check.ok ? "✓" : "✗"} ${check.name}${check.detail ? ` — ${check.detail}` : ""}`);
}
console.log(`Results → ${resultsPath}`);

if (failed > 0) {
  console.error("\nValidation FAILED — sprint not complete.");
  process.exit(1);
}

console.log("\nValidation PASSED — Creator DNA Baseline Sprint complete.");
process.exit(0);
