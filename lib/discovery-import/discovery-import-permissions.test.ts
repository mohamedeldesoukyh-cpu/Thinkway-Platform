import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../..");

const DISCOVERY_IMPORT_TABLES = ["creator_import_files", "creator_sources"] as const;

const baseMigrationPath = path.join(
  repoRoot,
  "supabase/migrations/20260625140000_discovery_import_center.sql"
);
const grantsMigrationPath = path.join(
  repoRoot,
  "supabase/migrations/20260625160000_fix_discovery_import_permissions.sql"
);
const workerSupabasePath = path.join(
  repoRoot,
  "services/discovery-worker/src/db/supabase.ts"
);
const workerConfigPath = path.join(repoRoot, "services/discovery-worker/src/config.ts");

const baseMigrationSql = readFileSync(baseMigrationPath, "utf8");
const grantsMigrationSql = readFileSync(grantsMigrationPath, "utf8");
const workerSupabaseSource = readFileSync(workerSupabasePath, "utf8");
const workerConfigSource = readFileSync(workerConfigPath, "utf8");

for (const table of DISCOVERY_IMPORT_TABLES) {
  assert.match(
    baseMigrationSql,
    new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`),
    `${table} should be created in discovery import center migration`
  );

  assert.match(
    baseMigrationSql,
    new RegExp(`${table}_service[\\s\\S]*FOR ALL TO service_role`),
    `${table} should have a service_role RLS bypass policy`
  );

  assert.match(
    grantsMigrationSql,
    new RegExp(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON public\\.${table} TO authenticated, service_role`
    ),
    `${table} should grant PostgREST roles table-level access`
  );
}

assert.doesNotMatch(
  baseMigrationSql,
  /creator_import_jobs|creator_import_logs|creator_import_creators/,
  "discovery import uses creator_import_files + creator_sources only"
);

assert.match(
  workerConfigSource,
  /supabaseServiceRoleKey:\s*required\("SUPABASE_SERVICE_ROLE_KEY"\)/,
  "discovery worker config must require SUPABASE_SERVICE_ROLE_KEY"
);

assert.match(
  workerSupabaseSource,
  /createClient\(config\.supabaseUrl,\s*config\.supabaseServiceRoleKey/,
  "discovery worker must create Supabase client with service role key"
);

assert.doesNotMatch(
  workerSupabaseSource,
  /NEXT_PUBLIC_SUPABASE_ANON_KEY|SUPABASE_ANON_KEY/,
  "discovery worker must not use anon key"
);

assert.match(
  grantsMigrationSql,
  /creator_imports_storage_select_service[\s\S]*FOR SELECT TO service_role/,
  "worker storage download needs service_role select on creator-imports bucket"
);

console.log("discovery-import-permissions.test.ts: all assertions passed");
