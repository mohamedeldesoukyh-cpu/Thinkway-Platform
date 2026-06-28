import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../..");

const read = (relative: string) =>
  readFileSync(path.join(repoRoot, relative), "utf8");

const protectMigration = read(
  "supabase/migrations/20260625190000_protect_creator_import_files.sql"
);
const storageSql = read("supabase/storage.sql");
const storageLib = read("lib/supabase/storage.ts");
const uploadAction = read("features/discovery-import/actions.ts");
const processSource = read("lib/discovery-import/process.ts");

// -----------------------------------------------------------------------------
// 1. Storage immutability — uploads + reads allowed, overwrite + delete denied.
// -----------------------------------------------------------------------------

assert.match(
  protectMigration,
  /CREATE POLICY creator_imports_storage_insert\b[\s\S]*FOR INSERT TO authenticated/,
  "upload (INSERT) must remain allowed for authenticated users"
);

assert.match(
  protectMigration,
  /CREATE POLICY creator_imports_storage_select\b[\s\S]*FOR SELECT TO authenticated/,
  "download (SELECT) must remain allowed for authorized discovery users"
);

// No permissive UPDATE/DELETE policy for authenticated users may be (re)created.
assert.doesNotMatch(
  protectMigration,
  /CREATE POLICY[^;]*storage[^;]*FOR UPDATE TO authenticated/,
  "overwrite (UPDATE) must NOT be granted to authenticated users"
);
assert.doesNotMatch(
  protectMigration,
  /CREATE POLICY[^;]*storage[^;]*FOR DELETE TO authenticated/,
  "delete (DELETE) must NOT be granted to authenticated users"
);

// Legacy authenticated destructive policies are explicitly dropped.
assert.match(
  protectMigration,
  /DROP POLICY IF EXISTS creator_imports_storage_update ON storage\.objects/,
  "legacy authenticated UPDATE policy must be dropped"
);
assert.match(
  protectMigration,
  /DROP POLICY IF EXISTS creator_imports_storage_delete ON storage\.objects/,
  "legacy authenticated DELETE policy must be dropped"
);

// service_role keeps SELECT (worker download) but loses UPDATE (no overwrite).
assert.match(
  protectMigration,
  /CREATE POLICY creator_imports_storage_select_service\b[\s\S]*FOR SELECT TO service_role/,
  "worker must retain service_role SELECT to download files for processing"
);
assert.match(
  protectMigration,
  /DROP POLICY IF EXISTS creator_imports_storage_update_service ON storage\.objects/,
  "service_role overwrite (UPDATE) must be removed for byte-level immutability"
);
assert.doesNotMatch(
  protectMigration,
  /CREATE POLICY[^;]*storage[^;]*FOR UPDATE TO service_role/,
  "no service_role UPDATE policy may be created (no overwrites at all)"
);
// service_role DELETE retained only as the documented admin/rollback escape hatch.
assert.match(
  protectMigration,
  /CREATE POLICY creator_imports_storage_delete_service\b[\s\S]*FOR DELETE TO service_role/,
  "service_role DELETE retained as admin/legal purge + rollback escape hatch"
);

// storage.sql (standalone post-migration file) must not re-grant destructive access.
assert.doesNotMatch(
  storageSql,
  /CREATE POLICY "creator_imports_storage_delete"/,
  "storage.sql must not recreate an authenticated DELETE policy"
);
assert.doesNotMatch(
  storageSql,
  /CREATE POLICY "creator_imports_storage_update"/,
  "storage.sql must not recreate an authenticated UPDATE policy"
);

// -----------------------------------------------------------------------------
// 2. DB record protection — immutable provenance columns + admin-only delete.
// -----------------------------------------------------------------------------

const IMMUTABLE_COLUMNS = [
  "filename",
  "storage_path",
  "file_type",
  "uploaded_by",
  "created_at",
] as const;

assert.match(
  protectMigration,
  /CREATE OR REPLACE FUNCTION public\.guard_creator_import_file_immutable_columns\(\)/,
  "an immutable-column guard trigger function must exist"
);

for (const column of IMMUTABLE_COLUMNS) {
  assert.match(
    protectMigration,
    new RegExp(`NEW\\.${column} IS DISTINCT FROM OLD\\.${column}`),
    `${column} must be guarded as immutable`
  );
}

