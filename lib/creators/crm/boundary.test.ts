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
  for (const path of [ensurePath, indexPath]) {
    const src = readFileSync(path, "utf8");
    assert.equal(src.includes("promote-profile"), false);
    assert.equal(src.includes("apify-import-pipeline"), false);
    assert.equal(src.includes("ensureCommercialCreatorFromApifyData"), false);
  }
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

test("no production call sites wire ensureCommercialCreator yet (Phase 1)", () => {
  const roots = ["lib", "features", "app"].map((d) => resolve(d));
  const hits: string[] = [];
  for (const root of roots) {
    for (const file of collectTsFiles(root)) {
      // Allow identity boundary docs and crm package itself (crm dirs skipped under lib/creators only).
      if (file.replace(/\\/g, "/").includes("/creators/crm/")) continue;
      if (file.replace(/\\/g, "/").includes("/creators/identity/")) continue;
      const src = readFileSync(file, "utf8");
      // Match CRM ensure only — not Apify's ensureCommercialCreatorFromApifyData (Phase 2 rename).
      if (/(?<![A-Za-z])ensureCommercialCreator(?![A-Za-z])/.test(src)) {
        hits.push(file);
      }
    }
  }
  assert.deepEqual(hits, [], `Unexpected Phase 1 wiring:\n${hits.join("\n")}`);
});
