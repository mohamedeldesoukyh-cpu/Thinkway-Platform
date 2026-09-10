/**
 * The Replace flow end to end, through the real helpers the section uses.
 *
 * The campaign in the brief: 10 recommended creators, 5 selected. The operator
 * replaces a selected creator from the remaining recommendations, from a
 * Discovery search, or from a profile URL, and Undo puts the original back.
 *
 * This exercises the decisions; the sheet and panel rendering are not covered
 * here and no browser run is claimed.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { StudioDraftCreatorRef } from "@/features/campaign-intelligence/types/section-schemas";

import {
  buildCreatorSelectionChange,
  enrichmentStatusForSelection,
  undoTargetIdForSelectionChange,
} from "./studio-creator-replacement";
import { creatorGroupingKey, splitRecommendedCreatorIds } from "./studio-creator-slate-split";
import {
  candidateIsSelectable,
  classifyReplacementCandidates,
} from "./studio-replacement-candidates";

const STAGED_AT = "2026-03-01T00:00:00.000Z";

type Vendor = {
  id: string;
  displayName: string;
  market: boolean;
  eci: boolean;
  mix: boolean;
};

/** A: selected. F: a clean candidate. H: outside the campaign market. */
const POOL: Vendor[] = [
  { id: "inf:a", displayName: "Creator A", market: true, eci: true, mix: true },
  { id: "inf:b", displayName: "Creator B", market: true, eci: true, mix: true },
  { id: "inf:c", displayName: "Creator C", market: true, eci: true, mix: true },
  { id: "inf:d", displayName: "Creator D", market: true, eci: true, mix: true },
  { id: "inf:e", displayName: "Creator E", market: true, eci: true, mix: true },
  { id: "inf:f", displayName: "Creator F", market: true, eci: true, mix: true },
  { id: "inf:g", displayName: "Creator G", market: true, eci: false, mix: true },
  { id: "inf:h", displayName: "Creator H", market: false, eci: true, mix: true },
  { id: "inf:i", displayName: "Creator I", market: true, eci: true, mix: false },
  { id: "inf:j", displayName: "Creator J", market: true, eci: true, mix: true },
];

const GATES = {
  matchesMarket: (v: Vendor) => v.market,
  passesEciGate: (v: Vendor) => v.eci,
  fitsBriefMix: (v: Vendor) => v.mix,
};

/** What the section builds: the remaining recommendations, classified. */
function candidatesFor(selectedIds: string[]) {
  const split = splitRecommendedCreatorIds({
    recommendationIds: selectedIds,
    discoveryIds: POOL.map((vendor) => vendor.id),
  });
  const selectedKeys = new Set(split.selectedIds.map(creatorGroupingKey));
  const remaining = POOL.filter((vendor) => !selectedKeys.has(creatorGroupingKey(vendor.id)));
  return { split, classified: classifyReplacementCandidates(remaining, GATES) };
}

const SLATE = ["inf:a", "inf:b", "inf:c", "inf:d", "inf:e"];

test("all five remaining recommendations reach the operator, three offered plainly", () => {
  const { split, classified } = candidatesFor(SLATE);

  assert.equal(split.selectedCount, 5);
  assert.equal(split.candidatePoolCount, 10, "the count keeps its meaning");
  assert.deepEqual(
    classified.map((candidate) => candidate.vendor.displayName),
    ["Creator F", "Creator G", "Creator H", "Creator I", "Creator J"],
    "not one of the five is filtered away by the selected list's gates"
  );

  // G (ECI) and I (brief mix) are flagged but still choosable; H is out of
  // market, so it is shown with its reason and not offered.
  assert.deepEqual(
    classified.filter(candidateIsSelectable).map((candidate) => candidate.vendor.displayName),
    ["Creator F", "Creator G", "Creator I", "Creator J"]
  );
  assert.equal(
    classified.find((candidate) => candidate.vendor.id === "inf:h")?.ineligibility,
    "outside_market"
  );
});

