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
  assert.ok(visibleAdTracks(field=>field==="collection").includes("billing"));
});
