/**
 * Selecting a creator is NOT generating a shortlist.
 *
 * Reported from Dev: clicking "Add to Shortlist" made the platform create a
 * shortlist mid-selection, and separate shortlists rather than one intentional
 * list. Cause: `applyDecision(..., "shortlist")` called
 * `shortlistVendorRecommendationAction`, which ran `createShortlistV2` on the
 * first pick and `addCreatorsToShortlistsV2` for that creator. Because the
 * linked id is only persisted when the draft is APPLIED, a fresh unapplied
 * draft created another shortlist on the next pick.
 *
 * Three operations, and these tests keep them apart:
 *   A. select a creator      — stage a draft change, nothing persisted;
 *   B. apply a Studio draft  — unchanged;
 *   C. generate a shortlist  — one write, only from the confirmed dialog.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (file: string) => readFileSync(file, "utf8");

/**
 * Source with comments removed.
 *
 * These files deliberately document the bug they fixed, so the old action's
 * name survives in prose. It is the CODE that must no longer reach for it.
 */
const readCode = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

const ACTIONS = "features/campaign-studio/actions/vendor-recommendation-actions.ts";
const SECTION = "features/campaign-studio/components/sections/vendor-recommendations-section.tsx";
const DIALOG =
  "features/campaign-studio/components/sections/shared/studio-generate-shortlist-dialog.tsx";
const PANEL =
  "features/campaign-studio/components/sections/shared/studio-creator-selection-panel.tsx";

/** Source of a named function, to the start of the next top-level export. */
function functionSource(file: string, name: string): string {
  const source = read(file);
  const start = source.indexOf(name);
  assert.notEqual(start, -1, `${name} not found in ${file}`);
  const rest = source.slice(start + name.length);
  const next = rest.search(/\nexport (?:async )?function |\nexport type /);
  return next === -1 ? rest : rest.slice(0, next);
}

// ---------------------------------------------------------------------------
// A. Selection creates nothing.

test("A. the selection action cannot reach a shortlist helper", () => {
  const select = functionSource(ACTIONS, "export async function selectCreatorForShortlistAction");
  assert.doesNotMatch(select, /createShortlistV2/);
  assert.doesNotMatch(select, /addCreatorsToShortlistsV2/);
  assert.doesNotMatch(select, /linkedShortlistId/);
  // It stages a draft change, and that is all.
  assert.match(select, /stageStudioDraftChangeAction/);
  assert.match(select, /kind: "shortlist_creator"/);
});

test("A. the card's + Shortlist click goes to the selection action", () => {
  // The click runs `selectCreator`, which is the only selection path now —
  // `applyDecision`'s old shortlist branch (and the local decision-map rebuild
  // it fed) is gone, so a decision cannot re-create the campaign object.
  const section = read(SECTION);
  const handler = section.slice(section.indexOf("const selectCreator = useCallback"));
  const body = handler.slice(0, handler.indexOf("\n  );"));
  assert.match(body, /selectCreatorForShortlistAction/);
  assert.match(body, /runCreatorDecision\(creatorId, "selected", true/);
  assert.doesNotMatch(body, /createShortlistV2|addCreatorsToShortlistsV2/);
  assert.match(section, /onSelect\(vendor\.id, vendor\.displayName\)/);
});

test("A. the per-creator write path no longer exists anywhere", () => {
  // Keeping it would let the bug return through a re-wire; it had no other
  // caller, so it is gone rather than left unreachable.
  assert.doesNotMatch(readCode(ACTIONS), /shortlistVendorRecommendationAction/);
  assert.doesNotMatch(readCode(SECTION), /shortlistVendorRecommendationAction/);
});

test("A. only the generate action may touch the shortlist helpers", () => {
  const source = read(ACTIONS);
  const generateStart = source.indexOf("export async function generateStudioShortlistAction");
  assert.notEqual(generateStart, -1);

  // Every call site of either helper sits inside the generate action.
  for (const helper of ["createShortlistV2(", "addCreatorsToShortlistsV2("]) {
    let index = source.indexOf(helper);
    let calls = 0;
    while (index !== -1) {
      calls += 1;
      assert.ok(index > generateStart, `${helper} is reachable outside generation`);
      index = source.indexOf(helper, index + 1);
    }
    assert.equal(calls, 1, `${helper} should be called exactly once`);
  }
});

test("A. no selection-adjacent interaction can generate", () => {
  const section = read(SECTION);
  // The select and deselect handlers, and the panel, never call the generator.
  for (const name of ["const selectCreator = useCallback", "const deselectCreator = useCallback"]) {
    const handler = functionSource(SECTION, name);
    assert.doesNotMatch(handler.slice(0, 900), /generateStudioShortlistAction/);
  }
  assert.doesNotMatch(read(PANEL), /generateStudioShortlistAction|createShortlistV2/);
  // Opening the panel is a render, not an effect that writes.
  assert.doesNotMatch(section, /useEffect\([^)]*\)[\s\S]{0,200}generateStudioShortlistAction/);
});

