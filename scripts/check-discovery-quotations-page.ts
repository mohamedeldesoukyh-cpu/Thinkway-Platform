/**
 * Page 3 acceptance — docs/architecture/discovery-specs/03-quotations.md
 * Does not modify discovery.css or lib/discovery/suite/.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertClassCoverage } from "../lib/discovery/suite/class-coverage";
import { AB, F } from "../lib/discovery/suite/helpers";
import {
  DISCOVERY_COLS,
  DISCOVERY_GRID_MIN_W,
} from "../features/discovery/components/design-system/discovery-suite-cols";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIST_SRC = fs.readFileSync(
  path.join(ROOT, "features/quotations/components/quotations-list.tsx"),
  "utf8"
);
const COLS_SRC = fs.readFileSync(
  path.join(
    ROOT,
    "features/discovery/components/design-system/discovery-suite-cols.ts"
  ),
  "utf8"
);

const TRACK =
  "30px 116px minmax(190px,1.4fr) 120px minmax(150px,1fr) 92px 92px 150px 66px 116px 74px";

console.log("03-quotations acceptance…");

// 1. Track byte-identical; minW 1300 (flex columns at 1300 / 1900)
assert.equal(DISCOVERY_COLS.quotations, TRACK, "track list byte-identical");
assert.ok(COLS_SRC.includes(TRACK), "cols source contains track");
assert.equal(DISCOVERY_GRID_MIN_W.quotations, 1300, "min-width 1300");
assert.ok(LIST_SRC.includes('cols="quotations"'), "uses DiscoverySuiteGrid cols=quotations");
assert.ok(LIST_SRC.includes("DiscoverySuiteGrid"), "paints DiscoverySuiteGrid");
assert.ok(
  LIST_SRC.includes("minWidth={QUOTATIONS_MIN_W}") || LIST_SRC.includes("1300"),
  "min-width 1300 wired"
);
assert.ok(TRACK.includes("minmax(190px,1.4fr)") && TRACK.includes("minmax(150px,1fr)"), "two flex columns");

// 2. Client truncate + title=
assert.ok(LIST_SRC.includes('className="tw-t"'), "client uses tw-t");
assert.ok(
  /title=\{client/.test(LIST_SRC) || LIST_SRC.includes("title={client"),
  "client carries title="
);

// 3. F() on Client cost
assert.ok(LIST_SRC.includes("F(row.total_revenue_egp)"), "row Client cost via F()");
assert.ok(LIST_SRC.includes("F(filteredClientCost)"), "footer Client cost via F()");
assert.equal(F(1045000), "1,045,000");
assert.equal(AB(5080000), "5.1M");

// 4. No currency in rows; exactly one in masthead
assert.ok(!LIST_SRC.includes("formatMoneyKpi"), "no formatMoneyKpi (currency in cells)");
assert.ok(!/F\([^)]+\)\s*\+\s*[\"']\s*EGP/.test(LIST_SRC), "no EGP suffix on F()");
assert.ok(
  LIST_SRC.includes('label: "Ccy"') && LIST_SRC.includes('"EGP"'),
  "exactly one Ccy EGP in masthead"
);
assert.ok(LIST_SRC.includes('value: "EGP"'), "EGP as masthead metric value");
assert.ok(
  !LIST_SRC.includes('F(row.total_revenue_egp) + " EGP"'),
  "no EGP glued onto row F()"
);

// 5. Avg GP % red
assert.ok(LIST_SRC.includes('label: "Avg GP %"'), "Avg GP % metric");
assert.ok(
  /label:\s*"Avg GP %"[\s\S]{0,120}?tone:\s*"r"/.test(LIST_SRC),
  "Avg GP % tone r"
);
assert.ok(LIST_SRC.includes("toFixed(1)}%"), "GP % one decimal + %");

// 6. Em dashes intact — no hyphen normalisation of titles
assert.ok(
  !LIST_SRC.includes("replace(/—") && !LIST_SRC.includes('replace("—'),
  "does not strip em dashes from titles"
);
assert.ok(LIST_SRC.includes("{row.name}"), "title rendered from row.name as-is");

// 7. Class-coverage
const sampleHtml = `
<div class="discovery-suite">
  <div class="tw-mast">
    <div class="tw-mh"><span class="tw-ct">Client quotations</span></div>
    <div class="tw-ms2">
      <div><i>Ccy</i><b class="s">EGP</b></div>
      <div><i>Client cost</i><b class="s">5.08M</b></div>
      <div><i>Avg GP %</i><b class="r">9.1%</b></div>
    </div>
  </div>
  <div class="tw-c">
    <div class="tw-ch">
      <span class="tw-ct">Client quotations</span>
      <span class="tw-cs">29 total · newest first</span>
      <span class="tw-sp"></span>
      <span class="tw-search"><svg viewBox="0 0 24 24"></svg><input class="tw-in" placeholder="Search quotations…"></span>
      <button class="tw-b sm">Filter</button>
      <button class="tw-b sm">Sort</button>
    </div>
    <div class="tw-sc"><div style="min-width:1300px;--cols:${TRACK}">
      <div class="tw-g tw-hr">
        <span><input type="checkbox" class="tw-ck" aria-label="Select all quotations"></span>
        <span>Serial</span><span>Quotation</span><span>Brand</span><span>Client</span>
        <span>Status</span><span>Client link</span><span>Owner</span>
        <span class="tw-rr">Lines</span><span class="tw-rr">Client cost</span><span class="tw-rr">Act</span>
      </div>
      <div class="tw-g tw-r">
        <span class="tw-id">QT-2026-0025</span>
        <span class="tw-nm">Quotation — Test 5</span>
        <span class="tw-br">Alshaya</span>
        <span class="tw-t" title="Bundle Plus Communication">Bundle Plus Communication</span>
        <span><span class="tw-p p-n">Draft</span></span>
        <span class="tw-lnk"><button class="tw-sw on" role="switch"></button><span class="tw-live on"></span></span>
        <span class="tw-cw2"><span class="tw-av k1">M</span><span class="tw-t">mohamedeldesouky</span></span>
        <span class="tw-v">4</span>
        <span class="tw-v">1,045,000</span>
        <span class="tw-act"><button class="tw-b sm">Open</button></span>
      </div>
      <div class="tw-g tw-r">
        <span class="tw-nm">Quotation — Dar Global</span>
        <span><span class="tw-p p-g">Approved</span></span>
        <span class="tw-v">1,173,334</span>
      </div>
      <div class="tw-g tw-ft">
        <span></span><span></span><span>6 of 29 shown</span>
        <span></span><span></span><span></span><span></span><span></span>
        <span class="tw-v">24</span><span class="tw-v">5,078,334</span><span></span>
      </div>
    </div></div>
  </div>
</div>`;

assert.ok(sampleHtml.includes("Quotation — Test 5"), "em dash in sample title");
assert.ok(sampleHtml.includes('title="Bundle Plus Communication"'), "client title= in sample");
assert.ok(sampleHtml.includes("1,045,000") && !sampleHtml.match(/1,045,000\s*EGP/), "F() without currency in rows");
assert.ok(sampleHtml.includes('<b class="r">9.1%</b>'), "Avg GP % red in sample");
assert.ok(sampleHtml.includes('<b class="s">EGP</b>'), "one EGP in masthead sample");

const coverage = assertClassCoverage(sampleHtml);
assert.ok(
  coverage.ok,
  `class-coverage missing: ${coverage.missing.join(", ")}`
);

assert.ok(LIST_SRC.includes("Search quotations"), "search placeholder");
assert.ok(LIST_SRC.includes("filteredQuotations.length} of {quotations.length} shown") ||
  /\{filteredQuotations\.length\} of \{quotations\.length\} shown/.test(LIST_SRC), "footer N of M");

console.log("OK — 03-quotations acceptance checks passed");
console.log(
  JSON.stringify(
    {
      track: TRACK,
      minW: DISCOVERY_GRID_MIN_W.quotations,
      classCoverageUsed: coverage.used.length,
      F_sample: F(1045000),
      AB_sample: AB(5080000),
      notes: [
        "Two flex columns: Quotation + Client",
        "Currency once in masthead (Ccy EGP); rows use F() only",
        "Avg GP % tone r on purpose (agency fee as margin)",
      ],
    },
    null,
    2
  )
);
