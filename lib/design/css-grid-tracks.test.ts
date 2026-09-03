import assert from "node:assert/strict";
import { test } from "node:test";

import {
  countCssGridTracks,
  twGTracksAlign,
} from "@/lib/design/css-grid-tracks";

test("track count matches occupied children including spans", () => {
  const cols = "30px 26px 116px minmax(150px,1.1fr) 66px";
  assert.equal(countCssGridTracks(cols), 5);
  assert.equal(twGTracksAlign(cols, [1, 1, 1, 1, 1]), true);
  assert.equal(twGTracksAlign(cols, [1, 2, 1, 1]), true);
  assert.equal(twGTracksAlign(cols, [1, 1, 1, 1]), false);
});
