import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

test("P4 migration tightens campaign-publication-media SELECT", () => {
  const migration = readFileSync(
    join(
      repoRoot,
      "supabase/migrations/20260724180000_p4_campaign_publication_media_select.sql",
    ),
    "utf8",
  );
  assert.match(migration, /is_internal_user/);
  assert.match(migration, /campaigns\.read/);
  assert.match(migration, /service_role/);
  // Authenticated policy must combine bucket + internal + permission
  assert.match(
    migration,
    /FOR SELECT TO authenticated[\s\S]*is_internal_user\(\)[\s\S]*campaigns\.read/,
  );
});

test("creator-imports storage requires discovery permission + internal user on insert", () => {
  const migration = readFileSync(
    join(
      repoRoot,
      "supabase/migrations/20260625190000_protect_creator_import_files.sql",
    ),
    "utf8",
  );
  assert.match(migration, /is_internal_user/);
  assert.match(migration, /discovery\.(read|write|admin)/);
});
