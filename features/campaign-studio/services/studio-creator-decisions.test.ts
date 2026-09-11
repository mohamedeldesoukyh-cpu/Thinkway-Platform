/**
 * Creator actions must not move the page, and approval must not vanish.
 *
 * Two defects, reported from Dev and root-caused in code:
 *
 *   1. APPROVAL DISAPPEARED after a shortlist action. `vendorDecisions` stores
 *      ONE value per creator, and both decision actions rebuilt that map from
 *      the draft changes ALONE while the component replaced its state with the
 *      result — so an applied decision vanished and, because the approve
 *      rebuild never looked at `shortlist_creator`, selecting an approved
 *      creator wiped its approval.
 *   2. THE VIEWPORT JUMPED on every click, because the decision result was
 *      pushed upward as a rebuilt campaign object: every memo recomputed, the
 *      mast re-rendered and rewrote `--studio-chrome-height`, and the resolved
 *      workspace step could change with the new statuses — swapping the
 *      rendered section out from under the operator.
 *
 * The fix keeps the existing state model: approval and selection already live
 * apart in the draft (`approve_creator` vs `shortlist_creator`), so both are
 * DERIVED from the persisted decisions plus the draft rather than flattened
 * into one map. No new store, no new server action for approval, and the rule
 * from 5cd4df24 still holds — only Generate Shortlist writes a shortlist.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import type { StudioDraftChange } from "@/features/campaign-intelligence/types/section-schemas";

import {
  approvedNotSelected,
  resolveCreatorDecisionState,
  resolveStudioDecisionRows,
  withOptimisticDecision,
  withoutOptimisticDecision,
  type StudioDecisionOverlay,
} from "./studio-creator-decisions";
import { unstageDraftChange } from "./studio-draft";

const read = (file: string) => readFileSync(file, "utf8");

/** Source with comments stripped — a rule has to hold in the shipped code. */
const readCode = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

const SECTION =
  "features/campaign-studio/components/sections/vendor-recommendations-section.tsx";
const PANEL =
  "features/campaign-studio/components/sections/shared/studio-creator-selection-panel.tsx";
const ACTIONS = "features/campaign-studio/actions/vendor-recommendation-actions.ts";

const VENDORS = [
  { id: "inf:a", displayName: "Creator A", handle: "@a", platform: "instagram", avatarUrl: "a.jpg" },
  { id: "inf:b", displayName: "Creator B", handle: "@b", platform: "tiktok" },
  { id: "inf:c", displayName: "Creator C", handle: "@c", platform: "instagram" },
];

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
const reject = (creatorId: string): StudioDraftChange => ({
  kind: "reject_creator",
  creatorId,
  stagedAt: at,
});

const state = (creatorId: string, changes: StudioDraftChange[], persisted = {}) =>
  resolveCreatorDecisionState({ creatorId, persisted, changes });

const rows = (changes: StudioDraftChange[], persisted = {}, overlay?: StudioDecisionOverlay) =>
  resolveStudioDecisionRows({ vendors: VENDORS, persisted, changes, overlay });

// ---------------------------------------------------------------------------
// A. Approve.

test("A. approving a creator sets approval and nothing else", () => {
  const decision = state("inf:a", [approve("inf:a")]);
  assert.equal(decision.approved, true);
  assert.equal(decision.selected, false, "approval is not a shortlist selection");
  assert.equal(decision.rejected, false);
});

