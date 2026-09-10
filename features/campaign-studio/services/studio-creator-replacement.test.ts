/**
 * Replacement reuses the existing draft machinery.
 *
 * `replace_creator` already exists as a draft change, and
 * `applyStudioDraftChanges` + `reoptimizeCampaignAfterApply` already commit
 * and re-score it. These tests pin that all three replacement routes end in
 * that one change, that Undo targets the replaced creator, and that enrichment
 * is claimed only when the server actually queued it.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { StudioDraftCreatorRef } from "@/features/campaign-intelligence/types/section-schemas";

import {
  buildCreatorSelectionChange,
  enrichmentStatusForSelection,
  undoTargetIdForSelectionChange,
} from "./studio-creator-replacement";

const STAGED_AT = "2026-03-01T00:00:00.000Z";

function ref(overrides?: Partial<StudioDraftCreatorRef>): StudioDraftCreatorRef {
  return {
    creatorId: "inf:new-1",
    displayName: "Creator F",
    handle: "creator_f",
    platform: "instagram",
    source: "discovery",
    enrichmentStatus: "not_requested",
    ...overrides,
  };
}

test("replacing a selected creator stages replace_creator, not a second system", () => {
  const change = buildCreatorSelectionChange({
    replacement: ref(),
    target: { creatorId: "inf:selected-1", displayName: "Creator A" },
    stagedAt: STAGED_AT,
  });

  assert.equal(change.kind, "replace_creator");
  assert.ok(change.kind === "replace_creator");
  assert.equal(change.creatorId, "inf:selected-1", "the target is the creator being replaced");
  assert.equal(change.displayName, "Creator A");
  assert.equal(change.replacement.creatorId, "inf:new-1");
  assert.equal(change.stagedAt, STAGED_AT);
});

test("with no target it is still a plain addition — the add path is unchanged", () => {
  const change = buildCreatorSelectionChange({ replacement: ref(), stagedAt: STAGED_AT });

  assert.equal(change.kind, "add_creator");
  assert.ok(change.kind === "add_creator");
  assert.equal(change.creator.creatorId, "inf:new-1");
});

test("a blank target is an addition, never a replacement of nothing", () => {
  for (const creatorId of ["", "   "]) {
    const change = buildCreatorSelectionChange({
      replacement: ref(),
      target: { creatorId },
      stagedAt: STAGED_AT,
    });
    assert.equal(change.kind, "add_creator");
  }
});

// ---------------------------------------------------------------------------
// All three routes produce the same change shape.

test("all three replacement routes stage one change kind", () => {
  const routes: Array<{ name: string; replacement: StudioDraftCreatorRef }> = [
    { name: "other recommended", replacement: ref({ source: "discovery" }) },
    { name: "Discovery search", replacement: ref({ source: "discovery" }) },
    {
      name: "URL / handle",
      replacement: ref({ source: "external_url", enrichmentStatus: "pending" }),
    },
  ];

  for (const route of routes) {
    const change = buildCreatorSelectionChange({
      replacement: route.replacement,
      target: { creatorId: "inf:selected-1" },
      stagedAt: STAGED_AT,
    });
    assert.equal(change.kind, "replace_creator", route.name);
    assert.ok(change.kind === "replace_creator");
    assert.equal(
      change.replacement.source,
      route.replacement.source,
      `${route.name}: the route survives as the ref's source, which drives enrichment`
    );
  }
});

// ---------------------------------------------------------------------------
// Undo.

test("Undo targets the replaced creator, so the original is restored", () => {
  const change = buildCreatorSelectionChange({
    replacement: ref(),
    target: { creatorId: "inf:selected-1", displayName: "Creator A" },
    stagedAt: STAGED_AT,
  });

  assert.equal(
    undoTargetIdForSelectionChange(change),
    "inf:selected-1",
    "unstaging by the replacement id would leave the campaign without Creator A"
  );
});

test("Undo works for every route, including a manually added creator", () => {
  for (const source of ["discovery", "external_url"] as const) {
    const change = buildCreatorSelectionChange({
      replacement: ref({ source }),
      target: { creatorId: "inf:selected-1" },
      stagedAt: STAGED_AT,
    });
    assert.equal(undoTargetIdForSelectionChange(change), "inf:selected-1");
  }
  // And an addition undoes by its own id.
  assert.equal(
    undoTargetIdForSelectionChange(
      buildCreatorSelectionChange({ replacement: ref(), stagedAt: STAGED_AT })
    ),
    "inf:new-1"
  );
});

// ---------------------------------------------------------------------------
// Enrichment posture — nothing claimed that the server did not queue.

test("only a URL/handle creator enriches, and only when the server queued it", () => {
  assert.equal(
    enrichmentStatusForSelection({ source: "external_url", queued: true }),
    "pending",
    "a queued job shows visible progress"
  );
  assert.equal(
    enrichmentStatusForSelection({ source: "external_url", queued: false }),
    "not_requested",
    "an unqueued creator must not display progress it does not have"
  );
  // A Discovery creator already carries Discovery's data.
  for (const queued of [true, false]) {
    assert.equal(
      enrichmentStatusForSelection({ source: "discovery", queued }),
      "not_requested",
      "Discovery picks keep the existing behaviour — no re-enrichment"
    );
  }
});
