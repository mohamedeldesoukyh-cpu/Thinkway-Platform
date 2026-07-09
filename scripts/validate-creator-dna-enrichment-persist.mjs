#!/usr/bin/env node
/**
 * Release 1.2 — Creator DNA enrichment persistence validation.
 * Static checks only — does NOT claim PASS.
 *
 * Run: node scripts/validate-creator-dna-enrichment-persist.mjs
 */
import { execSync } from "node:child_process";
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
  return { ok: missing.length === 0, missing };
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
  "migration creator_dna_ipl_grants",
  fileExists("supabase/migrations/20260705210000_creator_dna_ipl_grants.sql"),
  "GRANT authenticated + service_role on creator_dna + IPL tables"
);

record(
  "migration creator_dna_apify_persistence",
  fileExists("supabase/migrations/20260705200000_creator_dna_apify_persistence.sql"),
  "raw_apify_snapshot, enriched_at, apify_run_id columns"
);

const mapper = checkContent("features/creator-dna/services/apify-to-dna-mapper.ts", [
  "mapApifyToFieldCandidates",
  "content.recentPublications",
  "content.profileUrl",
  "identity.avatarUrl",
  "APIFY_DNA_FIELD_PATHS",
]);
record("apify-to-dna-mapper", mapper.ok, mapper.ok ? "full field mapping" : mapper.missing?.join(", "));

const enrichment = checkContent("lib/creator-enrichment/service.ts", [
  "deferDnaBridge: true",
  "await bridgeSnapshotToCreatorDna",
  "syncEnrichmentAvatarToStorage",
]);
record(
  "enrichment awaits DNA bridge",
  enrichment.ok,
  enrichment.ok ? "defer + await bridge after avatar" : enrichment.missing?.join(", ")
);

const snapshot = checkContent("lib/intelligence-persistence/services/snapshot-service.ts", [
  "await bridgeSnapshotToCreatorDna",
]);
record(
  "persistSnapshot awaits bridge",
  snapshot.ok && !readFile("lib/intelligence-persistence/services/snapshot-service.ts").includes("void import"),
  snapshot.ok ? "no fire-and-forget" : "bridge not awaited or still fire-and-forget"
);

const browse = checkContent("lib/creators/unified-browse.ts", ["hydrateCreatorsWithDna"]);
const browseNoApify = !readFile("lib/creators/unified-browse.ts").includes("fetchApifyProfile");
record(
  "browse DNA-first (no Apify on read)",
  browse.ok && browseNoApify,
  browseNoApify ? "hydrateCreatorsWithDna without Apify fetch" : "Apify call found in unified-browse"
);

const dnaBridge = checkContent("lib/intelligence-persistence/services/dna-bridge.ts", [
  "rawSnapshot: snapshot.raw",
  "avatarUrlOverride",
]);
record("dna-bridge passes raw snapshot", dnaBridge.ok, dnaBridge.ok ? "raw + avatar override" : dnaBridge.missing?.join(", "));

const service = checkContent("features/creator-dna/services/creator-dna-service.ts", [
  "raw_apify_snapshot",
  "enriched_at",
  "apify_run_id",
]);
record("creator-dna-service row persist", service.ok, service.ok ? "row-level Apify columns" : service.missing?.join(", "));

const hydration = checkContent("lib/creators/dna-browse-hydration.ts", [
  "document.content.recentPublications",
  "primaryAvatarUrl",
]);
record("DNA browse hydration overlays", hydration.ok, hydration.ok ? "content + avatar from DNA" : hydration.missing?.join(", "));

try {
  execSync("npx tsc --noEmit", { cwd: ROOT, stdio: "pipe", encoding: "utf8" });
  record("TypeScript compile", true, "npx tsc --noEmit");
} catch (error) {
  record("TypeScript compile", false, error.stderr?.slice(0, 300) ?? error.message);
}

console.log("\n=== Creator DNA Enrichment Persist Validation ===\n");
for (const check of checks) {
  console.log(`${check.ok ? "✓" : "✗"} ${check.name}: ${check.detail}`);
}
console.log(`\n${passed} passed, ${failed} failed — WILL TEST (not PASS)\n`);

process.exit(failed > 0 ? 1 : 0);