test("A. the button reads Approve, then Unapprove — one control, two states", () => {
  const code = readCode(SECTION);
  const button = code.slice(code.indexOf("aria-pressed={decisionState.approved}"));
  const body = button.slice(0, button.indexOf("</button>"));
  // The label and the handler both follow the SAME derived fact.
  assert.match(body, /decisionState\.approved\s*\n?\s*\?\s*"Unapprove"\s*\n?\s*:\s*"Approve"/);
  assert.match(body, /decisionState\.approved[\s\S]{0,120}onUnapprove\(vendor\.id\)/);
  assert.match(body, /onApprove\(vendor\.id, vendor\.displayName\)/);
  // Approved is visually distinct, not a disabled clone of Approve.
  assert.match(body, /!bg-\[#0C9D57\][\s\S]{0,60}!text-white/);
  assert.doesNotMatch(body, /disabled=\{[^}]*decisionState\.approved/);
  assert.doesNotMatch(body, /Approved \(staged\)/);
});

test("A. the approved count follows the derived rows", () => {
  const approvedCount = (changes: StudioDraftChange[]) =>
    rows(changes).filter((row) => row.approved).length;
  assert.equal(approvedCount([]), 0);
  assert.equal(approvedCount([approve("inf:a")]), 1);
  assert.equal(approvedCount([approve("inf:a"), approve("inf:b")]), 2);
  // A selection is not counted as an approval.
  assert.equal(approvedCount([approve("inf:a"), select("inf:b")]), 1);
});

test("A. an approval already committed by Apply still reads approved", () => {
  // The regression: the actions rebuilt the map from the draft alone, so a
  // persisted decision with no staged change reported as not approved.
  const decision = resolveCreatorDecisionState({
    creatorId: "inf:a",
    persisted: { "inf:a": "approved" },
    changes: [],
  });
  assert.equal(decision.approved, true);
});

// ---------------------------------------------------------------------------
// B. Unapprove.

test("B. unapproving clears only the approval", () => {
  const draft = { changes: [approve("inf:a"), select("inf:a")], updatedAt: at };
  const next = unstageDraftChange(draft, "inf:a", { kind: "approve_creator" });

  const decision = state("inf:a", next.changes);
  assert.equal(decision.approved, false, "the approval is gone");
  assert.equal(decision.selected, true, "the selection is untouched");
  assert.deepEqual(next.changes.map((change) => change.kind), ["shortlist_creator"]);
});

test("B. removing from the selection clears only the selection", () => {
  const draft = { changes: [approve("inf:a"), select("inf:a")], updatedAt: at };
  const next = unstageDraftChange(draft, "inf:a", { kind: "shortlist_creator" });

  const decision = state("inf:a", next.changes);
  assert.equal(decision.approved, true, "the approval survives");
  assert.equal(decision.selected, false);
});

test("B. undo with no kind still clears everything staged for the creator", () => {
  // The card's "Undo removal" keeps its existing meaning.
  const draft = { changes: [approve("inf:a"), select("inf:a"), approve("inf:b")], updatedAt: at };
  const next = unstageDraftChange(draft, "inf:a");
  assert.deepEqual(next.changes.map((change) => change.creatorId), ["inf:b"]);
});

test("B. the approved count decrements, and the row leaves the Approved list", () => {
  const before = rows([approve("inf:a"), approve("inf:b")]);
  assert.equal(before.filter((row) => row.approved).length, 2);

  const draft = { changes: [approve("inf:a"), approve("inf:b")], updatedAt: at };
  const after = rows(unstageDraftChange(draft, "inf:a", { kind: "approve_creator" }).changes);
  assert.deepEqual(after.filter((row) => row.approved).map((row) => row.creatorId), ["inf:b"]);
});

test("B. unapprove reaches the one action that clears a single decision", () => {
  const code = readCode(ACTIONS);
  const clear = code.slice(code.indexOf("export async function clearVendorDecisionAction"));
  assert.match(clear, /kind: input\.decision === "approved" \? "approve_creator" : "shortlist_creator"/);
  // It stages nothing and writes no shortlist.
  assert.doesNotMatch(clear.slice(0, clear.indexOf("\n}")), /createShortlistV2|addCreatorsToShortlistsV2/);
});

// ---------------------------------------------------------------------------
// C. Persistence across actions.

test("C. approve A, select B, approve C — A and C stay approved", () => {
  const changes = [approve("inf:a"), select("inf:b"), approve("inf:c")];
  assert.equal(state("inf:a", changes).approved, true);
  assert.equal(state("inf:c", changes).approved, true);
  assert.equal(state("inf:b", changes).selected, true);
  assert.equal(state("inf:b", changes).approved, false);
});

test("C. selecting an approved creator does not remove its approval", () => {
  // The exact Dev report.
  const decision = state("inf:a", [approve("inf:a"), select("inf:a")]);
  assert.equal(decision.approved, true);
  assert.equal(decision.selected, true);
});

test("C. approving a selected creator does not remove its selection", () => {
  const decision = state("inf:a", [select("inf:a"), approve("inf:a")]);
  assert.equal(decision.approved, true);
  assert.equal(decision.selected, true);
});

test("C. no decision action rebuilds the whole decision map", () => {
  const code = readCode(ACTIONS);
  for (const name of [
    "decideVendorRecommendationAction",
    "selectCreatorForShortlistAction",
    "clearVendorDecisionAction",
  ]) {
    const start = code.indexOf(`export async function ${name}`);
    assert.ok(start > -1, name);
    const body = code.slice(start, code.indexOf("\n}", start));
    assert.doesNotMatch(body, /vendorDecisions/, `${name} must not project a flattened map`);
  }
  // And nothing replaces the component's decision state with a server map.
  assert.doesNotMatch(readCode(SECTION), /setVendorDecisions\(/);
});

test("C. approval and selection reach different draft entries", () => {
  const code = readCode(ACTIONS);
  const decide = code.slice(code.indexOf("export async function decideVendorRecommendationAction"));
  assert.match(decide.slice(0, 900), /"approve_creator"/);
  const selectAction = code.slice(
    code.indexOf("export async function selectCreatorForShortlistAction")
  );
  assert.match(selectAction.slice(0, 900), /kind: "shortlist_creator"/);
});

// ---------------------------------------------------------------------------
// D. Approved → Selection.

test("D. adding one approved creator selects it and keeps it approved", () => {
  const changes = [approve("inf:a")];
  assert.deepEqual(approvedNotSelected(rows(changes)).map((row) => row.creatorId), ["inf:a"]);

  const after = [...changes, select("inf:a")];
  const row = rows(after).find((item) => item.creatorId === "inf:a")!;
  assert.equal(row.selected, true);
  assert.equal(row.approved, true, "adding to the selection is not a re-decision");
  assert.deepEqual(approvedNotSelected(rows(after)), []);
});

test("D. the panel's Add goes to the selection action, not a shortlist write", () => {
  const code = readCode(SECTION);
  assert.match(code, /onAddApproved=\{\(creatorId\) => void selectCreator\(creatorId\)\}/);
  const panel = readCode(PANEL);
  assert.doesNotMatch(panel, /createShortlistV2|addCreatorsToShortlistsV2/);
  // The already-added row offers no second Add.
  assert.match(panel, /creator\.selected \?[\s\S]{0,400}Added/);
});

test("D. an approved creator appears once, carrying both facts", () => {
  const row = rows([approve("inf:a"), select("inf:a")]).filter(
    (item) => item.creatorId === "inf:a"
  );
  assert.equal(row.length, 1);
  assert.equal(row[0]!.approved && row[0]!.selected, true);
  assert.match(readCode(PANEL), /"Approved · Selected"/);
});

// ---------------------------------------------------------------------------
// E. Add all approved.

test("E. add all approved adds exactly the approved-but-unselected creators", () => {
  const changes = [approve("inf:a"), approve("inf:b"), select("inf:b"), select("inf:c")];
  assert.deepEqual(approvedNotSelected(rows(changes)).map((row) => row.creatorId), ["inf:a"]);
});

test("E. nothing is added twice, and approval is unchanged", () => {
  const changes = [approve("inf:a"), approve("inf:b")];
  const toAdd = approvedNotSelected(rows(changes)).map((row) => row.creatorId);
  const after = [...changes, ...toAdd.map(select)];

  const resolved = rows(after);
  assert.equal(resolved.length, 2, "no creator is duplicated");
  assert.ok(resolved.every((row) => row.approved && row.selected));
  assert.deepEqual(approvedNotSelected(resolved), [], "a second run adds nothing");
});

test("E. the button is disabled once every approved creator is selected", () => {
  const panel = readCode(PANEL);
  assert.match(panel, /disabled=\{!canAct \|\| addingApproved \|\| approvedToAdd\.length === 0\}/);
  assert.match(panel, /Add all approved \(\$\{approvedToAdd\.length\}\)/);
  assert.match(panel, /All approved are in the selection/);
});

test("E. add all approved runs the selection action per creator", () => {
  const code = readCode(SECTION);
  const handler = code.slice(code.indexOf("async function addAllApproved"));
  const body = handler.slice(0, handler.indexOf("\n  }\n"));
  assert.match(body, /approvedToAdd\.map\(\(row\) => row\.creatorId\)/);
  assert.match(body, /await selectCreator\(creatorId\)/);
  assert.doesNotMatch(body, /generateStudioShortlistAction|createShortlistV2/);
});

// ---------------------------------------------------------------------------
// F. Generation stays the only persistence point.

test("F. no approval path can create a shortlist", () => {
  const code = readCode(SECTION);
  for (const name of ["approveCreator", "unapproveCreator", "selectCreator", "deselectCreator"]) {
    const start = code.indexOf(`const ${name} = useCallback`);
    assert.ok(start > -1, name);
    const body = code.slice(start, code.indexOf("\n  );", start));
    assert.doesNotMatch(body, /generateStudioShortlistAction|ShortlistV2/, name);
  }
});

test("F. only the generate action touches the shortlist helpers", () => {
  const code = readCode(ACTIONS);
  const generate = code.indexOf("export async function generateStudioShortlistAction");
  for (const match of code.matchAll(/createShortlistV2|addCreatorsToShortlistsV2/g)) {
    // The import is the only occurrence allowed before the generate action.
    const before = code.slice(0, match.index!);
    assert.ok(
      match.index! > generate || /import \{[^}]*$/.test(before.slice(-120)),
      `shortlist helper reached outside generation at ${match.index}`
    );
  }
});

test("F. generation is still driven from the confirmed dialog only", () => {
  const code = readCode(SECTION);
  assert.match(code, /onConfirm=\{\(confirmation\) => void generateShortlist\(confirmation\)\}/);
  assert.match(code, /onGenerate=\{\(\) => \{[\s\S]{0,120}setGenerateOpen\(true\)/);
});

// ---------------------------------------------------------------------------
// G. State independence — every combination is valid.

test("G. approved only / selected only / both / neither", () => {
  const cases: Array<[StudioDraftChange[], boolean, boolean]> = [
    [[], false, false],
    [[approve("inf:a")], true, false],
    [[select("inf:a")], false, true],
    [[approve("inf:a"), select("inf:a")], true, true],
  ];
  for (const [changes, approved, selected] of cases) {
    const decision = state("inf:a", changes);
    assert.equal(decision.approved, approved, JSON.stringify(changes.map((c) => c.kind)));
    assert.equal(decision.selected, selected, JSON.stringify(changes.map((c) => c.kind)));
  }
});

test("G. unapproved + selected keeps the creator on the selection", () => {
  const draft = { changes: [approve("inf:a"), select("inf:a")], updatedAt: at };
  const next = unstageDraftChange(draft, "inf:a", { kind: "approve_creator" });
  const resolved = rows(next.changes);
  assert.deepEqual(resolved.map((row) => row.creatorId), ["inf:a"]);
  assert.equal(resolved[0]!.selected, true);
  assert.equal(resolved[0]!.approved, false);
});

test("G. rejecting clears approval, and approving clears the rejection", () => {
  assert.equal(state("inf:a", [approve("inf:a"), reject("inf:a")]).approved, false);
  assert.equal(state("inf:a", [approve("inf:a"), reject("inf:a")]).rejected, true);
  assert.equal(state("inf:a", [reject("inf:a"), approve("inf:a")]).approved, true);
  assert.equal(state("inf:a", [reject("inf:a"), approve("inf:a")]).rejected, false);
});

test("G. the optimistic overlay is per creator AND per decision", () => {
  let overlay: StudioDecisionOverlay = {};
  overlay = withOptimisticDecision(overlay, "inf:a", { approved: true });
  // Keyed by canonical creator identity, so `inf:a` and `a` are one creator.
  overlay = withOptimisticDecision(overlay, "a", { selected: true });
  assert.deepEqual(overlay, { a: { approved: true, selected: true } });

  // Dropping one field leaves the other in flight.
  overlay = withoutOptimisticDecision(overlay, "inf:a", "approved");
  assert.deepEqual(overlay, { a: { selected: true } });
  overlay = withoutOptimisticDecision(overlay, "inf:a", "selected");
  assert.deepEqual(overlay, {}, "a spent overlay leaves no residue");
});

test("G. the overlay answers immediately and yields to the canonical state", () => {
  // Approving shows instantly, without dropping the existing selection.
  const overlay = withOptimisticDecision({}, "inf:a", { approved: true });
  const optimistic = resolveCreatorDecisionState({
    creatorId: "inf:a",
    persisted: { "inf:a": "shortlisted" },
    changes: [],
    overlay,
  });
  assert.equal(optimistic.approved, true);
  assert.equal(optimistic.selected, true);

  // Once the draft carries the approval, the overlay is no longer needed.
  const settled = resolveCreatorDecisionState({
    creatorId: "inf:a",
    persisted: { "inf:a": "shortlisted" },
    changes: [approve("inf:a")],
    overlay: withoutOptimisticDecision(overlay, "inf:a", "approved"),
  });
  assert.deepEqual(settled, { approved: true, selected: true, rejected: false });
});

test("G. one creator cannot split in two across id prefixes", () => {
  const resolved = resolveStudioDecisionRows({
    vendors: [{ id: "dis:a", displayName: "Creator A" }, { id: "inf:a", displayName: "Creator A" }],
    persisted: { "inf:a": "approved" },
    changes: [select("dis:a")],
  });
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0]!.approved && resolved[0]!.selected, true);
});

// ---------------------------------------------------------------------------
// H. No global remount, and no scroll hack standing in for one.

test("H. no decision state is used as a React key", () => {
  const code = readCode(SECTION);
  for (const match of code.matchAll(/key=\{([^}]*)\}/g)) {
    const expression = match[1]!;
    assert.doesNotMatch(
      expression,
      /approved|selected|pending|decision|loading|isPending/i,
      `changing state used as a key: ${expression}`
    );
  }
  // The creator row keys on identity alone.
  assert.match(code, /key=\{vendor\.id \?\? `\$\{vendor\.handle\}-\$\{index\}`\}/);
});

test("H. a decision does not push a rebuilt campaign object upward", () => {
  const code = readCode(SECTION);
  const runner = code.slice(code.indexOf("const runCreatorDecision = useCallback"));
  const body = runner.slice(0, runner.indexOf("\n  );"));
  // The draft is published; the campaign object is not rebuilt or re-emitted.
  assert.match(body, /publishDraft\(result\.draft\)/);
  assert.doesNotMatch(body, /onVendorDecisionsUpdated|setMessages|deserializeCampaignObject/);
  assert.doesNotMatch(body, /router\.refresh|router\.push|window\.location/);
});

test("H. there is no global loading state replacing the creator list", () => {
  const code = readCode(SECTION);
  const runner = code.slice(code.indexOf("const runCreatorDecision = useCallback"));
  const body = runner.slice(0, runner.indexOf("\n  );"));
  // Pending is per creator, and the derived rows carry it per row.
  assert.match(body, /setPendingCreatorId\(creatorId\)/);
  assert.match(code, /pendingIds: pendingCreatorId \? \[pendingCreatorId\] : \[\]/);
  assert.doesNotMatch(code, /setLoadingAll|isLoadingCreators|globalLoading/);
});

test("H. the remount is prevented, not compensated for by scrolling", () => {
  const code = readCode(SECTION);
  assert.doesNotMatch(code, /window\.scrollTo|scrollIntoView|restoreScrollPosition/);
  assert.doesNotMatch(readCode(PANEL), /window\.scrollTo|scrollIntoView/);
});

test("H. a status change cannot swap the rendered workspace step", () => {
  // `defaultStudioWorkspaceStep` reads step STATUSES, so a decision that moves
  // a step from in_progress to current used to re-resolve the default and
  // render a different section under the operator.
  // Pinned at mount, so re-resolving cannot move the operator. Clicking a step
  // still works: `goToStep` sets `activeStepId`, which wins.
  const studio = readCode("features/campaign-studio/components/campaign-studio.tsx");
  assert.match(
    studio,
    /const \[pinnedDefaultStepId\] = useState<StudioWorkspaceStepId \| null>\(\(\) =>/
  );
  assert.match(studio, /activeStepId \?\? pinnedDefaultStepId/);
});

test("H. the chrome height variable is only written when it changes", () => {
  // Rewriting it on every render re-laid out the shell, which read as a jump.
  const chrome = readCode("features/campaign-studio/components/studio-top-chrome.tsx");
  const publish = chrome.slice(chrome.indexOf("function publishChromeHeight"));
  const body = publish.slice(0, publish.indexOf("\n}"));
  assert.match(body, /getPropertyValue\("--studio-chrome-height"\) !== height/);
  assert.equal(
    (body.match(/setProperty\("--studio-chrome-height"/g) ?? []).length,
    2,
    "both writes are guarded"
  );
});

// ---------------------------------------------------------------------------
// I. Action failure.

test("I. a failed approval reverts only that creator's approval", () => {
  // The overlay field is dropped in `finally`, so the canonical state — which
  // the failed action never changed — answers again. Nothing else is touched.
  const code = readCode(SECTION);
  const runner = code.slice(code.indexOf("const runCreatorDecision = useCallback"));
  const body = runner.slice(0, runner.indexOf("\n  );"));
  assert.match(body, /if \(!result\.ok\) \{[\s\S]{0,120}toast\.error\(result\.message\)/);
  assert.ok(
    body.indexOf("finally") > body.indexOf("if (!result.ok)"),
    "the overlay is cleared however the action ends"
  );
  assert.match(body, /finally \{[\s\S]{0,220}withoutOptimisticDecision\(overlay, creatorId, field\)/);
  assert.doesNotMatch(body, /setDecisionOverlay\(\{\}\)/, "no blanket overlay reset");
});

test("I. the reverted creator keeps its other decision, and others keep theirs", () => {
  // Approving inf:a fails: its overlay field is dropped and the draft is
  // unchanged, so inf:a is selected-but-not-approved and inf:b stays approved.
  const changes = [select("inf:a"), approve("inf:b")];
  const overlay = withoutOptimisticDecision(
    withOptimisticDecision({}, "inf:a", { approved: true }),
    "inf:a",
    "approved"
  );
  const resolved = resolveStudioDecisionRows({
    vendors: VENDORS,
    persisted: {},
    changes,
    overlay,
  });
  const a = resolved.find((row) => row.creatorId === "inf:a")!;
  assert.equal(a.approved, false);
  assert.equal(a.selected, true, "the failed approval did not drop the selection");
  assert.equal(resolved.find((row) => row.creatorId === "inf:b")!.approved, true);
});

test("I. a failure never clears the pending marker for a different creator", () => {
  const resolved = resolveStudioDecisionRows({
    vendors: VENDORS,
    persisted: {},
    changes: [approve("inf:a"), approve("inf:b")],
    pendingIds: ["inf:a"],
  });
  assert.equal(resolved.find((row) => row.creatorId === "inf:a")!.pending, true);
  assert.equal(resolved.find((row) => row.creatorId === "inf:b")!.pending, false);
});
