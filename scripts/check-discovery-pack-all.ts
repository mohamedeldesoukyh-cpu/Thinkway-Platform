/**
 * One-command Discovery pack close-out:
 * 1) every page/foundation/overlay gate
 * 2) one class-coverage crawl across discovery.html (all pages + overlay chrome)
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  assertClassCoverage,
  twClassesInHtml,
} from "../lib/discovery/suite/class-coverage";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const GATES = [
  "test:discovery-foundation",
  "test:discovery-shortlists-page",
  "test:discovery-shortlist-detail",
  "test:discovery-shortlist-overlays",
  "test:discovery-quotations-page",
  "test:discovery-quotation-detail-4a",
  "test:discovery-quotation-detail-4b",
  "test:discovery-search-page",
  "test:discovery-intelligence-page",
  "test:discovery-campaign-match-page",
  "test:discovery-import-page",
] as const;

console.log("Discovery pack — running all gates in one process tree…\n");

const failed: string[] = [];
for (const script of GATES) {
  console.log(`▶ npm run ${script}`);
  const result = spawnSync("npm", ["run", script], {
    cwd: ROOT,
    encoding: "utf8",
    shell: true,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    failed.push(script);
    console.error(`✖ ${script} failed (exit ${result.status})`);
  } else {
    console.log(`✔ ${script}\n`);
  }
}

assert.equal(
  failed.length,
  0,
  `Pack gates failed: ${failed.join(", ") || "(none)"}`
);

console.log("Discovery pack — class-coverage crawl (pages + overlays)…");

const htmlPath = path.join(ROOT, "docs/architecture/discovery.html");
const html = fs.readFileSync(htmlPath, "utf8");
// Wrap so suite host class is present for any relative expectations.
const crawlHtml = `<div class="discovery-suite">${html}</div>`;
const coverage = assertClassCoverage(crawlHtml);
assert.equal(
  coverage.ok,
  true,
  `class-coverage missing: ${coverage.missing.join(", ")}`
);

const used = twClassesInHtml(crawlHtml);
const requiredOverlays = [
  "tw-selbar",
  "tw-note",
  "tw-drop",
  "tw-g",
  "tw-r",
  "tw-ft",
  "tw-ck",
  "tw-miss",
  "tw-v",
];
for (const cls of requiredOverlays) {
  assert.ok(used.has(cls), `crawl must see ${cls} from pack HTML`);
}

console.log(
  JSON.stringify(
    {
      gates: GATES.length,
      failed: 0,
      twClassesInCrawl: used.size,
      sampleMissing: coverage.missing,
    },
    null,
    2
  )
);
console.log("Discovery pack — ALL GREEN");
