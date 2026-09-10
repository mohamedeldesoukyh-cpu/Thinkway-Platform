/**
 * Studio Creator Details is the canonical Discovery profile, correctly styled.
 *
 * Browser evidence: Studio opened a right-side "Executive recommendation"
 * drawer and, after a few seconds, became a full-screen creator image.
 *
 * Cause chain, both symptoms from one root:
 *   1. `StudioCreatorDetailHost` shows the planning sheet while
 *      `getUnifiedCreatorsBatchAction` resolves, then swaps to the canonical
 *      pack — the "after ~5 seconds" transition.
 *   2. The pack's geometry (`.tw-cp__w` grid, `.tw-cp__av` 84px avatar circle,
 *      `.tw-scrim`) lives in the frozen foundation sheet, which was imported
 *      ONLY by `app/(dashboard)/discovery/layout.tsx`. Rendered from Studio the
 *      markup arrived unstyled, the avatar box had no size, and the `<img>`
 *      fell back to its intrinsic dimensions — the full-screen image.
 *
 * Source-contract tests. Rendering is not covered here and no browser run is
 * claimed.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const PACK_COMPONENT =
  "features/discovery/components/design-system/discovery-suite-creator-profile.tsx";
const SHEET = "features/campaigns/components/creator-detail-sheet.tsx";
const STUDIO_HOST = "features/campaign-studio/components/sections/studio-creator-detail-host.tsx";

function read(file: string): string {
  return readFileSync(file, "utf8");
}

// ---------------------------------------------------------------------------
// The full-screen avatar cannot come back.

test("the pack component loads its own geometry, not the Discovery route's", () => {
  const source = read(PACK_COMPONENT);

  // Without these the avatar circle has no size and the image fills the screen.
  assert.match(source, /import "@\/app\/styles\/discovery\.css";/);
  assert.match(source, /import "@\/app\/styles\/discovery-suite-creator-profile\.css";/);
  // The legacy suite sheet must NOT be pulled in: it carries one unscoped
  // `.tip` rule that `collapsible-app-sidebar` also uses, so loading it on
  // other routes would restyle the sidebar tooltip.
  assert.ok(
    !/import "@\/app\/styles\/discovery-suite\.css";/.test(source),
    "the legacy suite sheet has an unscoped rule and must stay route-scoped"
  );
});

test("the geometry the avatar depends on is in a sheet the component imports", () => {
  // `.tw-cp__av` is the 84px circle. If it moves out of these sheets the
  // component's imports must follow it.
  const foundation = read("app/styles/discovery.css");
  assert.match(foundation, /\.discovery-suite \.tw-cp__av\{[^}]*width:84px/);
  assert.match(foundation, /\.discovery-suite \.tw-cp__w\{/);
  assert.match(foundation, /\.discovery-suite \.tw-scrim\{/);
});

test("every pack rule is scoped, so loading it elsewhere changes nothing else", () => {
  // Only the sheet the component actually imports.
  for (const file of ["app/styles/discovery.css"]) {
    const css = read(file);
    const topLevelSelectors = [...css.matchAll(/^([.#][^{,\n]+)\{/gm)].map((match) =>
      match[1]!.trim()
    );
    const unscoped = topLevelSelectors.filter(
      (selector) => !selector.includes(".discovery-suite") && !selector.startsWith(".tw-")
    );
    assert.deepEqual(unscoped, [], `${file} has unscoped rules: ${unscoped.join(", ")}`);
  }
});

test("the pack portal root carries the scope class itself", () => {
  const source = read(PACK_COMPONENT);
  assert.match(
    source,
    /createPortal\(\s*<div className="discovery-suite tw-cp-root">/,
    "the pack must scope itself — it cannot rely on a route wrapper"
  );
});

// ---------------------------------------------------------------------------
// Studio uses the canonical shell, with its campaign area as the first tab.

test("Studio opens the canonical pack presentation", () => {
  const source = read(STUDIO_HOST);
  assert.match(source, /CreatorDetailSheet/);
  assert.match(source, /presentation="discoveryPack"/);
  assert.ok(
    !/presentation="sheet"/.test(source),
    "the legacy right drawer is not Studio's creator detail"
  );
});

test("Studio's campaign intelligence is a tab inside that shell", () => {
  const sheet = read(SHEET);

  assert.match(sheet, /"campaign" \| "overview"/, "campaign is a tab id");
  assert.match(
    sheet,
    /contextSlot && isDiscoveryPack \? "campaign" : "overview"/,
    "Studio opens on its own campaign area"
  );
  assert.match(
    sheet,
    /contextSlot \? \(\[\["campaign", "Campaign"\]\] as const\) : \[\]/,
    "the tab appears only when a caller supplies campaign content"
  );
  assert.match(
    sheet,
    /activeTab === "campaign" && contextSlot/,
    "the campaign tab renders the caller's block"
  );
});

test("the Discovery tabs are reused verbatim for everything else", () => {
  const sheet = read(SHEET);
  assert.match(sheet, /DiscoverySuiteCreatorProfileTabs/);
  for (const tab of ["Overview", "Contact", "Publications", "Confidence"]) {
    assert.ok(sheet.includes(`"${tab}"`), `${tab} tab must still come from Discovery`);
  }
});

test("no second creator detail component was introduced", () => {
  const host = read(STUDIO_HOST);
  // Updated deliberately — see the note in `creator-detail-canonical.test.ts`.
  // Allowing the planning sheet as the unresolved state is exactly what made
  // the drawer appear and then swap out; the pack now opens immediately with
  // its own loading state.
  assert.doesNotMatch(host, /StudioPlanningCreatorDetail/);
  assert.equal((host.match(/<CreatorDetailSheet\b/g) ?? []).length, 1);
  assert.ok(!/CreatorDrawer\b/.test(host), "no slim legacy drawer fallback");
});

test("Discovery's own entry points are unchanged and still canonical", () => {
  for (const file of [
    "features/discovery/components/creator-search/creator-search-workspace.tsx",
    "features/discovery/shortlists/components/shortlist-workspace.tsx",
    "features/discovery/components/discovery-creator-detail-host.tsx",
  ]) {
    const source = read(file);
    assert.match(source, /presentation="discoveryPack"/, file);
  }
});

// ---------------------------------------------------------------------------
// Client-facing wording.

test("the internal ECI acronym is not shown to the client", () => {
  for (const file of [
    "features/campaign-studio/services/studio-replacement-candidates.ts",
    "features/campaign-studio/services/eci/executive-planning-view.ts",
  ]) {
    const code = read(file)
      .split(/\r?\n/)
      .filter((line) => !/^\s*(\*|\/\/|\/\*)/.test(line))
      .join("\n");
    const strings = [...code.matchAll(/["`]([^"`]*\bECI\b[^"`]*)["`]/g)].map((m) => m[1]!);
    assert.deepEqual(
      strings,
      [],
      `${file} exposes ECI in a user-facing string: ${strings.join(" | ")}`
    );
  }
});
