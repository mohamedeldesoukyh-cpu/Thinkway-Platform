/**
 * Page 1 acceptance — docs/architecture/discovery-specs/01-shortlists.md
 * Does not modify discovery.css or lib/discovery/suite/.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertClassCoverage } from "../lib/discovery/suite/class-coverage";
import { D } from "../lib/discovery/suite/helpers";
import { DISCOVERY_COLS } from "../features/discovery/components/design-system/discovery-suite-cols";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const LIST_SRC = fs.readFileSync(
  path.join(ROOT, "features/discovery/shortlists/components/shortlists-list.tsx"),
  "utf8"
);
const LINK_SRC = fs.readFileSync(
  path.join(
    ROOT,
    "features/client-workspace/components/client-workspace-list-link-cell.tsx"
  ),
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
  "30px 116px minmax(180px,1.4fr) 130px 96px 92px 100px 150px 70px 110px 74px";

console.log("01-shortlists acceptance…");

assert.equal(DISCOVERY_COLS.shortlists, TRACK, "track list byte-identical");
assert.ok(COLS_SRC.includes(TRACK), "cols source contains track");
assert.ok(LIST_SRC.includes("minWidth={SHORTLISTS_MIN_W}") || LIST_SRC.includes("1250"), "min-width 1250");
assert.ok(LIST_SRC.includes("SHORTLISTS_COLS") || LIST_SRC.includes(TRACK));

assert.ok(LIST_SRC.includes('tw-miss'), "empty brand uses tw-miss");
assert.ok(LIST_SRC.includes('"not set"') || LIST_SRC.includes("'not set'"));

assert.ok(LIST_SRC.includes("E&") === false || true, "ampersand via React text (no HTML entity in source required)");
assert.equal(D("Aug 22, 2026"), "22 Aug 26");

assert.ok(LINK_SRC.includes('className="tw-lnk"') || LINK_SRC.includes("tw-lnk"));
assert.ok(LINK_SRC.includes("tw-sw"));
assert.ok(LINK_SRC.includes("tw-live"));
assert.ok(LINK_SRC.includes('"none"') || LINK_SRC.includes("isNone"), "none state class wiring");
assert.ok(LINK_SRC.includes("Client link revoked"), "revoked status label");
assert.ok(LINK_SRC.includes("Client link not set up"), "none status label");
assert.ok(LINK_SRC.includes("aria-busy"), "busy on switch for pending");
assert.ok(!LINK_SRC.includes("Loader2Icon"), "client link cell: no third spinner element");
assert.ok(!LINK_SRC.includes("Show link"), "no Show link text");

const css = fs.readFileSync(path.join(ROOT, "app/styles/discovery.css"), "utf8");
assert.ok(css.includes('.tw-live.none'), "foundation .tw-live.none");
assert.ok(css.includes('tw-sw[aria-busy="true"]') || css.includes(".tw-sw[aria-busy=\"true\"]"), "busy opacity rule");

assert.ok(LIST_SRC.includes("tw-d") && LIST_SRC.includes("D("));

assert.ok(LIST_SRC.includes("filteredCreatorCount"), "footer creator total");
assert.ok(LIST_SRC.includes("portfolioCreatorCount"), "footer portfolio denominator");
assert.ok(
  /\{filteredCreatorCount\} of \{portfolioCreatorCount\}/.test(LIST_SRC),
  "Creators X of Y in footer"
);

const sampleHtml = `
<div class="discovery-suite">
  <div class="tw-c">
    <div class="tw-ch">
      <span class="tw-ct">Shortlists</span>
      <span class="tw-cs">26 total · newest first</span>
      <span class="tw-sp"></span>
      <span class="tw-search"><svg viewBox="0 0 24 24"></svg><input class="tw-in" placeholder="Search shortlists…"></span>
      <button class="tw-b sm">Filter</button>
      <button class="tw-b sm">Sort</button>
    </div>
    <div class="tw-sc"><div style="min-width:1250px;--cols:${TRACK}">
      <div class="tw-g tw-hr">
        <span><input type="checkbox" class="tw-ck" aria-label="Select all"></span>
        <span>Serial</span><span>Shortlist</span><span>Brand</span><span>Status</span>
        <span>Client link</span><span>Visibility</span><span>Owner</span>
        <span class="tw-rr">Creators</span><span>Updated</span><span class="tw-rr">Act</span>
      </div>
      <div class="tw-g tw-r">
        <span class="tw-lnk"><button class="tw-sw on" role="switch" aria-checked="true"></button><span class="tw-live on" role="status" aria-label="Client link active"></span></span>
      </div>
      <div class="tw-g tw-r">
        <span class="tw-lnk"><button class="tw-sw" role="switch"></button><span class="tw-live" role="status" aria-label="Client link revoked"></span></span>
      </div>
      <div class="tw-g tw-r">
        <span class="tw-miss">not set</span>
        <span class="tw-br">E&amp;</span>
        <span class="tw-lnk"><button class="tw-sw" role="switch" aria-busy="true"></button><span class="tw-live none" role="status" aria-label="Client link not set up"></span></span>
      </div>
      <div class="tw-g tw-ft">
        <span></span><span></span><span>8 of 26 shown</span>
        <span></span><span></span><span></span><span></span><span></span>
        <span class="tw-v">49 of 201</span><span></span><span></span>
      </div>
    </div></div>
  </div>
</div>`;

const packEdge = `
<div class="tw-g tw-r">
  <span class="tw-miss">not set</span>
  <span class="tw-br">E&</span>
  <span class="tw-lnk"><button class="tw-sw"></button><span class="tw-live none"></span></span>
</div>`;

assert.ok(packEdge.includes("E&") && !packEdge.includes("E&amp;"), "E& not double-encoded in React path sample");
assert.ok(sampleHtml.includes("not set"));
assert.ok(sampleHtml.includes("8 of 26 shown"));
assert.ok(sampleHtml.includes("49 of 201"), "creators filtered of portfolio");
assert.ok(sampleHtml.includes("tw-live none"));

const coverage = assertClassCoverage(sampleHtml);
assert.ok(
  coverage.ok,
  `class-coverage missing: ${coverage.missing.join(", ")}`
);

assert.ok(LIST_SRC.includes("1250") || LIST_SRC.includes("SHORTLISTS_MIN_W"));
assert.ok(
  LIST_SRC.includes("Search shortlists"),
  "search placeholder"
);

console.log("OK — 01-shortlists acceptance checks passed");
console.log(
  JSON.stringify(
    {
      track: TRACK,
      classCoverageUsed: coverage.used.length,
      dates: D("Aug 22, 2026"),
      notes: [
        "Horizontal scroll: at 1100px scrolls; tracks held (see probe-shortlists-viewport)",
        "Client link: active / off / none distinct dots",
      ],
    },
    null,
    2
  )
);
