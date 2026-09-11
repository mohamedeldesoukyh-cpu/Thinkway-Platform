/**
 * What Apply Changes means, and one statement per fact on the Creators screen.
 *
 * Two things were wrong on the Dev screen:
 *
 *   1. "1 pending change — click Apply Changes to update creators and
 *      regenerate the plan" over "1 approval · staged edits preview in Vendor
 *      Recommendations until apply" named neither the decision that is staged
 *      nor the one action that writes a shortlist. Three different operations
 *      exist — Approve stages a decision, Apply commits it and reconciles the
 *      plan, Generate Shortlist persists a shortlist — and the bar described
 *      none of them.
 *   2. The same facts were stated three to six times before the operator
 *      reached a creator card: the quantity recommendation, the shortfall, the
 *      Discovery pipeline counts and the creator-strategy thesis each appeared
 *      in two or three consecutive blocks, and the two shortfall lines used
 *      identical words over different numbers ("6 recommended · 4 shortfall"
 *      then "5 recommended · 5 shortfall") so they read as a contradiction.
 *
 * Apply is KEPT: the draft is a real two-phase commit — staged decisions live
 * on `creators.data.studioDraft`, and only Apply writes them into
 * `vendorDecisions`, applies membership edits to `recommendations.creatorIds`
 * and reconciles the plan. These tests pin that behaviour and the
 * one-statement-per-fact layout.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { buildCampaignObjectFixture } from "@/features/campaign-outputs/output-test-fixture";
import { getCampaignOutput, generateCampaignOutput, markStaleCampaignOutputs } from "@/features/campaign-outputs/output-registry";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type {
  CreatorsSectionData,
  StudioDraftChange,
} from "@/features/campaign-intelligence/types/section-schemas";

import { resolveCreatorDecisionState, resolveStudioDecisionRows } from "./studio-creator-decisions";
import { applicableDraftChanges, applyStudioDraftChanges } from "./studio-draft";
import { outdatedStudioSections } from "./studio-facts-freshness";
import { resolveStudioPackageReadiness } from "./studio-package-readiness";

const read = (file: string) => readFileSync(file, "utf8");
const readCode = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

const BAR = "features/campaign-studio/components/studio-draft-bar.tsx";
const HEADER = "features/campaign-studio/components/workspace/creators-mix-header.tsx";
const DISCOVERY = "features/campaign-studio/components/sections/vendor-discovery-section.tsx";
const CARDS = "features/campaign-studio/components/sections/vendor-recommendations-section.tsx";
const PANEL =
  "features/campaign-studio/components/sections/shared/studio-creator-selection-panel.tsx";
const WORKSPACE = "features/campaign-studio/components/workspace/studio-workspace-screen.tsx";

const at = "2026-05-01T00:00:00.000Z";
const approve = (creatorId: string): StudioDraftChange => ({
  kind: "approve_creator",
  creatorId,
  stagedAt: at,
});
const select = (creatorId: string): StudioDraftChange => ({
  kind: "shortlist_creator",
  creatorId,
  stagedAt: at,
});

function withDraft(changes: StudioDraftChange[]): CampaignObject {
  const object = buildCampaignObjectFixture();
  const creatorsData = (object.sections.creators.data ?? {}) as CreatorsSectionData;
  object.sections.creators.data = {
    ...creatorsData,
    studioDraft: { changes, updatedAt: at },
  } as unknown as Record<string, unknown>;
  return object;
}

const creatorsDataOf = (object: CampaignObject) =>
  (object.sections.creators.data ?? {}) as CreatorsSectionData;

// ---------------------------------------------------------------------------
// A. What Apply Changes is, and what it does.

test("A. a staged decision is not committed until Apply", () => {
  const object = withDraft([approve("cr_macro1")]);
  // Staged: readable from the draft, absent from the persisted decisions.
  assert.equal(creatorsDataOf(object).vendorDecisions, undefined);
  assert.equal(
    resolveCreatorDecisionState({
      creatorId: "cr_macro1",
      persisted: creatorsDataOf(object).vendorDecisions,
      changes: creatorsDataOf(object).studioDraft?.changes,
    }).approved,
    true
  );

  const applied = applyStudioDraftChanges(object).campaignObject;
  assert.equal(creatorsDataOf(applied).vendorDecisions?.["cr_macro1"], "approved");
});

test("A. Apply commits approvals and keeps the selection staged", () => {
  const object = withDraft([approve("cr_macro1"), approve("cr_macro2"), select("cr_micro1")]);
  const result = applyStudioDraftChanges(object);
  const data = creatorsDataOf(result.campaignObject);

  assert.equal(data.vendorDecisions?.["cr_macro1"], "approved");
  assert.equal(data.vendorDecisions?.["cr_macro2"], "approved");
  // Selection is the working set for Generate Shortlist, so Apply leaves it
  // staged rather than discarding it.
  assert.deepEqual(result.unappliedChanges.map((change) => change.kind), ["shortlist_creator"]);

  const rows = resolveStudioDecisionRows({
    vendors: [
      { id: "cr_macro1", displayName: "A" },
      { id: "cr_macro2", displayName: "B" },
      { id: "cr_micro1", displayName: "C" },
    ],
    persisted: data.vendorDecisions,
    changes: data.studioDraft?.changes,
  });
  assert.deepEqual(
    rows.map((row) => `${row.creatorId}:${row.approved ? "A" : ""}${row.selected ? "S" : ""}`),
    ["cr_macro1:A", "cr_macro2:A", "cr_micro1:S"]
  );
});

test("A. an approved AND selected creator keeps both after Apply", () => {
  const object = withDraft([approve("cr_macro1"), select("cr_macro1")]);
  const data = creatorsDataOf(applyStudioDraftChanges(object).campaignObject);
  const state = resolveCreatorDecisionState({
    creatorId: "cr_macro1",
    persisted: data.vendorDecisions,
    changes: data.studioDraft?.changes,
  });
  assert.equal(state.approved && state.selected, true);
});

test("A. Apply does not change slate membership for a decision-only draft", () => {
  const object = withDraft([approve("cr_macro1"), select("cr_micro1")]);
  const before = creatorsDataOf(object).recommendations?.creatorIds ?? [];
  const after =
    creatorsDataOf(applyStudioDraftChanges(object).campaignObject).recommendations?.creatorIds ?? [];
  assert.deepEqual(after, before);
});

test("A. Apply on a decision-only draft does not stale the generated outputs", () => {
  // The output fingerprint is built from the slate, not from decisions, so a
  // committed approval leaves Content, Commercial, Timeline and the client
  // documents exactly as generated.
  let object = buildCampaignObjectFixture();
  for (const kind of ["full_strategy", "executive_proposal", "content_calendar"] as const) {
    ({ campaignObject: object } = generateCampaignOutput(object, kind));
  }
  const creatorsData = creatorsDataOf(object);
  object.sections.creators.data = {
    ...creatorsData,
    studioDraft: { changes: [approve("cr_macro1")], updatedAt: at },
  } as unknown as Record<string, unknown>;

  const applied = markStaleCampaignOutputs(applyStudioDraftChanges(object).campaignObject);
  for (const kind of ["full_strategy", "executive_proposal", "content_calendar"] as const) {
    assert.equal(getCampaignOutput(applied, kind)?.status, "generated", kind);
  }
  // And nothing about the Package reads stale from the decision itself.
  const readiness = resolveStudioPackageReadiness(applied, {
    outdatedSections: outdatedStudioSections(applied, { changes: [approve("cr_macro1")], updatedAt: at }),
  });
  for (const id of ["content", "commercial", "timeline"] as const) {
    assert.notEqual(readiness.checks.find((item) => item.id === id)?.state, "outdated", id);
  }
});

test("A. Apply never creates a shortlist", () => {
  const code = readCode("features/campaign-studio/services/studio-draft.ts");
  assert.doesNotMatch(code, /createShortlistV2|addCreatorsToShortlistsV2/);
  const action = readCode("features/campaign-studio/actions/studio-draft-actions.ts");
  assert.doesNotMatch(action, /createShortlistV2|addCreatorsToShortlistsV2/);
  const bar = readCode(BAR);
  assert.doesNotMatch(bar, /ShortlistV2|generateStudioShortlistAction/);
  // Only the generate action may reach the shortlist helpers.
  const recommendationActions = readCode(
    "features/campaign-studio/actions/vendor-recommendation-actions.ts"
  );
  const generate = recommendationActions.indexOf(
    "export async function generateStudioShortlistAction"
  );
  for (const match of recommendationActions.matchAll(/createShortlistV2|addCreatorsToShortlistsV2/g)) {
    const before = recommendationActions.slice(0, match.index!);
    assert.ok(
      match.index! > generate || /import \{[^}]*$/.test(before.slice(-120)),
      "a shortlist helper is reachable outside generation"
    );
  }
});

test("A. Apply reconciles the plan from the applied slate, in one place", () => {
  // "Regenerate the plan" is this chain, and nothing else: re-rank + scores,
  // plan sections, then outputs whose fingerprint actually changed.
  const commit = readCode("features/campaign-studio/services/commit-creator-slate.ts");
  assert.match(commit, /reoptimizeCampaignAfterApply/);
  assert.match(commit, /regeneratePlanSectionsFromSlate/);
  assert.match(commit, /markStaleCampaignOutputs/);
  assert.match(commit, /regenerateStaleCampaignOutputs/);
  const action = readCode("features/campaign-studio/actions/studio-draft-actions.ts");
  assert.match(action, /commitCreatorSlateAndRegeneratePlan/);
});

// ---------------------------------------------------------------------------
// B. The pending-change bar says which action does what.

test("B. the bar names the staged decision, the commit, and the shortlist boundary", () => {
  const bar = read(BAR);
  assert.match(bar, /pending creator decision/);
  assert.match(bar, /Apply Changes commits/);
  assert.match(bar, /Generate Shortlist is separate — only it creates a shortlist/);
  // The ambiguous wording is gone.
  assert.doesNotMatch(bar, /click Apply Changes to update creators and regenerate the plan/);
  assert.doesNotMatch(bar, /staged edits preview in Vendor Recommendations until apply/);
  assert.match(bar, /Discard all/);
  assert.match(bar, /Apply Changes/);
});

test("B. the bar renders only when there is something Apply can commit", () => {
  assert.deepEqual(applicableDraftChanges({ changes: [select("cr_a")], updatedAt: at }), []);
  const bar = readCode(BAR);
  assert.match(bar, /const pending = applicableDraftChanges\(draft\);/);
  assert.match(bar, /if \(pending\.length === 0\) return null;/);
  assert.match(
    readCode("features/campaign-studio/components/campaign-studio.tsx"),
    /applicableDraftChanges\(studioDraft\)\.length > 0/
  );
});

// ---------------------------------------------------------------------------
// C. One statement per fact on the Creators screen.

test("C. the quantity recommendation is stated once", () => {
  // The header owns it — headline, confidence and rationale.
  const header = readCode(HEADER);
  assert.match(header, /Recommended quantity: \{required\} creators/);
  assert.match(header, /Quantity confidence/);
  assert.match(header, /\{quantity\.rationale\}/);
  // The creator list no longer repeats the card, and the Discovery block no
  // longer repeats the number.
  const cards = readCode(CARDS);
  assert.doesNotMatch(cards, /Recommended quantity/);
  assert.doesNotMatch(cards, /confidence in this quantity/);
  assert.doesNotMatch(readCode(DISCOVERY), /Recommended quantity/);
});

test("C. the requested-vs-slate shortfall is stated once", () => {
  const header = readCode(HEADER);
  assert.match(header, /resolveStudioCreatorShortfall/);
  assert.match(header, /shortfall\.summary/);
  assert.doesNotMatch(readCode(CARDS), /resolveStudioCreatorShortfall|slateShortfall/);
});

test("C. the two slate counts are labelled as the different facts they are", () => {
  const cards = readCode(CARDS);
  // Slate membership vs creators clear of the requirement gate — no longer
  // both phrased "N recommended".
  assert.match(cards, /on the campaign slate/);
  assert.match(cards, /campaign-ready/);
  assert.match(cards, /need\{?/);
});

test("C. the Discovery pipeline is not restated in prose", () => {
  const discovery = readCode(DISCOVERY);
  assert.match(discovery, /discovery\.pipeline\.map/, "the pipeline itself stays");
  assert.doesNotMatch(discovery, /recommended from .* profiles screened/);
  assert.doesNotMatch(discovery, /Inventory \{sufficiency\.inventoryCount\}/);
  assert.doesNotMatch(discovery, /Qualified \{sufficiency\.qualifiedCount\}/);
});

test("C. the Discovery explanation and its next action appear once", () => {
  const discovery = readCode(DISCOVERY);
  assert.equal((discovery.match(/sufficiency\.detail/g) ?? []).length, 1);
  assert.equal((discovery.match(/sufficiency\.nextAction/g) ?? []).length, 1);
  // The header carries the STATE only, as a tile — not the prose.
  const header = readCode(HEADER);
  assert.match(header, /label="Discovery" value=\{sufficiency\.title\}/);
  assert.doesNotMatch(header, /sufficiency\.detail/);
  assert.doesNotMatch(header, /sufficiency\.nextAction/);
});

test("C. the creator-strategy explanation is not repeated on Creators", () => {
  const cards = readCode(CARDS);
  assert.doesNotMatch(cards, /Creator strategy · Enterprise Planning Package/);
  assert.doesNotMatch(cards, /creatorPackageThesis/);
  // The slate's provenance survives as one line, without repeating the bar's
  // Apply instruction.
  assert.match(cards, /AI-proposed slate/);
  assert.doesNotMatch(cards, /then Apply Changes to regenerate the full plan/);
});

test("C. genuine, actionable warnings are kept", () => {
  const cards = readCode(CARDS);
  assert.match(cards, /Strategy validation/, "per-tier shortages stay");
  assert.match(cards, /Preferred constraints relaxed/);
  assert.match(cards, /needs review/);
  const discovery = readCode(DISCOVERY);
  assert.match(discovery, /Missing intelligence/);
});

test("C. the operator reaches the creator workspace after three blocks", () => {
  // Action bar (in the Studio shell) → header → Discovery → the creator list.
  const workspace = readCode(WORKSPACE);
  const creatorsStep = workspace.slice(workspace.indexOf('if (step.id === "creators")'));
  const body = creatorsStep.slice(0, creatorsStep.indexOf("StudioStepShell>"));
  assert.match(body, /<CreatorsMixHeader/);
  assert.ok(
    body.indexOf('byId.get("creator-discovery")') < body.indexOf('byId.get("creator-recommendations")'),
    "Discovery summary precedes the creator workspace"
  );
  assert.equal((body.match(/<CreatorsMixHeader/g) ?? []).length, 1);
});

test("C. the Selection panel stays on the right and keeps both sections", () => {
  const cards = readCode(CARDS);
  assert.match(cards, /xl:grid-cols-\[minmax\(0,1fr\)_320px\]/);
  const root = cards.slice(cards.indexOf("xl:grid-cols-[minmax(0,1fr)_320px]"));
  assert.ok(
    root.indexOf("{selectionPanel}") > root.indexOf('<div className="min-w-0 space-y-2">'),
    "the panel follows the main column in DOM order"
  );
  const panel = readCode(PANEL);
  for (const token of ["Selected", "Approved", "Add all approved", "Generate Shortlist"]) {
    assert.ok(panel.includes(token), token);
  }
});

test("C. no new banner was added to solve any of this", () => {
  // The consolidation removes blocks; it must not introduce another toast or
  // card to explain the ones that remain.
  const cards = read(CARDS);
  assert.doesNotMatch(cards, /toast\.(info|message)\(/);
  const header = read(HEADER);
  assert.equal((header.match(/rounded-lg border border-amber/g) ?? []).length, 1);
});
