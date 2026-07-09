import assert from "node:assert/strict";
import test from "node:test";

import { CREATOR_DELETE_LINK_LABELS } from "./creator-delete-blockers";

test("CREATOR_DELETE_LINK_LABELS covers all link kinds", () => {
  const kinds = [
    "campaign",
    "shortlist",
    "quotation",
    "deliverable",
    "vendor_io",
    "publication",
    "invoice",
  ] as const;
  for (const kind of kinds) {
    assert.ok(CREATOR_DELETE_LINK_LABELS[kind]);
  }
});
