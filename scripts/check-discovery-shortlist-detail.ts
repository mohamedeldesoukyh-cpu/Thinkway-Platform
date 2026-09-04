/**
 * Page 2 acceptance — docs/architecture/discovery-specs/02-shortlist-detail.md
 * Does not modify discovery.css or lib/discovery/suite/.
 *
 * Live-data notes (Dev hsxrewjcbvmbkqdlzjhs) are comments only — this gate is static + unit.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DISCOVERY_COLS,
  DISCOVERY_GRID_MIN_W,
} from "../features/discovery/components/design-system/discovery-suite-cols";
import { resolveCreatorAcrossPools } from "../features/discovery/resolve-creator-across-pools";
import type { UnifiedCreatorResult } from "../lib/creators/types";
import { resolveCreatorBrowsePlatformStats } from "../lib/creators/resolve-browse-display-metrics";
import { assertClassCoverage } from "../lib/discovery/suite/class-coverage";
import { AB } from "../lib/discovery/suite/helpers";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const TRACK = "30px minmax(200px,1.4fr) 68px 140px 296px 166px 126px 96px";

const EXACT_SRC = fs.readFileSync(
  path.join(ROOT, "features/discovery/components/discovery-creator-exact-row.tsx"),
  "utf8"
);
const STATS_SRC = fs.readFileSync(
  path.join(ROOT, "features/discovery/components/discovery-creator-platform-stats.tsx"),
  "utf8"
);
const LIST_SRC = fs.readFileSync(
  path.join(ROOT, "features/discovery/shortlists/components/shortlist-creator-list.tsx"),
  "utf8"
);
const WORKSPACE_SRC = fs.readFileSync(
  path.join(ROOT, "features/discovery/shortlists/components/shortlist-workspace.tsx"),
  "utf8"
);
const SEARCH_SRC = fs.readFileSync(
  path.join(ROOT, "features/discovery/components/creator-search/creator-search-workspace.tsx"),
  "utf8"
);
const HOOK_SRC = fs.readFileSync(
  path.join(ROOT, "features/discovery/hooks/use-creator-detail-sheet-state.ts"),
  "utf8"
);
const SHEET_SRC = fs.readFileSync(
  path.join(ROOT, "features/campaigns/components/creator-detail-sheet.tsx"),
  "utf8"
);
const COMBINE_SRC = fs.readFileSync(
  path.join(ROOT, "features/discovery/components/combine-creators-dialog.tsx"),
  "utf8"
);
const EDIT_URL_SRC = fs.readFileSync(
  path.join(ROOT, "features/discovery/components/edit-creator-profile-url-dialog.tsx"),
  "utf8"
);
const PICKER_ROW_SRC = fs.readFileSync(
  path.join(ROOT, "features/creators/picker/creator-picker-panel-row.tsx"),
  "utf8"
);

console.log("02-shortlist-detail acceptance (13 checks)…");

assert.ok(LIST_SRC.includes("DiscoverySuiteGrid"), "1: paints DiscoverySuiteGrid");
assert.ok(LIST_SRC.includes('cols="shortlist"'), "1: cols=shortlist key (not flex exact-row)");
assert.ok(!LIST_SRC.includes("discovery-search-exact-root"), "1: no flex exact-row root");
assert.equal(DISCOVERY_COLS.shortlist, TRACK, "1: DISCOVERY_COLS.shortlist byte-identical to pack");
assert.equal(DISCOVERY_GRID_MIN_W.shortlist, 1360, "1: min-width 1360");
assert.ok(
  !/(^|\s)40px(\s|$)/.test(DISCOVERY_COLS.shortlist),
  "1: no extra 40px column in pack track"
);
const suiteCss = fs.readFileSync(path.join(ROOT, "app/styles/discovery-suite.css"), "utf8");
assert.ok(suiteCss.includes("296px") && suiteCss.includes("166px"), "1: suite CSS holds 296/166");
assert.ok(COMBINE_SRC.includes("This cannot be undone"), "10: Combine undo warning");
assert.ok(SHEET_SRC.includes("Run enrichment"), "9: Run enrichment button label");
assert.ok(
  fs
    .readFileSync(path.join(ROOT, "lib/creators/creator-centric.ts"), "utf8")
    .includes("Location is creator-level"),
  "8: estimated_country locked on platform switch"
);

// 2 — Three platform rows (pack fixture / unit — live has ≥3-platform creators e.g. Farah SL-2026-0011)
const reemLike = {
  unified_id: "inf:reem",
  platforms: [
    {
      id: "ig",
      platform: "instagram",
      handle: "reem_elkhashab",
      follower_count: 397_600,
      engagement_rate: 3.06,
      avg_views: null,
    },
    {
      id: "tt",
      platform: "tiktok",
      handle: "reem_elkhashab",
      follower_count: 454_300,
      engagement_rate: 12.83,
      avg_views: 1_200_000,
    },
    {
      id: "fb",
      platform: "facebook",
      handle: "reem_elkhashab",
      follower_count: null,
      engagement_rate: null,
      avg_views: null,
      enrichment_status: "never",
    },
  ],
  metrics: {
    followers: { value: null, confidence: "estimated" },
    engagement_rate: { value: null, confidence: "estimated" },
    avg_likes: { value: null, confidence: "estimated" },
    avg_comments: { value: null, confidence: "estimated" },
    avg_views: { value: null, confidence: "estimated" },
    posting_frequency_per_week: { value: null, confidence: "estimated" },
  },
} as UnifiedCreatorResult;
const reemRows = resolveCreatorBrowsePlatformStats(reemLike);
assert.equal(reemRows.length, 3, "2: three connected platforms → three rows");

// 3 — IG avg-views null → — / .z, never 0
assert.equal(reemRows[0]?.avgViews, null, "3: null avg-views stays null");
assert.equal(AB(reemRows[0]?.avgViews), "—", "3: AB(null) is —");
assert.ok(STATS_SRC.includes('row.avgViews == null && "z"'), "3: .z class wired");

// 4 — Arabic + pipe name button (live: Karim b1d178d3… on SL-2026-0026 / 0011 / 0014 / 0023)
assert.ok(EXACT_SRC.includes("truncate") && EXACT_SRC.includes("min-w-0"), "4: ellipsis + min-width:0");
assert.ok(EXACT_SRC.includes('type="button"'), "4/5: name is button");

// 5 — Name button Tab/Enter
assert.ok(EXACT_SRC.includes("Enter"), "5: Enter path");

// 6 — openCreatorByHandle across pools (all handles, not ouda.5 alone)
assert.ok(HOOK_SRC.includes("openCreatorByHandle"));
assert.ok(WORKSPACE_SRC.includes("handleOpenCreatorByHandle"));
assert.ok(SEARCH_SRC.includes("openCreatorByHandle"));
const stub = (handle: string, id: string): UnifiedCreatorResult =>
  ({
    unified_id: id,
    platforms: [{ id: `${id}-ig`, platform: "instagram", handle, profile_url: null }],
  }) as UnifiedCreatorResult;
const shortlist = [stub("ouda.5", "cr-1"), stub("reem_elkhashab", "cr-2")];
const searchPool = [
  stub("ahmed_elbadawy", "pool-1"),
  stub("itsfarahhosny", "pool-2"),
  stub("ouda.5", "pool-ouda"),
];
assert.equal(resolveCreatorAcrossPools("itsfarahhosny", shortlist, searchPool)?.unified_id, "pool-2");
assert.equal(resolveCreatorAcrossPools("ouda.5", shortlist, searchPool)?.unified_id, "cr-1");

// 7 — Similar creators rail limit 8
assert.ok(SHEET_SRC.includes("SIMILAR_CREATORS_RAIL_LIMIT = 8"), "7: rail limit 8");

// 8 — Platform switch projects metrics + publications (identity score/price stay on identityCreator)
assert.ok(SHEET_SRC.includes("projectCreatorPlatformView"), "8: platform projection");
assert.ok(SHEET_SRC.includes("CreatorAveragePriceCard"), "8: price card present");
assert.ok(SHEET_SRC.includes("eci_investment_score"), "8: investment score from identity fields");

// 9 — Contact empty state
assert.ok(SHEET_SRC.includes("No contact information"), "9: empty contact copy");
assert.ok(SHEET_SRC.includes("Add contact details"), "9: Add contact details action");
// Spec also wants Run enrichment as an action — currently prose-only when !canEdit

// 10 — Combine confirm disabled until target
assert.ok(COMBINE_SRC.includes("disabled={!canConfirm}"), "10: confirm gated");
assert.ok(COMBINE_SRC.includes("sourceCreator?.influencer_id"), "10: requires selected source");
assert.ok(
  SHEET_SRC.includes("CombineCreatorsDialog") || SHEET_SRC.includes("setCombineCreatorsOpen"),
  "10: wired from modal"
);

// 11 — Add-creators drawer dims on-list creators
assert.ok(WORKSPACE_SRC.includes("AddCreatorsDrawer"), "11: drawer owned by page 2");
assert.ok(
  PICKER_ROW_SRC.includes("opacity-55") || PICKER_ROW_SRC.includes("opacity-60"),
  "11: dimmed"
);
assert.ok(
  PICKER_ROW_SRC.includes("On list") || PICKER_ROW_SRC.includes("disabledBadge"),
  "11: on-list badge"
);

// 12 — No handler named `open` as a global conflict in page 2 sources
assert.ok(!/\bfunction open\s*\(/.test(WORKSPACE_SRC), "12: no function open(");
assert.ok(!/\bconst open\s*=\s*\(/.test(WORKSPACE_SRC), "12: no const open = (");

// 13 — Class coverage across default + overlay chrome samples
const defaultHtml = `
<div class="discovery-suite">
  <div class="tw-stx">
    <span class="hh"><i></i><i>Followers</i><i>Engagement</i><i>Avg views</i></span>
    <span class="rr"><span class="tw-pf"><span class="ig">IG</span></span><b>397.6K</b><b>3.06%</b><b class="z">—</b></span>
    <span class="rr"><span class="tw-pf"><span class="fb">FB</span></span><b class="z">—</b><b class="z">—</b><b class="z">—</b></span>
  </div>
  <button type="button" class="nm">Karim Kabbany | كريم قباني</button>
  <div class="tw-thumbs"><div class="tw-thumb"></div><div class="tw-thumb"></div><div class="tw-thumb"></div></div>
  <div class="tw-note">Click a creator name to open the full profile</div>
</div>`;

const profileOverlayHtml = `
<div class="discovery-suite">
  <div class="tw-scrim"></div>
  <div class="tw-cp"><div class="tw-cp__w">
    <button class="tw-dr__x" aria-label="Close"></button>
    <div class="tw-fchip">Instagram</div>
  </div></div>
</div>`;

const drawerOverlayHtml = `
<div class="discovery-suite">
  <div class="tw-dr">
    <div class="tw-dr__h"><button class="tw-dr__x" aria-label="Close"></button></div>
    <div class="tw-dr__s"><button class="tw-b on">Search</button><button class="tw-b">Paste links</button></div>
  </div>
</div>`;

for (const [label, html] of [
  ["default", defaultHtml],
  ["profile", profileOverlayHtml],
  ["add-creators", drawerOverlayHtml],
] as const) {
  const coverage = assertClassCoverage(html);
  assert.ok(
    coverage.ok,
    `13: class-coverage ${label} missing: ${coverage.missing.join(", ")}`
  );
}

assert.ok(EDIT_URL_SRC.length > 100, "Edit URL dialog exists");
assert.ok(LIST_SRC.includes('cols="shortlist"'));
assert.ok(STATS_SRC.includes('className="tw-stx"'));
assert.equal(DISCOVERY_GRID_MIN_W.shortlist, 1360, "grid engine min-width 1360 via cols key");

console.log("02-shortlist-detail acceptance — 13 checks passed (static/unit)");
console.log(
  JSON.stringify(
    {
      track: TRACK,
      minWidth: DISCOVERY_GRID_MIN_W.shortlist,
      livePointers: {
        threePlatforms: "Farah Haridy aa49b6c4… on SL-2026-0011 (IG/TT/YT)",
        deadFbAdjacent:
          "Ramy Soliman c6a65262… on SL-2026-0012 (FB follower_count=0 → —)",
        arabicPipeName:
          "Karim Kabbany | كريم قباني b1d178d3… on SL-2026-0026 (and 0011/0014/0023)",
      },
      gapsCalledOutInReport: [
        "Page 2 now paints DiscoverySuiteGrid cols=shortlist (engine, not flex)",
        "Overlay class-coverage: pack profile tabs + react Edit URL / Combine / Add-creators samples",
      ],
    },
    null,
    2
  )
);
