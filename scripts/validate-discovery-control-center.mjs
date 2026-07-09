#!/usr/bin/env node
/**
 * Release 1.2 — Discovery Control Center validation.
 * Structural + offline policy checks. Does NOT claim PASS.
 *
 * Run: node scripts/validate-discovery-control-center.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

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
  return { ok: missing.length === 0, missing, content };
}

const checks = [];
let passed = 0;
let failed = 0;

function record(name, ok, detail) {
  checks.push({ name, ok, detail });
  if (ok) passed += 1;
  else failed += 1;
}

record(
  "migration discovery_control_settings",
  fileExists("supabase/migrations/20260705140000_discovery_control_settings.sql"),
  "20260705140000_discovery_control_settings.sql"
);

record("control-center types", fileExists("lib/discovery/control-center/discovery-control-types.ts"), "present");
record("control-center service", fileExists("lib/discovery/control-center/discovery-control-service.ts"), "present");
record("control-center policy", fileExists("lib/discovery/control-center/discovery-control-policy.ts"), "present");

const service = checkContent("lib/discovery/control-center/discovery-control-service.ts", [
  "getDefaultDiscoveryControlSettings",
  "getDiscoveryControlSettings",
  "updateDiscoveryControlSettings",
]);
record("service SSOT exports", service.ok, service.ok ? "get/update/settings" : service.missing?.join(", "));

const policy = readFile("lib/discovery/control-center/discovery-control-policy.ts");
record(
  "platform_database_only blocks Apify",
  policy.includes("platform_database_only") && policy.includes("return false"),
  "shouldCallApify respects database-only"
);
record(
  "apify_live_only enables Apify",
  policy.includes("apify_live_only") && policy.includes("return true"),
  "shouldCallApify live mode"
);
record(
  "hybrid threshold gate",
  (policy.includes("evaluateEnterpriseDiscoveryBackfillNeed") ||
    fileExists("lib/discovery/enterprise-discovery-gate.ts")) &&
    readFile("lib/discovery/enterprise-discovery-gate.ts").includes("coverageThreshold"),
  "enterprise discovery gate (creator count first)"
);

const defaults = readFile("lib/discovery/control-center/discovery-control-service.ts");
record(
  "default hybrid + threshold 80",
  defaults.includes('"hybrid"') && defaults.includes("80"),
  "defaults match Release 1.2 hybrid"
);

const browse = checkContent("lib/creators/unified-browse.ts", [
  "getDiscoveryControlSettings",
  "applyPolicyToBrowse",
  "applyDataFreshnessFlags",
]);
record("unified-browse wired to control center", browse.ok, browse.ok ? "wired" : browse.missing?.join(", "));

const progressive = checkContent("features/ai/tools/progressive-creator-search.ts", [
  "getDiscoveryControlSettings",
]);
record("progressive search wired", progressive.ok, progressive.ok ? "wired" : progressive.missing?.join(", "));

const backfill = checkContent("lib/discovery/coverage-backfill.ts", [
  "getDiscoveryControlSettings",
  "gateApifyBackfill",
  "platform_database_only",
]);
record("coverage backfill wired", backfill.ok, backfill.ok ? "wired" : backfill.missing?.join(", "));

const singleServiceGrep = [
  "lib/creators/unified-browse.ts",
  "features/ai/tools/progressive-creator-search.ts",
  "lib/discovery/coverage-backfill.ts",
  "lib/discovery/coverage-backfill-orchestrator.ts",
].every((file) => readFile(file).includes("getDiscoveryControlSettings") || readFile(file).includes("getCachedDiscoveryControlSettings"));
record("single config service used by browse + backfill paths", singleServiceGrep, "getDiscoveryControlSettings references");

const settingsUi = fileExists("app/(dashboard)/settings/discovery-engine/page.tsx");
const diagnosticsUi = fileExists("app/(dashboard)/settings/discovery-diagnostics/page.tsx");
record("discovery engine settings page", settingsUi, "/settings/discovery-engine");
record("discovery diagnostics page", diagnosticsUi, "/settings/discovery-diagnostics");

const doc = fileExists("docs/release/1.2/DISCOVERY_CONTROL_CENTER.md");
record("architecture documentation", doc, "DISCOVERY_CONTROL_CENTER.md");

const summary = {
  release: "1.2",
  feature: "discovery-control-center",
  passed,
  failed,
  total: passed + failed,
  status: failed === 0 ? "STRUCTURAL_OK" : "STRUCTURAL_GAPS",
  note: "Does NOT claim PASS — run npm run build and manual QA.",
  checks,
};

const outPath = path.join(ROOT, "docs/release/1.2/discovery-control-center-validation-results.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));

console.log("Discovery Control Center validation");
console.log(`  passed: ${passed}`);
console.log(`  failed: ${failed}`);
console.log(`  results: ${outPath}`);
if (failed > 0) {
  for (const check of checks.filter((entry) => !entry.ok)) {
    console.log(`  FAIL: ${check.name} — ${check.detail}`);
  }
  process.exitCode = 1;
}
