import assert from "node:assert/strict";
import test from "node:test";
import { isSaveLabel } from "./shortcut-targets";

test("save shortcut recognizes existing save and payment-record actions", () => {
  for (const label of ["Save", "Save PO", "Save line", "Save payment changes", "Record payment", "Record VAT payment"])
    assert.equal(isSaveLabel(label), true, label);
});

test("save never implicitly sends, approves, exports or deletes", () => {
  for (const label of ["Delete payment", "Confirm settlement", "Save and send", "Save & publish", "Approve", "Export", "Update Now", "Restore draft"])
    assert.equal(isSaveLabel(label), false, label);
});
