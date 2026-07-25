/**
 * Read-only Production Migration Readiness Audit helper.
 * - Parses supabase/migrations for object definitions
 * - Optionally probes live PostgREST OpenAPI (table inventory only)
 * - Never writes to any database
 *
 * Usage: node scripts/audit-migration-readiness.mjs
 * Optional: LOAD_ENV=1 to read .env for live table probe (URL+anon or service key).
 */
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migDir = join(root, "supabase", "migrations");

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    let v = line.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

const files = readdirSync(migDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const versionMap = new Map();
for (const f of files) {
  const ver = f.slice(0, 14);
  if (!versionMap.has(ver)) versionMap.set(ver, []);
  versionMap.get(ver).push(f);
}
const duplicateVersions = [...versionMap.entries()].filter(
  ([, list]) => list.length > 1,
);

const createTable = new Set();
const createView = new Set();
const createFunc = new Set();
const createPolicy = new Set();
const createIndex = new Set();
const createTrigger = new Set();
const createType = new Set();
const createExtension = new Set();
const storageBuckets = new Set();
const dropPolicy = new Set();
const alterEnableRls = new Set();
const alterForceRls = new Set();
const risky = [];

const re = {
  table: /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:public|storage|auth|intelligence)\.\w+|\w+)/gi,
  view: /CREATE\s+(?:OR\s+REPLACE\s+)?(?:MATERIALIZED\s+)?VIEW\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:public|intelligence)\.\w+|\w+)/gi,
  func: /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+((?:public|intelligence)\.\w+)/gi,
  policy: /CREATE\s+POLICY\s+(?:IF\s+NOT\s+EXISTS\s+)?"?([\w]+)"?\s+ON\s+((?:public|storage|intelligence)\.\w+)/gi,
  index: /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi,
  trigger: /CREATE\s+(?:OR\s+REPLACE\s+)?TRIGGER\s+(\w+)/gi,
  type: /CREATE\s+TYPE\s+((?:public\.)?\w+)/gi,
  ext: /CREATE\s+EXTENSION\s+(?:IF\s+NOT\s+EXISTS\s+)?"?(\w+)"?/gi,
  bucket: /storage\.buckets[\s\S]{0,200}?'([\w-]+)'/gi,
  insertBucket: /INSERT\s+INTO\s+storage\.buckets[\s\S]{0,120}?'([\w-]+)'/gi,
  dropPol: /DROP\s+POLICY\s+(?:IF\s+EXISTS\s+)?"?([\w]+)"?/gi,
  enableRls: /ALTER\s+TABLE\s+((?:public|intelligence)\.\w+)\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi,
  forceRls: /ALTER\s+TABLE\s+((?:public|intelligence)\.\w+)\s+FORCE\s+ROW\s+LEVEL\s+SECURITY/gi,
};

function collect(set, regex, text, normalize = (m) => m) {
  regex.lastIndex = 0;
  let m;
  while ((m = regex.exec(text))) {
    set.add(normalize(m[1]));
  }
}

for (const f of files) {
  const text = readFileSync(join(migDir, f), "utf8");
  collect(createTable, re.table, text, (t) =>
    t.includes(".") ? t : `public.${t}`,
  );
  collect(createView, re.view, text, (t) =>
    t.includes(".") ? t : `public.${t}`,
  );
  collect(createFunc, re.func, text);
  let m;
  re.policy.lastIndex = 0;
  while ((m = re.policy.exec(text))) {
    createPolicy.add(`${m[2]}::${m[1]}`);
  }
  collect(createIndex, re.index, text);
  collect(createTrigger, re.trigger, text);
  collect(createType, re.type, text);
  collect(createExtension, re.ext, text);
  collect(storageBuckets, re.bucket, text);
  collect(storageBuckets, re.insertBucket, text);
  collect(dropPolicy, re.dropPol, text);
  collect(alterEnableRls, re.enableRls, text);
  collect(alterForceRls, re.forceRls, text);

  if (/\bTRUNCATE\b/i.test(text)) risky.push({ file: f, kind: "TRUNCATE" });
  if (/DROP\s+TABLE\s+(?!IF\s+EXISTS)/i.test(text))
    risky.push({ file: f, kind: "DROP TABLE (hard)" });
  if (/DROP\s+SCHEMA\b/i.test(text)) risky.push({ file: f, kind: "DROP SCHEMA" });
  if (/DELETE\s+FROM\s+/i.test(text))
    risky.push({ file: f, kind: "DELETE FROM (review)" });
  if (/DROP\s+COLUMN\b/i.test(text))
    risky.push({ file: f, kind: "DROP COLUMN" });
  if (/DISABLE\s+ROW\s+LEVEL\s+SECURITY/i.test(text))
    risky.push({ file: f, kind: "DISABLE RLS" });
}

