import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";

import { IDENTITY_LIFECYCLE_BOUNDARY } from "@/lib/creators/identity/ensure-identity";

test("identity boundary constant documents CRM isolation", () => {
  assert.match(IDENTITY_LIFECYCLE_BOUNDARY, /must not activate Commercial Creator CRM/i);
});

test("CRM ensure module does not import Discovery promote or Apify pipeline", () => {
  const ensurePath = resolve("lib/creators/crm/ensure-commercial-creator.ts");
  const indexPath = resolve("lib/creators/crm/index.ts");
  const helpersPath = resolve("lib/creators/crm/activation-helpers.ts");
  for (const path of [ensurePath, indexPath, helpersPath]) {
    const src = readFileSync(path, "utf8");
    assert.equal(src.includes("promote-profile"), false);
    assert.equal(src.includes("apify-import-pipeline"), false);
    assert.equal(src.includes("ensureCommercialCreatorFromApifyData"), false);
  }
});

test("legacy Apify commercial name is removed from application TypeScript", () => {
  const roots = ["lib", "features", "app"].map((d) => resolve(d));
  const hits: string[] = [];
  for (const root of roots) {
    for (const file of collectTsFiles(root)) {
      const src = readFileSync(file, "utf8");
      if (src.includes("ensureCommercialCreatorFromApifyData")) {
        hits.push(file);
      }
    }
  }
  assert.deepEqual(hits, [], `Legacy name still present:\n${hits.join("\n")}`);
});

function collectTsFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "crm") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) collectTsFiles(full, out);
    else if (
      (name.endsWith(".ts") || name.endsWith(".tsx")) &&
      !name.endsWith(".test.ts") &&
      !name.endsWith(".test.tsx")
    ) {
      out.push(full);
    }
  }
  return out;
}

const PHASE2B_ALLOWED_ENSURE_PATHS = [
  "/creators/crm/",
  "/creators/identity/",
  "/campaigns/campaign-influencer-commercial.ts",
  "/campaigns/campaign-influencer-sync.ts",
  "/services/quotations/repositories/quotation-repository.ts",
  "/services/quotations/quotation-lifecycle-service.ts",
  "/discovery/shortlists/actions.ts",
  // Commercial CRM completion — Vendors module + Vendor IO
  "/vendors/actions.ts",
  "/io/generate-vendor-io-action.ts",
];

test("ensureCommercialCreator only wired at Phase 2B allowlisted call sites", () => {
  const roots = ["lib", "features", "app"].map((d) => resolve(d));
  const hits: string[] = [];
  for (const root of roots) {
    for (const file of collectTsFiles(root)) {
      const normalized = file.replace(/\\/g, "/");
      if (PHASE2B_ALLOWED_ENSURE_PATHS.some((p) => normalized.includes(p))) continue;
      const src = readFileSync(file, "utf8");
      if (/(?<![A-Za-z])ensureCommercialCreator(?![A-Za-z])/.test(src)) {
        hits.push(file);
      }
      if (src.includes("maybeActivateCommercialCreatorForAssignment")) {
        hits.push(file);
      }
    }
  }
  assert.deepEqual(hits, [], `Unexpected CRM wiring:\n${hits.join("\n")}`);
});
