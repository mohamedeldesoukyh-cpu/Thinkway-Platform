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
