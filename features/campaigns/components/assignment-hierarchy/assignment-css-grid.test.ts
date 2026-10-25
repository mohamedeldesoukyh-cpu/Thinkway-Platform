import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildAssignmentCssGridCols,
  PARENT_TRACK_TO_CHILD_FIELD,
} from "@/features/campaigns/components/assignment-hierarchy/assignment-css-grid";
import { ASSIGNMENT_GRID_PARENT_COLUMN_ORDER } from "@/features/campaigns/components/assignment-hierarchy/assignment-grid-column-layout";
import { countCssGridTracks } from "@/lib/design/css-grid-tracks";

test("assignment --cols track count equals visible parent columns", () => {
  const ids = ASSIGNMENT_GRID_PARENT_COLUMN_ORDER.filter((id) => id !== "expand");
  const cols = buildAssignmentCssGridCols(ids);
  assert.equal(countCssGridTracks(cols), ids.length);
});

test("every parent track maps to a child field", () => {
  for (const id of ASSIGNMENT_GRID_PARENT_COLUMN_ORDER) {
    if (id === "expand") continue;
    assert.ok(PARENT_TRACK_TO_CHILD_FIELD[id], `missing child map for ${id}`);
  }
});

test("financial tracks keep creator costs before revenue and billing", () => {
  const start = ASSIGNMENT_GRID_PARENT_COLUMN_ORDER.indexOf("cost");
  assert.deepEqual(ASSIGNMENT_GRID_PARENT_COLUMN_ORDER.slice(start, -1), [
    "cost", "usageRightsCost", "costVatPercent", "costVat", "costTotal",
    "revenue", "usageRights", "agencyFeePercent", "agencyFee", "revenueVatPercent",
    "vat", "totalBilling", "gp", "fxGainLoss", "margin", "opsStatus", "billing", "payout",
  ]);
});

import { visibleAdTracks } from "./assignment-css-grid";
test("ad live date, month, invoice and actions do not depend on parent GP or margin visibility", () => {
  const selected=new Set(["type","postDate","liveAdMonth","invoice","workflow"]);
  const tracks=visibleAdTracks(field=>selected.has(field));
  for(const track of ["assignment","gp","margin","opsStatus","actions"]) assert.ok(tracks.includes(track));
  assert.ok(!tracks.includes("cost")); assert.ok(!tracks.includes("revenue"));
});
test("each selected child column remains visible and hidden child financials stay hidden", () => {
  for(const field of Object.values(PARENT_TRACK_TO_CHILD_FIELD).filter(field=>field!=="fullDescriptionSpacer")) {
    assert.ok(visibleAdTracks(candidate=>candidate===field).some(track=>PARENT_TRACK_TO_CHILD_FIELD[track]===field));
  }
  assert.deepEqual(visibleAdTracks(()=>false),["actions"]);
  assert.ok(visibleAdTracks(field=>field==="collection").includes("collection"));
});

import { ASSIGNMENT_CHILD_GRID_COLUMN_METAS, ASSIGNMENT_GRID_COLUMN_METAS } from "@/lib/tables/assignment-grid-column-metas";
import { normalizeTableColumnState } from "@/lib/tables/operational-table-column-settings";
import { buildAdCssGridCols } from "./assignment-css-grid";

test("every configurable child field has exactly one track, including workflow and collection", () => {
  for (const {id} of ASSIGNMENT_CHILD_GRID_COLUMN_METAS.filter(c => c.id !== "expand")) {
    const tracks = visibleAdTracks(field => field === id);
    assert.equal(tracks.filter(track => PARENT_TRACK_TO_CHILD_FIELD[track] === id).length, 1, id);
  }
});
test("saved layouts gain planned dates without losing visibility preferences or order", () => {
  for (const columns of [ASSIGNMENT_GRID_COLUMN_METAS, ASSIGNMENT_CHILD_GRID_COLUMN_METAS]) {
    const date = columns === ASSIGNMENT_GRID_COLUMN_METAS ? "postingDates" : "postDate";
    const oldOrder = columns.filter(c => c.id !== "plannedDate").map(c => c.id).reverse();
    const state = normalizeTableColumnState({order: oldOrder, visible: {[date]: false, cost: false}}, columns);
    assert.equal(state.visible.plannedDate, true);
    assert.equal(state.visible[date], false);
    assert.equal(state.visible.cost, false);
    assert.deepEqual(state.order.filter(id => id !== "plannedDate"), oldOrder);
  }
});
test("reordered child headers and rows retain one equal-width track per field", () => {
  const order = ASSIGNMENT_CHILD_GRID_COLUMN_METAS.map(c => c.id).reverse();
  const tracks = visibleAdTracks(() => true, order);
  assert.deepEqual(tracks.map(t => PARENT_TRACK_TO_CHILD_FIELD[t]), order.filter(id => id !== "expand"));
  assert.equal(countCssGridTracks(buildAdCssGridCols(tracks)), tracks.length);
  assert.ok(!visibleAdTracks(f => f === "plannedDate").includes("gp"));
  assert.ok(!visibleAdTracks(f => f === "postDate").includes("plannedDate"));
});
