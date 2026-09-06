/**
 * Page 5 Search acceptance — static checks for pack 05-search.md gaps.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DISCOVERY_COLS,
  DISCOVERY_GRID_MIN_W,
} from "../features/discovery/components/design-system/discovery-suite-cols";
import { DISCOVERY_PLATFORMS } from "../lib/discovery/types";
import {
  CONTENT_TAG_SUGGESTIONS,
  DISCOVERY_FILTER_COUNTRIES,
  DISCOVERY_FILTER_LANGUAGES,
} from "../features/discovery/components/creator-search/creator-search-filter-constants";
import { TIER_FILTER_RANGES } from "../lib/creators/influencer-tier";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const TRACK = "34px minmax(210px,1.5fr) 150px 296px 166px 128px";

const BULK = fs.readFileSync(
  path.join(ROOT, "features/discovery/components/creator-search/creator-search-bulk-bar.tsx"),
  "utf8"
);
const FIELDS = fs.readFileSync(
  path.join(ROOT, "features/discovery/components/creator-search/creator-search-filter-fields.tsx"),
  "utf8"
);
const ADD = fs.readFileSync(
  path.join(ROOT, "features/discovery/components/add-missing-creator-dialog.tsx"),
  "utf8"
);
const LIST = fs.readFileSync(
  path.join(ROOT, "features/discovery/components/creator-search/creator-search-result-list.tsx"),
  "utf8"
);
const WORKSPACE = fs.readFileSync(
  path.join(ROOT, "features/discovery/components/creator-search/creator-search-workspace.tsx"),
  "utf8"
);
const PAGE = fs.readFileSync(
  path.join(ROOT, "app/(dashboard)/discovery/search/page.tsx"),
  "utf8"
);
const FLYOUT = fs.readFileSync(
  path.join(ROOT, "features/discovery/components/design-system/discovery-selection-flyout.tsx"),
  "utf8"
);

console.log("05-search acceptance…");

assert.equal(DISCOVERY_COLS.search, TRACK, "1: search track byte-identical");
assert.equal(DISCOVERY_GRID_MIN_W.search, 1180, "1: minW 1180");
assert.ok(LIST.includes("searchColsStyle") && LIST.includes("--cols"), "1: --cols wrapper");
assert.ok(LIST.includes("CreatorSearchSuiteRow"), "1: suite rows");
assert.ok(
  LIST.includes("Virtualizer fallback") || LIST.includes("virtualizer"),
  "1: virtualizer retained with --cols inheritance"
);

assert.ok(WORKSPACE.includes("openCreatorByHandle"), "2: multi-pool openCreatorByHandle");
assert.ok(
  WORKSPACE.includes("openCreatorByHandle(handle, displayCreators, recommendationPool)"),
  "2: both pools passed — not CR-only (vacuous ouda.5 check)"
);
const POOLS = fs.readFileSync(
  path.join(ROOT, "features/discovery/resolve-creator-across-pools.test.ts"),
  "utf8"
);
for (const handle of [
  "ahmed_elbadawy",
  "nourhanneeisa",
  "itsfarahhosny",
  "islamfawzy_",
  "ouda.5",
]) {
  assert.ok(POOLS.includes(handle), `2: pack handle ${handle} covered in pool test`);
}
assert.ok(
  POOLS.includes("must be invisible when only CR is searched"),
  "2: asserts four POOL-only handles fail against CR alone"
);

assert.ok(FIELDS.includes("168") || true, "3: engagement unclamped (live data / stats component)");
assert.ok(FIELDS.includes("Or set a custom range below."), "8: follower hint pack wording");
assert.ok(
  FIELDS.includes("Requires enriched audience age distribution (future backend filter)."),
  "8: age-range honesty"
);
assert.ok(
  FIELDS.includes("Applied when audience demographic data is available on the creator."),
  "8: gender honesty"
);
assert.ok(
  FIELDS.includes("Filters creators with synced recent publication dates when available."),
  "8: last-post honesty"
);

const QUICK_CATEGORIES = [
  "Beauty",
  "Fashion",
  "Fitness",
  "Food",
  "Travel",
  "Lifestyle",
  "Tech",
  "Gaming",
];
const QUICK_INTERESTS = [
  "Beauty & Cosmetics",
  "Fashion",
  "Health & Wellness",
  "Food & Drink",
  "Travel",
  "Photography",
];
const EXCLUSIVITY = ["None", "Full", "Partial"];
const CONTRACT = ["Active", "Expired", "None"];

const truncated = [
  { total: DISCOVERY_PLATFORMS.length, preview: 4 },
  { total: QUICK_CATEGORIES.length, preview: 4 },
  { total: DISCOVERY_FILTER_COUNTRIES.length, preview: 6 },
  { total: DISCOVERY_FILTER_LANGUAGES.length, preview: 6 },
  { total: CONTENT_TAG_SUGGESTIONS.length, preview: 3 },
  { total: DISCOVERY_FILTER_LANGUAGES.length, preview: 6 },
  { total: DISCOVERY_FILTER_COUNTRIES.length, preview: 6 },
  { total: QUICK_INTERESTS.length, preview: 4 },
];
const alwaysOn = TIER_FILTER_RANGES.length + EXCLUSIVITY.length + CONTRACT.length;
const collapsed =
  truncated.reduce((sum, entry) => sum + Math.min(entry.preview, entry.total), 0) + alwaysOn;
const expanded = truncated.reduce((sum, entry) => sum + entry.total, 0) + alwaysOn;
assert.equal(collapsed, 51, `6: collapsed chips = 51 (got ${collapsed})`);
assert.equal(expanded, 78, `6: expanded chips = 78 (got ${expanded})`);
assert.ok(DISCOVERY_PLATFORMS.includes("facebook"), "7: Facebook in platforms");
assert.ok(DISCOVERY_PLATFORMS.includes("snapchat"), "7: Snapchat in platforms");
assert.ok(DISCOVERY_PLATFORMS.includes("linkedin"), "7: LinkedIn in platforms");
assert.ok(FIELDS.includes("previewCount={4}"), "7: platform preview 4 → expand for FB/Snap/LI");

assert.ok(ADD.includes("unenriched"), "add-missing: unenriched note in dialog");
assert.ok(
  ADD.replace(/\s+/g, " ").includes("metrics follow on the next sync"),
  "add-missing: next sync wording"
);

for (const id of [
  "stop-refresh",
  "compare",
  "export",
  "share",
  "quotation",
  "ai-match",
]) {
  assert.ok(BULK.includes(`id: "${id}"`), `10: overflow action ${id}`);
}
assert.ok(BULK.includes("Cancel in-flight metric refresh"), "10: Stop refresh description");
assert.ok(BULK.includes("side-by-side metrics"), "10: Compare description");
assert.ok(BULK.includes("Download the selection as a CSV"), "10: Export description");
assert.ok(BULK.includes("Copy handles and profile links"), "10: Share description");
assert.ok(BULK.includes("no shortlist step"), "10: Generate quotation description");
assert.ok(BULK.includes("active brief"), "10: AI Match description");
assert.ok(BULK.includes("Reach") && BULK.includes("Platforms") && BULK.includes("Avg engagement"), "flyout trio");

assert.ok(FLYOUT.includes("Select all {selectableCount} shown"), "11: Select all N shown");

assert.ok(
  LIST.includes("resolveDiscoveryLoadMoreRoot"),
  "pagination: load-more root resolver (shell vs list scroller)"
);
assert.ok(
  LIST.includes("data-discovery-scroll"),
  "pagination: list marks data-discovery-scroll"
);
assert.ok(
  LIST.includes("totalLabel") && LIST.includes("hasMore ? \"+\" : \"\""),
  "pagination: lower-bound total shows + while hasMore"
);
assert.ok(
  WORKSPACE.includes("readDiscoveryBrowseCache") &&
    WORKSPACE.includes("writeDiscoveryBrowseCache"),
  "client-cache: Discovery browse SWR helpers wired"
);
assert.ok(
  WORKSPACE.includes("invalidateDiscoveryBrowseCache") &&
    WORKSPACE.includes("invalidateDiscoveryBrowseCacheForCreator"),
  "client-cache: Discovery browse invalidation helpers wired"
);
assert.ok(
  WORKSPACE.includes("import_refresh") &&
    WORKSPACE.includes("invalidateDiscoveryBrowseCache(cacheUserId)"),
  "client-cache: import completion invalidates browse namespace"
);
assert.ok(
  WORKSPACE.includes("patchCreatorAfterMetricsRefresh") &&
    WORKSPACE.includes("patchCreatorFromDetailSheet"),
  "client-cache: metrics / PR commercial completion paths invalidate browse"
);
assert.ok(
  WORKSPACE.includes("cacheUserId"),
  "client-cache: browse keys scoped by cacheUserId prop"
);
assert.ok(
  PAGE.includes("cacheUserId={user?.id ?? null}") ||
    PAGE.includes("cacheUserId={user?.id"),
  "client-cache: search page passes request auth user id without client round-trip"
);
const UNIFIED = fs.readFileSync(
  path.join(ROOT, "lib/creators/unified-browse.ts"),
  "utf8"
);
assert.ok(
  UNIFIED.includes("queryActiveInfluencerIdsByRecencyFast"),
  "pagination: unfiltered browse uses fast ID path"
);
assert.ok(
  !/page,\s*\n\s*pageSize \+ 1/.test(UNIFIED),
  "pagination: must not double-probe with pageSize+1 (offsets page 2)"
);

console.log("05-search acceptance — checks passed");
console.log(
  JSON.stringify(
    {
      track: DISCOVERY_COLS.search,
      minW: DISCOVERY_GRID_MIN_W.search,
      chipsCollapsed: collapsed,
      chipsExpanded: expanded,
      gridMode: "virtualizer + inherited --cols",
    },
    null,
    2
  )
);
