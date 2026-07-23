import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  applyResizeDelta,
  clampWindowBounds,
  getDefaultWindowBounds,
  snapWindowBounds,
} from "@/features/campaign-outputs/hooks/document-window-bounds";

const VIEWPORT = { width: 1200, height: 900 };

test("getDefaultWindowBounds centers the window in the viewport", () => {
  const bounds = getDefaultWindowBounds(VIEWPORT, { wide: true });
  assert.equal(bounds.x + bounds.width / 2, VIEWPORT.width / 2);
  assert.equal(bounds.y + bounds.height / 2, VIEWPORT.height / 2);
  assert.ok(bounds.width <= VIEWPORT.width);
  assert.ok(bounds.height <= VIEWPORT.height);
});

test("clampWindowBounds keeps the window inside the viewport", () => {
  const { bounds } = clampWindowBounds(
    { x: -40, y: -20, width: 600, height: 500 },
    VIEWPORT
  );
  assert.equal(bounds.x, 0);
  assert.equal(bounds.y, 0);
  assert.ok(bounds.x + bounds.width <= VIEWPORT.width);
  assert.ok(bounds.y + bounds.height <= VIEWPORT.height);
});

test("clampWindowBounds enforces minimum size", () => {
  const { bounds } = clampWindowBounds(
    { x: 100, y: 100, width: 200, height: 200 },
    VIEWPORT
  );
  assert.equal(bounds.width, 480);
  assert.equal(bounds.height, 360);
});

test("applyResizeDelta grows from the south-east corner", () => {
  const origin = { x: 100, y: 100, width: 600, height: 400 };
  const next = applyResizeDelta(origin, "se", { dx: 50, dy: 30 });
  assert.deepEqual(next, { x: 100, y: 100, width: 650, height: 430 });
});

test("applyResizeDelta moves the north-west corner", () => {
  const origin = { x: 200, y: 200, width: 600, height: 400 };
  const next = applyResizeDelta(origin, "nw", { dx: -20, dy: -10 });
  assert.deepEqual(next, { x: 180, y: 190, width: 620, height: 410 });
});

test("snapWindowBounds snaps near viewport edges", () => {
  const snapped = snapWindowBounds(
    { x: 8, y: 10, width: 600, height: 400 },
    VIEWPORT,
    12
  );
  assert.equal(snapped.x, 0);
  assert.equal(snapped.y, 0);

  const rightSnap = snapWindowBounds(
    { x: 598, y: 100, width: 600, height: 400 },
    VIEWPORT,
    12
  );
  assert.equal(rightSnap.x, VIEWPORT.width - 600);
});