test("A → Replace → Creator F stages one change, and Undo restores A", () => {
  const { classified } = candidatesFor(SLATE);
  const chosen = classified.find((candidate) => candidate.vendor.id === "inf:f");
  assert.ok(chosen && candidateIsSelectable(chosen), "F is an offered candidate");

  const replacement: StudioDraftCreatorRef = {
    creatorId: chosen.vendor.id,
    displayName: chosen.vendor.displayName,
    handle: "creator_f",
    platform: "instagram",
    source: "discovery",
    enrichmentStatus: enrichmentStatusForSelection({ source: "discovery", queued: false }),
  };

  const change = buildCreatorSelectionChange({
    replacement,
    target: { creatorId: "inf:a", displayName: "Creator A" },
    stagedAt: STAGED_AT,
  });

  assert.equal(change.kind, "replace_creator");
  assert.ok(change.kind === "replace_creator");
  assert.equal(change.creatorId, "inf:a");
  assert.equal(change.replacement.creatorId, "inf:f");
  assert.equal(
    change.replacement.enrichmentStatus,
    "not_requested",
    "a candidate already carries Discovery's data — no re-enrichment claimed"
  );
  assert.equal(
    undoTargetIdForSelectionChange(change),
    "inf:a",
    "Undo unstages by the replaced creator, so Creator A comes back"
  );
});

test("once F is selected it leaves the candidate list and A becomes a candidate", () => {
  // The state after the replacement is applied: the slate holds F, not A.
  const { split, classified } = candidatesFor(["inf:f", "inf:b", "inf:c", "inf:d", "inf:e"]);

  assert.equal(split.selectedCount, 5, "the slate size is unchanged by a replacement");
  const names = classified.map((candidate) => candidate.vendor.displayName);
  assert.ok(!names.includes("Creator F"), "a selected creator is not its own replacement");
  assert.ok(names.includes("Creator A"), "the replaced creator returns to the pool");
});

test("the Discovery-search route stages the same change", () => {
  const change = buildCreatorSelectionChange({
    replacement: {
      creatorId: "inf:from-search",
      displayName: "Search Result",
      handle: "search_result",
      platform: "tiktok",
      source: "discovery",
      enrichmentStatus: enrichmentStatusForSelection({ source: "discovery", queued: false }),
    },
    target: { creatorId: "inf:a", displayName: "Creator A" },
    stagedAt: STAGED_AT,
  });

  assert.equal(change.kind, "replace_creator");
  assert.ok(change.kind === "replace_creator");
  assert.equal(change.replacement.enrichmentStatus, "not_requested");
  assert.equal(undoTargetIdForSelectionChange(change), "inf:a");
});

test("the URL route enriches, and shows pending only when the server queued it", () => {
  const queued = buildCreatorSelectionChange({
    replacement: {
      creatorId: "inf:by-url",
      displayName: "@handle_from_url",
      handle: "handle_from_url",
      platform: "instagram",
      source: "external_url",
      enrichmentStatus: enrichmentStatusForSelection({ source: "external_url", queued: true }),
    },
    target: { creatorId: "inf:a" },
    stagedAt: STAGED_AT,
  });
  assert.ok(queued.kind === "replace_creator");
  assert.equal(queued.replacement.enrichmentStatus, "pending");
  assert.equal(undoTargetIdForSelectionChange(queued), "inf:a");

  const notQueued = enrichmentStatusForSelection({ source: "external_url", queued: false });
  assert.equal(notQueued, "not_requested", "no progress is displayed that is not running");
});

test("with no candidates left the other routes still work — replacement is never blocked", () => {
  const { classified } = candidatesFor(POOL.map((vendor) => vendor.id));
  assert.deepEqual(classified, [], "every creator is selected, so there are no candidates");

  const change = buildCreatorSelectionChange({
    replacement: {
      creatorId: "inf:by-url",
      displayName: "@handle_from_url",
      handle: "handle_from_url",
      platform: "instagram",
      source: "external_url",
      enrichmentStatus: "pending",
    },
    target: { creatorId: "inf:a" },
    stagedAt: STAGED_AT,
  });
  assert.equal(change.kind, "replace_creator");
});
