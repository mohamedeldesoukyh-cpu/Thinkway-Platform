/**
 * The Studio shortlist selection UX.
 *
 * The selection has ONE source of truth: `vendorDecisions[id] === "shortlisted"`,
 * staged by `selectCreatorForShortlistAction` and committed by Apply. The
 * panel, the card buttons and Generate Shortlist all derive from it — the only
 * additional state is an optimistic overlay so a click lands immediately.
 *
 * Selecting a creator, applying a draft, and generating a shortlist are three
 * different operations. `selectCreatorForShortlistAction` used to be
 * `shortlistVendorRecommendationAction`, which created a shortlist on the first
 * pick and wrote each creator to it — so selecting WAS generating. Those tests
 * live in `studio-shortlist-generation.test.ts`.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import type { CampaignCreatorDecision } from "./creator-decision-status";
import {
  STUDIO_SHORTLIST_FALLBACK_NAME,
  canGenerateShortlist,
  isCreatorSelected,
  resolveGeneratedShortlistName,
  resolveStudioCreatorSelection,
  withOptimisticSelection,
  withoutOptimisticSelection,
  type StudioSelectionOverlay,
} from "./studio-creator-selection";

const read = (file: string) => readFileSync(file, "utf8");

const VENDORS = [
  { id: "inf:a", displayName: "Creator A", handle: "@a", platform: "instagram", avatarUrl: "a.jpg" },
  { id: "inf:b", displayName: "Creator B", handle: "@b", platform: "tiktok" },
  { id: "inf:c", displayName: "Creator C", handle: "@c", platform: "instagram" },
];

const decisions = (
  entries: Record<string, CampaignCreatorDecision>
): Record<string, CampaignCreatorDecision> => entries;

// ---------------------------------------------------------------------------
// A. Selection.

test("A. adding a creator puts it on the panel immediately", () => {
  // No server round trip: the overlay answers first.
  const overlay = withOptimisticSelection({}, "inf:a", "selected");
  const selected = resolveStudioCreatorSelection({ vendors: VENDORS, decisions: {}, overlay });

  assert.equal(selected.length, 1);
  assert.equal(selected[0]!.creatorId, "inf:a");
  assert.equal(selected[0]!.displayName, "Creator A");
  assert.equal(selected[0]!.handle, "@a");
  assert.equal(selected[0]!.platform, "instagram");
  assert.equal(selected[0]!.avatarUrl, "a.jpg");
});

test("A. adding the same creator twice does not duplicate it", () => {
  let overlay: StudioSelectionOverlay = {};
  overlay = withOptimisticSelection(overlay, "inf:a", "selected");
  overlay = withOptimisticSelection(overlay, "inf:a", "selected");
  assert.equal(
    resolveStudioCreatorSelection({ vendors: VENDORS, decisions: {}, overlay }).length,
    1
  );

  // And a creator already selected in the canonical state reports as selected,
  // which is what stops the add handler from firing again.
  assert.equal(
    isCreatorSelected({ creatorId: "inf:a", decisions: decisions({ "inf:a": "shortlisted" }) }),
    true
  );
});

test("A. one creator cannot appear twice through id prefixes", () => {
  const selected = resolveStudioCreatorSelection({
    vendors: [{ id: "dis:a", displayName: "Creator A" }, { id: "inf:a", displayName: "Creator A" }],
    decisions: decisions({ "inf:a": "shortlisted" }),
  });
  assert.equal(selected.length, 1);
});

test("A. removing a creator takes it off the panel immediately", () => {
  const overlay = withOptimisticSelection({}, "inf:a", "removed");
  const selected = resolveStudioCreatorSelection({
    vendors: VENDORS,
    decisions: decisions({ "inf:a": "shortlisted", "inf:b": "shortlisted" }),
    overlay,
  });
  assert.deepEqual(selected.map((c) => c.creatorId), ["inf:b"]);
});

test("A. the count follows the canonical state as it changes", () => {
  const count = (d: Record<string, CampaignCreatorDecision>, overlay?: StudioSelectionOverlay) =>
    resolveStudioCreatorSelection({ vendors: VENDORS, decisions: d, overlay }).length;

  assert.equal(count({}), 0);
  assert.equal(count(decisions({ "inf:a": "shortlisted" })), 1);
  assert.equal(count(decisions({ "inf:a": "shortlisted", "inf:b": "shortlisted" })), 2);
  assert.equal(
    count(decisions({ "inf:a": "shortlisted", "inf:b": "shortlisted", "inf:c": "shortlisted" })),
    3
  );
});

test("A. approved and rejected decisions are not a shortlist selection", () => {
  const selected = resolveStudioCreatorSelection({
    vendors: VENDORS,
    decisions: decisions({ "inf:a": "approved", "inf:b": "rejected", "inf:c": "shortlisted" }),
  });
  assert.deepEqual(selected.map((c) => c.creatorId), ["inf:c"]);
});

test("A. the overlay is dropped once the canonical state answers", () => {
  const overlay = withoutOptimisticSelection(
    withOptimisticSelection({}, "inf:a", "selected"),
    "inf:a"
  );
  assert.deepEqual(overlay, {});
  // With the server's answer in place, the canonical state alone decides.
  assert.equal(
    resolveStudioCreatorSelection({
      vendors: VENDORS,
      decisions: decisions({ "inf:a": "shortlisted" }),
      overlay,
    }).length,
    1
  );
});

test("A. a selected creator with no hydrated card is still counted", () => {
  const selected = resolveStudioCreatorSelection({
    vendors: VENDORS,
    decisions: decisions({ "inf:a": "shortlisted", "inf:ghost": "shortlisted" }),
  });
  assert.equal(selected.length, 2, "the selection is not silently reduced");
  assert.ok(selected.some((c) => c.creatorId === "inf:ghost"));
});

test("A. selection survives opening and closing Creator Details", () => {
  // The detail host is a sibling overlay driven by its own `open` state; it
  // neither owns nor resets the selection, which lives on the campaign draft.
  const source = read(
    "features/campaign-studio/components/sections/vendor-recommendations-section.tsx"
  );
  const detailMount = source.slice(source.indexOf("<StudioCreatorDetailHost"));
  assert.doesNotMatch(detailMount.slice(0, 400), /setDecisionOverlay|setVendorDecisions/);
  // And the panel reads the same derived selection regardless of the drawer.
  // (The prop is `selected` since the panel also carries an Approved section.)
  assert.match(source, /selected=\{selectedForShortlist\}/);
});

// ---------------------------------------------------------------------------
// B. Generate Shortlist.

test("B. an existing campaign name is prefilled and used", () => {
  assert.equal(
    resolveGeneratedShortlistName("Kérastase Egypt Consideration Campaign"),
    "Kérastase Egypt Consideration Campaign — Studio picks"
  );
});

test("B. a blank campaign name does not block generation", () => {
  for (const name of ["", "   ", undefined, null]) {
    assert.equal(resolveGeneratedShortlistName(name), STUDIO_SHORTLIST_FALLBACK_NAME);
  }
  // The gate is creators, never a name.
  assert.equal(canGenerateShortlist({ selectedCount: 3, generating: false }), true);
  assert.equal(canGenerateShortlist({ selectedCount: 0, generating: false }), false);
  assert.equal(canGenerateShortlist({ selectedCount: 3, generating: true }), false);
});

test("B. no campaign name is invented to satisfy the form", () => {
  const name = resolveGeneratedShortlistName(undefined);
  assert.equal(name, STUDIO_SHORTLIST_FALLBACK_NAME);
  assert.doesNotMatch(name, /campaign name|untitled|unnamed/i);
});

test("B. the dialog shows the real count and keeps the name optional", () => {
  const dialog = read(
    "features/campaign-studio/components/sections/shared/studio-generate-shortlist-dialog.tsx"
  );
  assert.match(dialog, /\{selectedCount\} selected creator/);
  assert.match(dialog, /placeholder="Optional"/);
  // Confirm is never gated on the campaign name — only on the selection, and
  // on a chosen shortlist in the existing branch.
  assert.doesNotMatch(dialog, /disabled=\{[^}]*campaignName/);
  assert.match(dialog, /mode === "existing" && !selectedShortlistId/);
});

test("B. generation reuses the existing shortlist helpers, batched", () => {
  const action = read("features/campaign-studio/actions/vendor-recommendation-actions.ts");
  const generate = action.slice(action.indexOf("export async function generateStudioShortlistAction"));
  assert.match(generate, /createShortlistV2/);
  assert.match(generate, /addCreatorsToShortlistsV2/);
  assert.match(generate, /resolveGeneratedShortlistName\(input\.campaignName\)/);
  // One batched call, not a loop of single adds.
  assert.match(generate, /creators: unifiedIds\.map/);
  assert.doesNotMatch(generate, /for \(const .* of unifiedIds\)[\s\S]{0,200}addCreatorsToShortlistsV2/);
});

test("B. success reports what the write actually did", () => {
  const action = read("features/campaign-studio/actions/vendor-recommendation-actions.ts");
  const generate = action.slice(action.indexOf("export async function generateStudioShortlistAction"));
  assert.match(generate, /addResult\.added/);
  assert.match(generate, /addResult\.alreadyOnList/);
  // A failed write can never report ok.
  assert.match(generate, /if \(!addResult\.ok\) \{\s*return \{\s*ok: false/);
});

test("B. a failed generation keeps the selection and allows a retry", () => {
  const source = read(
    "features/campaign-studio/components/sections/vendor-recommendations-section.tsx"
  );
  const handler = source.slice(source.indexOf("async function generateShortlist"));
  const body = handler.slice(0, handler.indexOf("\n  }\n"));
  assert.match(body, /setGenerateError\(result\.message\)/);
  // Nothing clears the selection on the failure path.
  assert.doesNotMatch(body, /setSelectionOverlay|setVendorDecisions\(\{\}\)/);
  // The dialog stays open so the operator can retry.
  assert.ok(
    body.indexOf("setGenerateOpen(false)") > body.indexOf("setGenerateError(result.message)"),
    "the dialog only closes after a successful result"
  );
});

// ---------------------------------------------------------------------------
// C. Layout.

test("C. Studio uses the Shortlist/Quotation container treatment", () => {
  const css = read("features/campaign-studio/styles/campaign-studio-ref.css");
  const wrap = css.slice(css.indexOf(".campaign-studio-ref .cs-wrap {"));
  const rule = wrap.slice(0, wrap.indexOf("}"));

  // `DiscoveryPageShell` — behind Shortlist and Quotation — is full width with a
  // px-4 gutter (p-4 md:p-5 in the workspace variant), no max-width, no mx-auto.
  assert.match(rule, /max-width:\s*none/);
  assert.match(rule, /margin:\s*0;/);
  assert.match(rule, /padding:\s*16px 16px/);

  const doc = css.slice(css.indexOf(".campaign-studio-ref .cs-doc {"));
  assert.match(doc.slice(0, doc.indexOf("}")), /max-width:\s*none/);
});

test("C. the reference shell really is full width with that gutter", () => {
  // The rule Studio is being aligned to, asserted at its source.
  const shell = read("features/discovery/components/discovery-page-shell.tsx");
  assert.match(shell, /containedMain/);
  assert.match(shell, /px-4/);
  assert.doesNotMatch(shell, /max-w-\[|max-w-screen|mx-auto/);
});

test("C. the selection panel is a RIGHT-side column that stacks when narrow", () => {
  const source = read(
    "features/campaign-studio/components/sections/vendor-recommendations-section.tsx"
  );
  // Two columns from `xl`: content first, panel second — so it renders right.
  assert.match(source, /xl:grid-cols-\[minmax\(0,1fr\)_320px\]/);
  assert.match(source, /grid-cols-1/, "one column below that width");
  const root = source.slice(source.indexOf("xl:grid-cols-[minmax(0,1fr)_320px]"));
  assert.ok(
    root.indexOf("{selectionPanel}") > root.indexOf('<div className="min-w-0 space-y-2">'),
    "the panel follows the main area in DOM order"
  );
});

test("C. no fixed width can force horizontal overflow", () => {
  const panel = read(
    "features/campaign-studio/components/sections/shared/studio-creator-selection-panel.tsx"
  );
  assert.doesNotMatch(panel, /w-\[\d+px\]|min-w-\[\d+px\]/);
  const source = read(
    "features/campaign-studio/components/sections/vendor-recommendations-section.tsx"
  );
  assert.match(source, /grid min-w-0/, "the grid may shrink below its content");
});

// ---------------------------------------------------------------------------
// D. Truthful loading.

test("D. the panel shows pending per creator, not a blanket spinner", () => {
  const selected = resolveStudioCreatorSelection({
    vendors: VENDORS,
    decisions: decisions({ "inf:a": "shortlisted", "inf:b": "shortlisted" }),
    pendingIds: ["inf:a"],
  });
  assert.equal(selected.find((c) => c.creatorId === "inf:a")!.pending, true);
  assert.equal(selected.find((c) => c.creatorId === "inf:b")!.pending, false);
});

test("D. every touched action names what is running", () => {
  const source = read(
    "features/campaign-studio/components/sections/vendor-recommendations-section.tsx"
  );
  for (const label of ["Adding…", "Removing…", "Replacing…", "Approving…", "Moving…"]) {
    assert.ok(source.includes(label) || read(
      "features/campaign-studio/components/sections/shared/studio-creator-selection-panel.tsx"
    ).includes(label), label);
  }
  const panel = read(
    "features/campaign-studio/components/sections/shared/studio-creator-selection-panel.tsx"
  );
  assert.match(panel, /Generating Shortlist…/);
});

test("D. no completed state is shown while the action is still running", () => {
  const source = read(
    "features/campaign-studio/components/sections/vendor-recommendations-section.tsx"
  );
  // The Approve label checks `isPending` BEFORE reporting the decision state.
  const approve = source.slice(source.indexOf("Truthful:"));
  assert.match(approve.slice(0, 320), /isPending\s*\n?\s*\?[\s\S]{0,120}"Approving…"/);

  const panel = read(
    "features/campaign-studio/components/sections/shared/studio-creator-selection-panel.tsx"
  );
  assert.match(panel, /generating \?/, "Generate reports its own pending state");
});

test("D. the selection is derived, so a pending action cannot desync it", () => {
  const source = read(
    "features/campaign-studio/components/sections/vendor-recommendations-section.tsx"
  );
  // One derivation feeds the panel and the card buttons. It is now
  // `resolveStudioDecisionRows`, which carries approval alongside selection on
  // the same row rather than deriving the two from separate passes.
  assert.match(source, /resolveStudioDecisionRows\(\{/);
  assert.match(source, /const selectedForShortlist = decisionRows\.filter\(\(row\) => row\.selected\)/);
  assert.match(source, /decisionState=\{/, "the cards read the same derived rows");
  assert.equal(
    (source.match(/useState<StudioDecisionOverlay>/g) ?? []).length,
    1,
    "exactly one optimistic overlay, and no second selection store"
  );
});
