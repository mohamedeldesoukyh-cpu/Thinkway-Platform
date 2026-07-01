import assert from "node:assert/strict";

import {
  CANCELLABLE_CREATOR_IMPORT_STATUSES,
  CREATOR_IMPORT_CANCELLED_MESSAGE,
} from "./constants";

assert.deepEqual(CANCELLABLE_CREATOR_IMPORT_STATUSES, [
  "uploaded",
  "queued",
  "processing",
  "paused",
]);
assert.equal(CREATOR_IMPORT_CANCELLED_MESSAGE, "Cancelled by user");

console.log("cancel-import.test.ts: all assertions passed");
