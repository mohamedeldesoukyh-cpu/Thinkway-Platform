import assert from "node:assert/strict";

import {
  creatorImportPausedStatusMigrationHint,
  isCreatorImportPausedStatusConstraintError,
  PAUSABLE_CREATOR_IMPORT_STATUSES,
  RESUMABLE_CREATOR_IMPORT_STATUSES,
} from "./constants";

assert.deepEqual(PAUSABLE_CREATOR_IMPORT_STATUSES, ["uploaded", "queued", "processing"]);
assert.deepEqual(RESUMABLE_CREATOR_IMPORT_STATUSES, ["paused"]);
assert.equal(
  isCreatorImportPausedStatusConstraintError(
    'new row for relation "creator_import_files" violates check constraint "creator_import_files_status_check"'
  ),
  true
);
assert.equal(isCreatorImportPausedStatusConstraintError("permission denied"), false);
assert.match(creatorImportPausedStatusMigrationHint(), /supabase db push/);

console.log("pause-import.test.ts: all assertions passed");
