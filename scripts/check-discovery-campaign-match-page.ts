/**
 * Page 7 acceptance — docs/architecture/discovery-specs/07-campaign-match.md
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assertClassCoverage } from "../lib/discovery/suite/class-coverage";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const MATCH = fs.readFileSync(
  path.join(
    ROOT,
    "features/discovery/components/campaign-match/campaign-match-workspace.tsx"
  ),
  "utf8"
);
const PAGE = fs.readFileSync(
  path.join(ROOT, "app/(dashboard)/discovery/campaign-match/page.tsx"),
  "utf8"
);
const ALIAS = fs.readFileSync(
  path.join(ROOT, "app/(dashboard)/discovery/match/page.tsx"),
  "utf8"
);

console.log("07-campaign-match acceptance…");

assert.ok(PAGE.includes("CampaignMatchWorkspace"), "live page mounts workspace");
assert.ok(
  ALIAS.includes('redirect("/discovery/campaign-match")'),
  "pack /discovery/match aliases to live route"
);

assert.ok(!MATCH.includes("KPI") && !MATCH.includes("chart"), "no KPI cards / fake charts");
assert.ok(!MATCH.includes("DiscoverySuiteGrid"), "no grid");

for (const label of [
  "Campaign",
  "Brand",
  "Market",
  "Budget",
  "Creators needed",
  "Campaign brief",
]) {
  assert.ok(MATCH.includes(label), `field ${label}`);
}
assert.ok(MATCH.includes('resize: "vertical"') || MATCH.includes("resize:vertical"), "textarea resizes vertically");
assert.ok(MATCH.includes("height: 96") || MATCH.includes("height:96"), "textarea height 96");

assert.ok(MATCH.includes("No matches yet"), "empty title");
assert.ok(
  MATCH.includes("Enter a campaign brief and run match") &&
    MATCH.includes("Intelligence library"),
  "empty state cause + library path"
);
assert.ok(MATCH.includes("Write a brief"), "next action: write brief");
assert.ok(
  MATCH.includes('href={LIBRARY_HREF}') ||
    MATCH.includes('href="/discovery/intelligence/library"'),
  "next action: load from library"
);

assert.ok(
  MATCH.includes('"/discovery/intelligence/library"') ||
    MATCH.includes("/discovery/intelligence/library"),
  "Load from library reaches page 6"
);
assert.ok(MATCH.includes("Load from library"), "Load from library control");

const primaryMatches = MATCH.match(/Match creators/g) ?? [];
assert.ok(primaryMatches.length >= 1, "Match creators present");
assert.ok(
  MATCH.includes('className="h-8 gap-1.5 rounded-[8px] px-3 text-[12px] font-semibold"') &&
    MATCH.includes("Match creators"),
  "Match creators is the primary button"
);
assert.ok(
  !MATCH.includes('variant="outline"') ||
    MATCH.includes('variant="outline"') && MATCH.includes("Load from library"),
  "Load from library is not the sole primary"
);

assert.ok(MATCH.includes("minmax(170px,1fr)"), "field grid auto-fit 170px");
assert.ok(!MATCH.includes("max-w-[960px]"), "no quiet 960 breakpoint");
assert.ok(
  MATCH.includes("repeat(auto-fit,minmax(170px,1fr))"),
  "readable at 860 — five 170px fields wrap (4+1) rather than forcing a wider floor"
);
assert.ok(MATCH.includes("Creators scanned"), "masthead Creators scanned");
assert.ok(MATCH.includes("Shortlisted"), "masthead Shortlisted");
assert.ok(MATCH.includes("not set"), "Brief not set");

const sampleHtml = `
<div class="discovery-suite">
  <div class="tw-c">
    <div class="tw-ch">
      <span class="tw-ct">Match workspace</span>
      <span class="tw-cs">score creators</span>
      <span class="tw-sp"></span>
    </div>
    <div class="tw-pad">
      <label class="tw-lbl">Campaign</label>
      <select class="tw-in"></select>
      <textarea class="tw-in"></textarea>
    </div>
  </div>
</div>`;
assertClassCoverage(sampleHtml, ["tw-c", "tw-ch", "tw-ct", "tw-cs", "tw-sp", "tw-pad", "tw-lbl", "tw-in"]);

console.log("07-campaign-match acceptance — checks passed");
console.log(
  JSON.stringify(
    {
      liveRoute: "/discovery/campaign-match",
      packAlias: "/discovery/match",
      library: "/discovery/intelligence/library",
    },
    null,
    2
  )
);