test("A. generation runs only from the confirmed dialog", () => {
  const section = read(SECTION);
  const calls = section.match(/generateStudioShortlistAction\(/g) ?? [];
  assert.equal(calls.length, 1, "one call site");
  // And that call site is the dialog's confirm handler.
  assert.match(section, /onConfirm=\{\(confirmation\) => void generateShortlist\(confirmation\)\}/);
});

// ---------------------------------------------------------------------------
// B / C. One generation, new or existing.

test("B. the whole selection is written in one call", () => {
  const generate = functionSource(ACTIONS, "export async function generateStudioShortlistAction");
  // One batched add for every selected creator — never one call per creator.
  assert.match(generate, /creators: unifiedIds\.map\(\(unifiedId\) => \(\{ unifiedId \}\)\)/);
  assert.doesNotMatch(generate, /for \([^)]*unifiedIds\)[\s\S]{0,300}addCreatorsToShortlistsV2/);
  assert.equal((generate.match(/addCreatorsToShortlistsV2\(/g) ?? []).length, 1);
  assert.equal((generate.match(/createShortlistV2\(/g) ?? []).length, 1);
});

test("B. the new branch creates exactly one shortlist", () => {
  const generate = functionSource(ACTIONS, "export async function generateStudioShortlistAction");
  const newBranch = generate.slice(generate.indexOf("} else {"));
  assert.match(newBranch.slice(0, 400), /createShortlistV2/);
  assert.match(newBranch.slice(0, 400), /resolveGeneratedShortlistName\(input\.campaignName\)/);
});

test("C. the existing branch creates nothing and renames nothing", () => {
  const generate = functionSource(ACTIONS, "export async function generateStudioShortlistAction");
  const existing = generate.slice(
    generate.indexOf('if (mode === "existing")'),
    generate.indexOf("} else {")
  );
  assert.doesNotMatch(existing, /createShortlistV2/);
  assert.doesNotMatch(existing, /campaignName/, "a campaign name is not read in this branch");
  assert.doesNotMatch(existing, /updateShortlist|rename/i);
  assert.match(existing, /input\.shortlistId/);
});

test("C. the existing branch requires a chosen shortlist", () => {
  const generate = functionSource(ACTIONS, "export async function generateStudioShortlistAction");
  assert.match(generate, /Choose a shortlist to add these creators to/);
});

test("C. `new` is the default mode", () => {
  const generate = functionSource(ACTIONS, "export async function generateStudioShortlistAction");
  assert.match(generate, /const mode = input\.mode \?\? "new"/);
});

// ---------------------------------------------------------------------------
// D. Campaign name.

test("D. the new branch offers an optional campaign name", () => {
  const dialog = read(DIALOG);
  const newBranch = dialog.slice(dialog.indexOf('{mode === "new" ? ('), dialog.indexOf(") : ("));
  assert.match(newBranch, /Campaign name/);
  assert.match(newBranch, /placeholder="Optional"/);
});

test("D. the existing branch never asks for a campaign name", () => {
  const dialog = read(DIALOG);
  const existingBranch = dialog.slice(
    dialog.indexOf("Select a shortlist"),
    dialog.indexOf("{error ? (")
  );
  assert.doesNotMatch(existingBranch, /Campaign name/i);
  assert.doesNotMatch(existingBranch, /campaignName/);
});

test("D. confirm is never gated on the campaign name", () => {
  const code = readCode(DIALOG);
  // The confirm button's own `disabled` expression.
  const gate = code.slice(code.lastIndexOf("disabled={"), code.lastIndexOf("onClick={() =>"));
  assert.ok(gate.length > 0, "confirm gate not found");
  assert.doesNotMatch(gate, /campaignName/);
  assert.match(gate, /selectedCount === 0/);
  assert.match(gate, /mode === "existing" && !selectedShortlistId/);
});

// ---------------------------------------------------------------------------
// E. Duplicates, reported honestly.

test("E. duplicates are the helper's business, and are reported as such", () => {
  const generate = functionSource(ACTIONS, "export async function generateStudioShortlistAction");
  // The helper already skips creators already on the list; we report its counts.
  assert.match(generate, /addResult\.added/);
  assert.match(generate, /addResult\.alreadyOnList/);
  assert.match(generate, /\$\{alreadyOnList\} already in shortlist/);
  assert.match(generate, /\$\{unifiedIds\.length\} selected/);
  assert.match(generate, /\$\{added\} added/);
  // The selection size is never reported as the number added.
  assert.doesNotMatch(generate, /\$\{unifiedIds\.length\} added/);
});

test("E. a failed write can never report success", () => {
  const generate = functionSource(ACTIONS, "export async function generateStudioShortlistAction");
  assert.match(generate, /if \(!addResult\.ok\) \{\s*return \{\s*ok: false/);
});

// ---------------------------------------------------------------------------
// F / G. Cancel and failure leave the selection alone.

test("F. cancelling changes nothing", () => {
  const dialog = read(DIALOG);
  const cancel = dialog.slice(dialog.indexOf("Cancel"));
  assert.doesNotMatch(cancel.slice(0, 300), /generateStudioShortlistAction|setSelection/);
  // Cancel only closes the dialog.
  assert.match(dialog, /onClick=\{onCancel\}/);
});

test("G. a failure keeps the selection and stays honest", () => {
  const handler = functionSource(SECTION, "async function generateShortlist");
  const body = handler.slice(0, handler.indexOf("\n  }\n"));
  assert.match(body, /setGenerateError\(result\.message\)/);
  assert.doesNotMatch(body, /setSelectionOverlay|setVendorDecisions\(\{\}\)/);
  assert.ok(
    body.indexOf("setGenerateOpen(false)") > body.indexOf("setGenerateError(result.message)"),
    "the dialog closes only after success"
  );
});

test("G. the selection is never cleared by generation", () => {
  const handler = functionSource(SECTION, "async function generateShortlist");
  // No incidental reset on the success path either — the selection is the
  // operator's, and clearing it is not this action's decision.
  assert.doesNotMatch(handler.slice(0, 1600), /setSelectionOverlay\(\{\}\)/);
});

// ---------------------------------------------------------------------------
// Existing shortlists come from the product's own source.

test("existing shortlists are read from the canonical campaign-scoped action", () => {
  const dialog = read(DIALOG);
  assert.match(dialog, /listStudioShortlistsAction/);
  // No second fetch and no new model.
  assert.doesNotMatch(dialog, /getDiscoveryShortlistsV2|from\("shortlists"\)|supabase/);
});

test("the list is fetched only when the existing branch is chosen", () => {
  const dialog = read(DIALOG);
  assert.match(dialog, /if \(mode !== "existing" \|\| shortlists \|\| !conversationId/);
});

test("no shortlist id is exposed as display text", () => {
  const dialog = read(DIALOG);
  const start = dialog.indexOf("shortlists!.map");
  const row = dialog.slice(start, dialog.indexOf("</fieldset>", start));
  assert.ok(row.length > 0, "shortlist row not found");
  assert.match(row, /\{shortlist\.name\}/);
  assert.match(row, /\{shortlist\.creator_count\}/);
  // The id is the row key and the radio's value, never rendered as text.
  assert.doesNotMatch(row, /\{shortlist\.id\}\s*</);
  assert.doesNotMatch(row, /serial_number/);
});

test("an empty list is honest and offers the new branch", () => {
  const dialog = read(DIALOG);
  assert.match(dialog, /No existing shortlists available\./);
  assert.match(dialog, /Generate new shortlist instead/);
  // Nothing is created to fill the gap.
  const empty = dialog.slice(dialog.indexOf("No existing shortlists available"));
  assert.doesNotMatch(empty.slice(0, 500), /createShortlistV2/);
});

// ---------------------------------------------------------------------------
// Loading states say which operation is running.

test("selection shows no generation spinner", () => {
  const panel = read(PANEL);
  // Per-creator removal, and the generate button — never a generation spinner
  // on an add.
  assert.match(panel, /Removing…/);
  assert.match(panel, /Generating Shortlist…/);
  const section = read(SECTION);
  const addLabel = section.slice(section.indexOf("Adding…") - 300, section.indexOf("Adding…"));
  assert.doesNotMatch(addLabel, /Generating/);
});

test("the dialog names the operation it is running", () => {
  const dialog = read(DIALOG);
  assert.match(dialog, /"Adding to shortlist…" : "Generating shortlist…"/);
  assert.match(dialog, /"Add to Shortlist"/);
  assert.match(dialog, /"Generate New Shortlist"/);
});

// ---------------------------------------------------------------------------
// The width work from fb656754 is still in place.

test("the Studio width fix is preserved", () => {
  const css = read("features/campaign-studio/styles/campaign-studio-ref.css");
  const wrap = css.slice(css.indexOf(".campaign-studio-ref .cs-wrap {"));
  assert.match(wrap.slice(0, wrap.indexOf("}")), /max-width:\s*none/);
  const doc = css.slice(css.indexOf(".campaign-studio-ref .cs-doc {"));
  assert.match(doc.slice(0, doc.indexOf("}")), /max-width:\s*none/);
  assert.match(read(SECTION), /xl:grid-cols-\[minmax\(0,1fr\)_320px\]/);
});
