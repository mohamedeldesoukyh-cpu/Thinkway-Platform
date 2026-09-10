/**
 * One creator detail design, everywhere.
 *
 * `CreatorDetailSheet` contains TWO layouts chosen by a prop:
 * `presentation="discoveryPack"` renders the current Discovery design
 * (`DiscoverySuiteCreatorProfile` — the centred pack overlay), and the default
 * `"sheet"` renders the legacy right drawer. Studio, Campaign Match, Compare
 * and the creator browser were all on the default, which is why the detail
 * opened from them looked old.
 *
 * These are source-contract tests: they pin the canonical component and
 * presentation at every entry point, and that no second detail implementation
 * has been introduced. Rendering is not covered here and no browser run is
 * claimed.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const CANONICAL_PRESENTATION = 'presentation="discoveryPack"';

/** Every place a creator detail is opened from. */
const ENTRY_POINTS: Array<{ name: string; file: string }> = [
  {
    name: "Discovery → creator details",
    file: "features/discovery/components/creator-search/creator-search-workspace.tsx",
  },
  {
    name: "Discovery shortlist → creator details",
    file: "features/discovery/shortlists/components/shortlist-workspace.tsx",
  },
  {
    name: "Discovery campaign match → creator details",
    file: "features/discovery/components/campaign-match/campaign-match-workspace.tsx",
  },
  {
    name: "Discovery compare → creator details",
    file: "features/discovery/components/creator-compare/creator-compare-workspace.tsx",
  },
  {
    name: "Discovery detail host (AI workspace, decision workspace)",
    file: "features/discovery/components/discovery-creator-detail-host.tsx",
  },
  {
    name: "Studio creators → creator details",
    file: "features/campaign-studio/components/sections/studio-creator-detail-host.tsx",
  },
  {
    name: "Studio Replace / Browse Discovery → creator details",
    file: "features/campaign-studio/components/sections/add-creator-panel.tsx",
  },
  {
    name: "Campaign creator browser → creator details",
    file: "features/campaigns/components/creator-browser-dialog.tsx",
  },
];

function read(file: string): string {
  return readFileSync(file, "utf8");
}

for (const entry of ENTRY_POINTS) {
  test(`${entry.name} uses the canonical component`, () => {
    const source = read(entry.file);
    assert.match(source, /CreatorDetailSheet/, "must render Discovery's own detail component");
  });

  test(`${entry.name} uses the canonical presentation`, () => {
    const source = read(entry.file);
    assert.ok(
      source.includes(CANONICAL_PRESENTATION),
      `${entry.file} must pass ${CANONICAL_PRESENTATION} — the default renders the legacy drawer`
    );
    assert.ok(
      !/presentation="sheet"/.test(source),
      `${entry.file} must not pin the legacy sheet layout`
    );
  });
}

test("the canonical design is the Discovery suite profile, not a Studio copy", () => {
  const sheet = read("features/campaigns/components/creator-detail-sheet.tsx");
  assert.match(sheet, /DiscoverySuiteCreatorProfile/);
  assert.match(sheet, /presentation === "discoveryPack"/);
});

test("Studio and Discovery resolve the creator from the same data source", () => {
  const studioHost = read(
    "features/campaign-studio/components/sections/studio-creator-detail-host.tsx"
  );
  const discoveryHost = read("features/discovery/components/discovery-creator-detail-host.tsx");

  for (const [name, source] of [
    ["studio", studioHost],
    ["discovery", discoveryHost],
  ] as const) {
    assert.match(
      source,
      /getUnifiedCreatorsBatchAction/,
      `${name} must resolve the unified creator through the shared action`
    );
  }
});

test("Studio adds only contextual actions — it does not render a second detail view", () => {
  const studioHost = read(
    "features/campaign-studio/components/sections/studio-creator-detail-host.tsx"
  );

  // Updated deliberately. This used to allow the planning sheet as the state
  // for a creator with no unified Discovery record. Browser evidence showed
  // what that cost: the planning drawer opened on every click and was replaced
  // by the canonical pack a few seconds later, once
  // `getUnifiedCreatorsBatchAction` resolved. The canonical pack now opens
  // immediately and carries its own loading state, so there is no second
  // detail component in the host at all.
  assert.doesNotMatch(studioHost, /StudioPlanningCreatorDetail/);
  assert.equal(
    (studioHost.match(/<CreatorDetailSheet\b/g) ?? []).length,
    1,
    "one detail component, from the first frame"
  );
  assert.match(studioHost, /pendingIdentity/, "the pack loads with the clicked card's identity");
  assert.ok(
    !/CreatorDrawer\b/.test(studioHost),
    "the slim legacy drawer must not be a Studio fallback"
  );
});

test("the replacement action rides on the canonical sheet's own assign hook", () => {
  const panel = read("features/campaign-studio/components/sections/add-creator-panel.tsx");

  assert.match(panel, /onAssign=\{/, "reuses the sheet's existing action slot");
  assert.match(panel, /assignLabel=/, "only the label is contextual");
  assert.match(
    panel,
    /pickDiscoveryCreator\(creator\)/,
    "selecting from details stages through the one staging path"
  );
});

test("the sheet renders a caller context block in BOTH layouts", () => {
  const sheet = read("features/campaigns/components/creator-detail-sheet.tsx");
  const occurrences = sheet.split("contextSlot").length - 1;
  assert.ok(
    occurrences >= 4,
    `contextSlot must be declared, defaulted and rendered in both layouts (found ${occurrences} references)`
  );
  assert.match(sheet, /creator-detail-sheet-context-slot/, "pack layout renders it");
});

test("Build Shortlist is untouched by the detail unification", () => {
  const shortlistActions = read(
    "features/campaign-studio/actions/shortlist-slate-actions.ts"
  );
  assert.match(shortlistActions, /listStudioShortlistsAction/);
  assert.match(shortlistActions, /applyShortlistToSlateAction/);
  assert.ok(
    !/CreatorDetailSheet|presentation=/.test(shortlistActions),
    "shortlist behaviour has no detail-presentation coupling"
  );
});
