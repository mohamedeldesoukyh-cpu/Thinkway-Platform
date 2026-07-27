import { strict as assert } from "node:assert";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

const ROOT = join(process.cwd());

/** Production modules allowed to call the unchecked schedule apply. */
const UNCHECKED_ALLOWLIST = new Set([
  "features/campaign-outputs/media-plan-schedule.ts",
  "features/campaign-outputs/media-plan-mutations.ts",
]);

/** Production modules allowed to assign mediaPlanSchedule on CampaignObject meta. */
const DIRECT_ASSIGN_ALLOWLIST = new Set([
  "features/campaign-outputs/media-plan-schedule.ts",
  "features/campaign-outputs/media-plan-mutations.ts",
  // Hydration merge of candidates — not a user schedule edit.
  "features/campaign-studio/services/resolve-campaign-object-for-edit.ts",
]);

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (
      entry === "node_modules" ||
      entry === ".git" ||
      entry === ".next" ||
      entry === "dist" ||
      entry === "coverage"
    ) {
      continue;
    }
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
      files.push(full);
    }
  }
  return files;
}

test("no production code calls applyMediaPlanScheduleChangeUnchecked outside the engine bridge", () => {
  const offenders: string[] = [];
  for (const file of walk(ROOT)) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    if (UNCHECKED_ALLOWLIST.has(rel)) continue;
    const source = readFileSync(file, "utf8");
    if (source.includes("applyMediaPlanScheduleChangeUnchecked")) {
      offenders.push(rel);
    }
  }
  assert.deepEqual(offenders, [], `Unexpected unchecked callers:\n${offenders.join("\n")}`);
});

test("no production code assigns mediaPlanSchedule outside allowlisted engine paths", () => {
  const pattern = /mediaPlanSchedule\s*=/;
  const offenders: string[] = [];
  for (const file of walk(ROOT)) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    if (DIRECT_ASSIGN_ALLOWLIST.has(rel)) continue;
    if (rel.startsWith("docs/")) continue;
    const source = readFileSync(file, "utf8");
    if (pattern.test(source)) {
      offenders.push(rel);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `Direct mediaPlanSchedule assignments remain:\n${offenders.join("\n")}`
  );
});

test("legacy applyMediaPlanScheduleChange is not imported from media-plan-schedule in production", () => {
  const offenders: string[] = [];
  const importPattern =
    /applyMediaPlanScheduleChange[^U].*from\s+["'][^"']*media-plan-schedule["']|from\s+["'][^"']*media-plan-schedule["'][^;]*applyMediaPlanScheduleChange/;
  for (const file of walk(ROOT)) {
    const rel = relative(ROOT, file).replace(/\\/g, "/");
    if (rel.endsWith("media-plan-schedule.ts") || rel.endsWith("media-plan-mutations.ts")) continue;
    const source = readFileSync(file, "utf8");
    if (
      source.includes('from "@/features/campaign-outputs/media-plan-schedule"') &&
      source.includes("applyMediaPlanScheduleChange")
    ) {
      offenders.push(rel);
    }
    if (importPattern.test(source)) {
      offenders.push(rel);
    }
  }
  assert.deepEqual(offenders, [], `Legacy schedule imports remain:\n${offenders.join("\n")}`);
});
