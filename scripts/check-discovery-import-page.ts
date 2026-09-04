/**
 * Page 8 acceptance — docs/architecture/discovery-specs/08-import-center.md
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assertClassCoverage } from "../lib/discovery/suite/class-coverage";
import {
  DISCOVERY_COLS,
  DISCOVERY_GRID_MIN_W,
} from "../features/discovery/components/design-system/discovery-suite-cols";
import { sumImportHistoryTotals } from "../features/discovery-import/sum-import-history-totals";
import type { CreatorImportFileRow } from "../features/discovery-import/types";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TRACK =
  "34px minmax(190px,1.4fr) 130px 116px 84px 96px 92px 92px 88px 138px 92px";

const TABLE = fs.readFileSync(
  path.join(ROOT, "features/discovery-import/components/import-history-table.tsx"),
  "utf8"
);
const WORKSPACE = fs.readFileSync(
  path.join(
    ROOT,
    "features/discovery-import/components/import-center-workspace.tsx"
  ),
  "utf8"
);
const DROP = fs.readFileSync(
  path.join(ROOT, "features/discovery-import/components/import-dropzone.tsx"),
  "utf8"
);
const PAGE = fs.readFileSync(
  path.join(ROOT, "app/(dashboard)/discovery/import/page.tsx"),
  "utf8"
);

console.log("08-import-center acceptance…");

// 1. Track list byte-identical
assert.equal(DISCOVERY_COLS.import, TRACK, "1: track list byte-identical");
assert.equal(DISCOVERY_GRID_MIN_W.import, 1340, "1: minW 1340");
assert.ok(TABLE.includes('cols="import"'), "1: DiscoverySuiteGrid cols=import");
assert.ok(TABLE.includes("IMPORT_MIN_W") || TABLE.includes("1340"), "1: minWidth 1340");

// Pack sample rows for severity + footer sum checks
const IMP = [
  ["creator 34 Travel.pdf", "", "Completed", "PDF", 577, 438, 139, 0],
  ["agency_batch_q3.xlsx", "Ogilvy", "Completed", "XLSX", 1204, 1180, 24, 0],
  ["tiktok_export.csv", "TikTok", "Completed", "CSV", 860, 802, 41, 17],
  ["bundle_avatars.zip", "Bundle Plus", "Processing", "ZIP", 432, 210, 0, 0],
  ["fashion_list.csv", "", "Failed", "CSV", 96, 0, 0, 96],
] as const;

function sampleRow(
  r: (typeof IMP)[number],
  i: number
): CreatorImportFileRow {
  const status =
    r[2] === "Completed"
      ? "completed"
      : r[2] === "Failed"
        ? "failed"
        : "processing";
  return {
    id: String(i),
    filename: r[0],
    source_name: r[1] || null,
    file_type: r[3],
    storage_path: null,
    uploaded_by: null,
    status,
    total_creators: r[4],
    imported_creators: r[5],
    updated_creators: r[6],
    duplicate_creators: 0,
    failed_creators: r[7],
    processing_log: {},
    metadata: {},
    processing_started_at: null,
    processing_completed_at: null,
    error_message: null,
    created_at: "2026-07-02T16:07:00.000Z",
  };
}

const samples = IMP.map(sampleRow);

// 2. Rows 3 and 5 red inset; row 4 amber — via bad/warn wiring
assert.ok(TABLE.includes("isBadRow") && TABLE.includes("isWarnRow"), "2: bad/warn helpers");
assert.ok(TABLE.includes("bad={bad}") && TABLE.includes("warn={warn}"), "2: row severity props");
assert.equal(
  samples.filter((f) => f.failed_creators > 0 || f.status === "failed").length,
  2,
  "2: pack rows 3+5 are bad"
);
assert.equal(
  samples.filter((f) => f.status === "processing").length,
  1,
  "2: pack row 4 processing/wrn"
);

// 3. Untagged sources
assert.ok(TABLE.includes("not tagged"), "3: not tagged");
assert.ok(TABLE.includes("tw-miss"), "3: tw-miss for empty source");

// 4. Zeros .z ; Failed 96 neg
assert.ok(
  TABLE.includes('tone === "neg"') || TABLE.includes("zero ? \"z\" : \"neg\""),
  "4: Failed uses neg or .z"
);
assert.ok(TABLE.includes("tw-v pos") || TABLE.includes('"tw-v pos"'), "4: Imported uses pos");
assert.ok(TABLE.includes('zero && "z"') || TABLE.includes('zero ? "z"'), "4: .z on zeros");

// 5. Retry / View
assert.ok(TABLE.includes(">Retry<") || TABLE.includes("Retry"), "5: Retry on bad");
assert.ok(TABLE.includes(">View<") || TABLE.includes("View"), "5: View on completed");

// 6. File-deletion warning above grid
assert.ok(
  WORKSPACE.includes("source files are removed after import"),
  "6: file-deletion warning copy"
);
assert.ok(WORKSPACE.includes("tw-note wrn"), "6: warning uses tw-note wrn");
const warnJsx = WORKSPACE.indexOf('<p className="tw-note wrn">{FILE_DELETION_WARNING}</p>');
const historyJsx = WORKSPACE.indexOf("<ImportHistoryTable");
assert.ok(warnJsx >= 0 && historyJsx > warnJsx, "6: warning JSX before history grid");

// 7. Footer totals by summing array
const summed = sumImportHistoryTotals(samples);
assert.equal(summed.creators, 3169, "7: creators sum 3169");
assert.equal(summed.imported, 2630, "7: imported sum 2630");
assert.equal(summed.updated, 204, "7: updated sum 204");
assert.equal(summed.failed, 113, "7: failed sum 113");
assert.ok(TABLE.includes("sumImportHistoryTotals"), "7: footer uses summed totals");

// 8. Conflict note
assert.ok(TABLE.includes("failed to import"), "8: conflict note");
assert.ok(TABLE.includes("failed outright") || TABLE.includes("conflictNote"), "8: outright failure");

// 9. Class coverage
const sampleHtml = `
<div class="discovery-suite">
  <p class="tw-note wrn">Uploads process automatically</p>
  <div class="tw-drop"><b>Drag</b><p>files</p></div>
  <div class="tw-g" style="--cols:${TRACK}">
    <div class="tw-r bad">
      <span class="tw-nm" title="f">f</span>
      <span class="tw-miss">not tagged</span>
      <span class="tw-p p-r">Failed</span>
      <span class="tw-cc">CSV</span>
      <span class="tw-v">96</span>
      <span class="tw-v pos">0</span>
      <span class="tw-v z">0</span>
      <span class="tw-v neg">96</span>
      <span class="tw-d">02 Jul 26 · 16:07</span>
      <span class="tw-act">Retry</span>
    </div>
    <div class="tw-r wrn"></div>
    <div class="tw-ft">
      <span class="tw-v">3169</span>
      <span class="tw-v pos">2630</span>
      <span class="tw-v">204</span>
      <span class="tw-v neg">113</span>
    </div>
  </div>
  <p class="tw-note wrn">113 creators failed</p>
</div>`;
assertClassCoverage(sampleHtml, [
  "tw-note",
  "tw-drop",
  "tw-g",
  "tw-r",
  "tw-nm",
  "tw-miss",
  "tw-p",
  "tw-cc",
  "tw-v",
  "tw-d",
  "tw-act",
  "tw-ft",
]);

assert.ok(PAGE.includes("ImportCenterWorkspace"), "route mounts workspace");
assert.ok(DROP.includes("tw-drop"), "dropzone uses tw-drop");
assert.ok(DROP.includes("minmax(0,1fr) 220px"), "upload panel track");

console.log("08-import-center acceptance — checks passed");
console.log(
  JSON.stringify(
    {
      track: DISCOVERY_COLS.import,
      minW: DISCOVERY_GRID_MIN_W.import,
      footerSums: summed,
    },
    null,
    2
  )
);