// schema.sql comparison (may lag)
const schemaPath = join(root, "supabase", "schema.sql");
const schemaTables = new Set();
const schemaOnlyHints = [];
if (existsSync(schemaPath)) {
  const schema = readFileSync(schemaPath, "utf8");
  collect(schemaTables, re.table, schema, (t) =>
    t.includes(".") ? t : `public.${t}`,
  );
  for (const t of schemaTables) {
    if (![...createTable].some((c) => c === t || c.endsWith(`.${t.split(".").pop()}`))) {
      // soft: schema dump may use unqualified names inconsistently
    }
  }
}

const env =
  process.env.LOAD_ENV === "1"
    ? { ...loadEnvFile(join(root, ".env")), ...process.env }
    : process.env;

const url = (env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const key = (
  env.SUPABASE_SERVICE_ROLE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  ""
).trim();

let liveTables = null;
let liveError = null;
let projectRef = null;

if (url && key && process.env.SKIP_LIVE !== "1") {
  try {
    projectRef = new URL(url).hostname.split(".")[0];
    const res = await fetch(`${url}/rest/v1/`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: "application/openapi+json",
      },
    });
    if (!res.ok) {
      liveError = `OpenAPI probe HTTP ${res.status}`;
    } else {
      const openapi = await res.json();
      liveTables = Object.keys(openapi.definitions || openapi.components?.schemas || {})
        .filter((n) => !n.includes("."))
        .sort();
      // PostgREST openapi definitions are usually table names
      if (!liveTables.length && openapi.paths) {
        liveTables = Object.keys(openapi.paths)
          .map((p) => p.replace(/^\//, "").split("{")[0].replace(/\/$/, ""))
          .filter(Boolean)
          .filter((v, i, a) => a.indexOf(v) === i)
          .sort();
      }
    }
  } catch (e) {
    liveError = e instanceof Error ? e.message : String(e);
  }
}

const migTableNames = [...createTable].map((t) => t.replace(/^public\./, ""));
const liveNotInMigrations = [];
const migrationsNotInLive = [];
if (liveTables) {
  const migSet = new Set(migTableNames.map((t) => t.toLowerCase()));
  const liveSet = new Set(liveTables.map((t) => t.toLowerCase()));
  for (const t of liveTables) {
    if (!migSet.has(t.toLowerCase())) liveNotInMigrations.push(t);
  }
  for (const t of migTableNames) {
    // skip storage/auth internals
    if (t.startsWith("storage.") || t.startsWith("auth.")) continue;
    const bare = t.replace(/^public\./, "");
    if (!liveSet.has(bare.toLowerCase())) migrationsNotInLive.push(bare);
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  migrationFileCount: files.length,
  duplicateVersions: Object.fromEntries(duplicateVersions),
  firstMigration: files[0],
  lastMigration: files[files.length - 1],
  counts: {
    tables: createTable.size,
    views: createView.size,
    functions: createFunc.size,
    policies: createPolicy.size,
    indexes: createIndex.size,
    triggers: createTrigger.size,
    types: createType.size,
    extensions: createExtension.size,
    storageBuckets: storageBuckets.size,
    enableRls: alterEnableRls.size,
    forceRls: alterForceRls.size,
  },
  extensions: [...createExtension].sort(),
  storageBuckets: [...storageBuckets].sort(),
  forceRlsTables: [...alterForceRls].sort(),
  riskyMigrations: risky,
  liveProbe: {
    attempted: Boolean(url && key && process.env.SKIP_LIVE !== "1"),
    projectRef,
    error: liveError,
    liveTableCount: liveTables?.length ?? null,
    liveTablesNotFoundInMigrationCreates: liveNotInMigrations,
    migrationTablesMissingFromLiveOpenApi: migrationsNotInLive.slice(0, 80),
    migrationTablesMissingFromLiveOpenApiTotal: migrationsNotInLive.length,
  },
  schemaSqlTableCount: schemaTables.size || null,
  notes: [
    "OpenAPI only exposes tables/views granted to the API role; auth/storage internals and unexposed tables will appear as gaps.",
    "CREATE TABLE parsing is heuristic; dynamic SQL and renamed tables may under-count.",
    "schema.sql is a point-in-time dump and may lag migrations.",
  ],
};

const outDir = join(root, "docs", "handover");
mkdirSync(outDir, { recursive: true });
const jsonPath = join(outDir, "MIGRATION_READINESS_AUDIT_DATA.json");
writeFileSync(jsonPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log(`\nWrote ${jsonPath}`);
