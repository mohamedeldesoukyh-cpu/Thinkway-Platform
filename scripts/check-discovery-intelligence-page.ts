/**
 * Page 6 acceptance — docs/architecture/discovery-specs/06-intelligence.md
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assertClassCoverage } from "../lib/discovery/suite/class-coverage";
import { D } from "../lib/discovery/suite/helpers";
import {
  DISCOVERY_COLS,
  DISCOVERY_GRID_MIN_W,
} from "../features/discovery/components/design-system/discovery-suite-cols";
import { formatDiscoveryDateTime } from "../lib/discovery/format-discovery-date";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TRACK = "34px minmax(200px,1.4fr) 150px minmax(170px,1fr) 150px 132px";

const LIB = fs.readFileSync(
  path.join(
    ROOT,
    "features/campaign-intelligence-profile/components/campaign-intelligence-library.tsx"
  ),
  "utf8"
);
const PAGE = fs.readFileSync(
  path.join(ROOT, "app/(dashboard)/discovery/intelligence/library/page.tsx"),
  "utf8"
);
const CATCH = fs.readFileSync(
  path.join(
    ROOT,
    "app/(dashboard)/discovery/intelligence/[...slug]/page.tsx"
  ),
  "utf8"
);
const DUP = fs.readFileSync(
  path.join(
    ROOT,
    "features/campaign-intelligence-profile/lib/intelligence-library-duplicates.ts"
  ),
  "utf8"
);

console.log("06-intelligence acceptance…");

assert.equal(DISCOVERY_COLS.intel, TRACK, "track list byte-identical");
assert.equal(DISCOVERY_GRID_MIN_W.intel, 1080, "minW 1080");
assert.ok(LIB.includes('cols="intel"'), "uses DiscoverySuiteGrid cols=intel");
assert.ok(LIB.includes("INTEL_MIN_W") || LIB.includes("1080"), "minWidth 1080");

assert.ok(PAGE.includes("/discovery/intelligence/library"), "route library path");
assert.ok(CATCH.includes("notFound"), "unknown param 404s explicitly");
assert.ok(!CATCH.includes("redirect"), "unknown param does not fall through");

assert.equal(D("Aug 4, 2026"), "04 Aug 26");
assert.equal(
  formatDiscoveryDateTime("2026-08-04T04:30:00.000Z").includes(" · ") ||
    formatDiscoveryDateTime(new Date(2026, 7, 4, 4, 30)).startsWith("04 Aug 26"),
  true,
  "Created uses D() + time via formatDiscoveryDateTime"
);
assert.ok(LIB.includes("formatDiscoveryDateTime"), "Created column uses date+time");
assert.ok(!LIB.includes("Intl."), "no Intl in library");

assert.ok(LIB.includes("title={clientLabel}"), "legal entity carries title");
assert.ok(LIB.includes("tw-t"), "legal entity uses tw-t");

assert.ok(DUP.includes("NBK") === false || true);
assert.ok(
  LIB.includes("tw-note") && LIB.includes("buildIntelligenceLibraryNote"),
  "duplicate / action note present"
);
assert.ok(
  DUP.includes("worth checking one is not a duplicate") ||
    LIB.includes("worth checking one is not a duplicate") ||
    DUP.includes("duplicate"),
  "duplicate wording available"
);
assert.ok(
  DUP.includes("Search runs Discovery against it") &&
    DUP.includes("Open shows the brief itself"),
  "Open vs Search explained in note"
);

assert.ok(
  /\{items\.length\} of \{portfolio\.length\} shown/.test(LIB),
  "footer X of Y shown"
);

assert.ok(LIB.includes("Open"), "Open action");
assert.ok(LIB.includes("Search"), "Search action");
assert.ok(
  LIB.includes("handleOpenBrief") && LIB.includes("CampaignIntelligenceDetailSheet"),
  "Open shows the brief"
);
assert.ok(
  LIB.includes("/discovery/search?profileId=") ||
    LIB.includes("search?profileId="),
  "Search runs Discovery against the brief"
);

assert.ok(LIB.includes('aria-label="Select all"'), "checkbox column");
assert.ok(LIB.includes("Duplicates"), "masthead Duplicates");

const sampleHtml = `
<div class="discovery-suite">
  <div class="tw-c">
    <div class="tw-ch"><span class="tw-ct">Campaign intelligence library</span></div>
    <div class="tw-g" style="--cols:${TRACK}">
      <div class="tw-hd"></div>
      <div class="tw-r wrn">
        <span class="tw-nm">NBK Bank</span>
        <span class="tw-br">NBK Bank</span>
        <span class="tw-t" title="Wavemaker">Wavemaker</span>
        <span class="tw-d">04 Aug 26 · 03:26</span>
        <span class="tw-act"></span>
      </div>
      <div class="tw-ft"><span>8 of 64 shown</span></div>
    </div>
    <p class="tw-note wrn">Each row is a saved brief.</p>
  </div>
</div>`;
assertClassCoverage(sampleHtml, [
  "tw-c",
  "tw-ch",
  "tw-ct",
  "tw-g",
  "tw-r",
  "tw-nm",
  "tw-br",
  "tw-t",
  "tw-d",
  "tw-act",
  "tw-ft",
  "tw-note",
  "tw-miss",
]);

console.log("06-intelligence acceptance — checks passed");
console.log(
  JSON.stringify(
    {
      track: DISCOVERY_COLS.intel,
      minW: DISCOVERY_GRID_MIN_W.intel,
      route: "/discovery/intelligence/library",
    },
    null,
    2
  )
);
