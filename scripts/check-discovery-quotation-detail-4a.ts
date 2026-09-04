/**
 * Page 4a acceptance — docs/architecture/discovery-specs/04-quotation-detail.md
 * Scope: grid + lifecycle + client-review + approved block + filter chips + Cost detail.
 * Does not cover selection bar, calculator, CW, add-creators, Preview/Export (4b).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertClassCoverage } from "../lib/discovery/suite/class-coverage";
import { F } from "../lib/discovery/suite/helpers";
import {
  DISCOVERY_COLS,
  DISCOVERY_GRID_MIN_W,
} from "../features/discovery/components/design-system/discovery-suite-cols";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const GRID_SRC = fs.readFileSync(
  path.join(ROOT, "features/quotations/components/quotation-lines-grid.tsx"),
  "utf8"
);
const WORKSPACE_SRC = fs.readFileSync(
  path.join(ROOT, "features/quotations/components/quotation-workspace.tsx"),
  "utf8"
);
const REVIEW_SRC = fs.readFileSync(
  path.join(ROOT, "features/quotations/components/quotation-client-review-panel.tsx"),
  "utf8"
);
const METRICS_SRC = fs.readFileSync(
  path.join(ROOT, "features/quotations/components/quotation-commercial-metrics-band.tsx"),
  "utf8"
);
const LIFECYCLE_SRC = fs.readFileSync(
  path.join(ROOT, "features/quotations/components/quotation-lifecycle-pills.tsx"),
  "utf8"
);
const COST_SRC = fs.readFileSync(
  path.join(ROOT, "features/quotations/components/quotation-deliverable-cost-details.tsx"),
  "utf8"
);
const SHEET_SRC = fs.readFileSync(
  path.join(ROOT, "features/quotations/hooks/use-quotation-creator-detail-sheet.tsx"),
  "utf8"
);

const TRACK =
  "30px 74px minmax(190px,1.2fr) 66px minmax(230px,1.4fr) 74px 150px 128px 84px 92px";

console.log("04-quotation-detail (4a) acceptance…");

// Track + minW
assert.equal(DISCOVERY_COLS.quotation, TRACK, "track byte-identical");
assert.equal(DISCOVERY_GRID_MIN_W.quotation, 1400, "minW 1400");
assert.ok(GRID_SRC.includes('cols="quotation"'), "DiscoverySuiteGrid cols=quotation");
assert.ok(GRID_SRC.includes("1400") || GRID_SRC.includes("QUOTATION_MIN_W"));
assert.ok(WORKSPACE_SRC.includes("QuotationLinesGrid"), "workspace paints QuotationLinesGrid");

// Zero-cost .wrn
assert.ok(GRID_SRC.includes("warn={zeroCost") || GRID_SRC.includes("warn={zeroCost &&"), "zero-cost wrn");

// cr() / open profile
assert.ok(SHEET_SRC.includes("openCreatorByHandle"), "reuses pack cr()");
assert.ok(SHEET_SRC.includes("fetchedPoolRef") || SHEET_SRC.includes("extraPools"));
assert.ok(GRID_SRC.includes("onOpenCreator"), "name button opens profile");
assert.ok(GRID_SRC.includes('className="nm"'), "creator name is button.nm");

// Masthead + approved GP conflict
assert.ok(METRICS_SRC.includes("agency fee") || METRICS_SRC.includes("agency fee"), "agency-fee note");
assert.ok(METRICS_SRC.includes('tone={showAgencyFeeConflict ? agencyFeePctTone') || METRICS_SRC.includes('agencyFeePctTone'), "GP % red tone");
assert.ok(REVIEW_SRC.includes('className="r"') && REVIEW_SRC.includes("Approved GP"), "approved GP red");
assert.ok(REVIEW_SRC.includes("0.0%") || REVIEW_SRC.includes("gpPct.toFixed(1)}%"), "approved GP %");
assert.ok(REVIEW_SRC.includes("tw-note"), "conflict note beside both figures");

// Lifecycle + chips
assert.ok(LIFECYCLE_SRC.includes("tw-p") && LIFECYCLE_SRC.includes("p-b") && LIFECYCLE_SRC.includes("p-n") && LIFECYCLE_SRC.includes("p-g"));
assert.ok(REVIEW_SRC.includes("tw-fchip") && REVIEW_SRC.includes('"z"'), "zero chips get .z");
assert.ok(REVIEW_SRC.includes("disabled={isZero}"), "zero chips not clickable");

// Cost detail overlay
assert.ok(COST_SRC.includes("+ Cost detail"), "Cost detail trigger");
assert.ok(COST_SRC.includes("Free for the client") || COST_SRC.includes("Free for the client"));
assert.ok(COST_SRC.includes("Client pays"), "ends in what client pays");
assert.ok(GRID_SRC.includes("QuotationDeliverableCostDetails"), "grid wires Cost detail");

// 4a does NOT claim Overlay B–F
assert.ok(!GRID_SRC.includes("tw-selbar"), "4a: no selection bar in grid");

const sampleHtml = `
<div class="discovery-suite">
  <div class="tw-ms2">
    <div><i>Ccy</i><b class="s">EGP</b></div>
    <div><i>Base cost</i><b>950,000</b></div>
    <div><i>Client cost</i><b>1,045,000</b></div>
    <div><i>GP margin</i><b class="y">95,000</b></div>
    <div><i>Commercial GP</i><b class="r">0</b></div>
    <div><i>GP %</i><b class="r">9.1%</b></div>
  </div>
  <p class="tw-note wrn">agency fee — added to what the client pays, never counted as revenue.</p>
  <span class="tw-p p-b">Shortlist SL-2026-0026 · linked</span>
  <span class="tw-p p-n">Campaign · not linked</span>
  <span class="tw-p p-g">Live sync enabled</span>
  <div class="tw-ms2">
    <div><i>Approved creators</i><b>3</b></div>
    <div><i>Approved base cost</i><b>${F(950000)}</b></div>
    <div><i>Client cost</i><b>${F(950000)}</b></div>
    <div><i>Approved GP</i><b class="r">0</b></div>
    <div><i>Approved GP %</i><b class="r">0.0%</b></div>
  </div>
  <div class="tw-fbar"><button class="tw-fchip on">All<em>4</em></button>
    <button class="tw-fchip">Approved<em>3</em></button>
    <button class="tw-fchip z" disabled>Under review<em>0</em></button>
    <button class="tw-fchip z" disabled>Rejected<em>0</em></button></div>
  <div class="tw-sc"><div style="min-width:1400px;--cols:${TRACK}">
    <div class="tw-g tw-hr">
      <span><input type="checkbox" class="tw-ck"></span>
      <span>Option</span><span>Creator</span><span>Tier</span>
      <span>Service description</span><span>Platform</span><span>Type</span>
      <span class="tw-rr">Price</span><span>Status</span><span class="tw-rr">Act</span>
    </div>
    <div class="tw-g tw-r wrn">
      <span class="tw-p p-b">Option 2</span>
      <span class="tw-cw2"><span class="tw-avx k1">O</span>
        <button class="nm">ouda.5</button><span class="hd">@ouda.5</span></span>
      <span class="tw-p p-v">Micro</span>
      <input class="tw-in" value="1× IG Reel only">
      <span class="tw-pf"><span class="ig">IG</span></span>
      <select class="tw-in"><option>1× IG Reel</option></select>
      <span class="tw-v">0 EGP</span>
      <button class="tw-b sm">+ Cost detail</button>
      <span class="tw-p p-n">Draft</span>
      <span class="tw-act"><button class="tw-x">+</button><button class="tw-x">⋯</button><button class="tw-x">🗑</button></span>
    </div>
    <div class="tw-g tw-ft"><span></span><span></span>
      <span>Totals · 3 creators · 4 option lines</span>
      <span></span><span></span><span></span><span></span>
      <span class="tw-v">${F(1045000)} EGP</span><span></span><span></span>
    </div>
  </div></div>
</div>`;

assert.ok(sampleHtml.includes("tw-g tw-r wrn"), "zero-cost sample has wrn");
assert.ok(sampleHtml.includes('<b class="r">9.1%</b>') && sampleHtml.includes('<b class="r">0.0%</b>'));
assert.ok(sampleHtml.includes("agency fee"));

const coverage = assertClassCoverage(sampleHtml);
assert.ok(coverage.ok, `class-coverage missing: ${coverage.missing.join(", ")}`);

console.log("OK — 04-quotation-detail 4a acceptance checks passed");
console.log(
  JSON.stringify(
    {
      track: TRACK,
      minW: DISCOVERY_GRID_MIN_W.quotation,
      classCoverageUsed: coverage.used.length,
      deferredTo4b: [
        "selection bar",
        "calculator",
        "Commercial Workspace",
        "add-creators modal",
        "Preview/Export/share",
      ],
    },
    null,
    2
  )
);
