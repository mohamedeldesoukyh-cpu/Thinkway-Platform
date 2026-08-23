import assert from "node:assert/strict";
import { test } from "node:test";

import { isShortlistCreatorQuoted } from "./shortlist-badges";

test("shortlist quoted identity label is on only when a quotation ref exists", () => {
  assert.equal(isShortlistCreatorQuoted(undefined), false);
  assert.equal(isShortlistCreatorQuoted([]), false);
  assert.equal(
    isShortlistCreatorQuoted([
      {
        quotation_id: "q1",
        serial_number: "QT-2026-0021",
        name: "Limitless KSA",
        status: "draft",
      },
    ]),
    true
  );
});