assert.match(
  protectMigration,
  /RAISE EXCEPTION[\s\S]*USING ERRCODE = '42501'/,
  "the guard must raise an insufficient-privilege error on tampering"
);

assert.match(
  protectMigration,
  /IF auth\.uid\(\) IS NULL THEN\s*RETURN NEW/,
  "service_role (no auth.uid()) must bypass the immutability guard for corrections"
);

assert.match(
  protectMigration,
  /CREATE TRIGGER guard_creator_import_file_immutable_columns\s*BEFORE UPDATE ON public\.creator_import_files/,
  "the guard must be wired as a BEFORE UPDATE trigger"
);

// Processing columns must remain mutable — they are NOT in the guarded set.
const PROCESSING_COLUMNS = [
  "status",
  "processing_log",
  "processing_started_at",
  "processing_completed_at",
  "error_message",
  "total_creators",
  "imported_creators",
  "updated_creators",
  "duplicate_creators",
  "failed_creators",
];
for (const column of PROCESSING_COLUMNS) {
  assert.doesNotMatch(
    protectMigration,
    new RegExp(`NEW\\.${column} IS DISTINCT FROM OLD\\.${column}`),
    `${column} is a processing column and must stay mutable`
  );
}

// DELETE of import rows is admin-only (audit trail), UPDATE stays for write/admin.
assert.match(
  protectMigration,
  /CREATE POLICY creator_import_files_delete[\s\S]*FOR DELETE TO authenticated[\s\S]*has_permission\('discovery\.admin'\)/,
  "row DELETE must be restricted to discovery.admin"
);
assert.doesNotMatch(
  protectMigration,
  /creator_import_files_delete[\s\S]*discovery\.write/,
  "discovery.write must NOT be able to delete import rows"
);
assert.match(
  protectMigration,
  /CREATE POLICY creator_import_files_update[\s\S]*FOR UPDATE TO authenticated/,
  "UPDATE must remain available so the upload action can set status=queued"
);
assert.match(
  protectMigration,
  /DROP POLICY IF EXISTS creator_import_files_write ON public\.creator_import_files/,
  "the broad FOR ALL write policy must be replaced with granular policies"
);

// -----------------------------------------------------------------------------
// 3. Application layer — no overwrite on upload, rollback via service role.
// -----------------------------------------------------------------------------

const upsertFalseCount = (storageLib.match(/upsert:\s*false/g) ?? []).length;
assert.ok(
  upsertFalseCount >= 2,
  "storage uploads must use upsert:false (no overwrite) for both document + import uploads"
);
assert.doesNotMatch(
  storageLib,
  /upsert:\s*true/,
  "no storage upload may use upsert:true"
);

assert.match(
  uploadAction,
  /createSupabaseAdminClient/,
  "failed-upload rollback must use the service-role admin client (users cannot delete)"
);

// The user (RLS-bound) client must not be used to delete import objects.
assert.doesNotMatch(
  uploadAction,
  /removeCreatorImportObject\(\{\s*supabase,/,
  "rollback must not attempt deletion with the authenticated user client"
);

// -----------------------------------------------------------------------------
// 4. Worker still updates only processing/diagnostic columns (never provenance).
// -----------------------------------------------------------------------------

// `file_type` is excluded here: the worker echoes it as a field inside the
// processing_log JSON object, not as a written column. Provenance immutability of
// file_type is enforced + asserted via the DB trigger above.
const WORKER_FORBIDDEN_COLUMNS = IMMUTABLE_COLUMNS.filter(
  (column) => column !== "file_type" && column !== "storage_path"
);
for (const column of WORKER_FORBIDDEN_COLUMNS) {
  assert.doesNotMatch(
    processSource,
    new RegExp(`^\\s*${column}:`, "m"),
    `worker must never write the immutable column ${column}`
  );
}
assert.match(
  processSource,
  /removeCreatorImportObject/,
  "worker must remove processed source files from storage via service role"
);
assert.match(
  processSource,
  /storage_path: storagePathAfterProcessing/,
  "worker must clear storage_path after successful storage removal"
);
assert.match(
  processSource,
  /\.update\(\{\s*[\s\S]*status: "processing"/,
  "worker must still update processing status"
);

console.log("discovery-import-immutability.test.ts: all assertions passed");
