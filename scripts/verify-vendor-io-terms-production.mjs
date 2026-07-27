/**
 * Production schema + RLS verification for Vendor IO Terms.
 * Usage: node scripts/verify-vendor-io-terms-production.mjs
 */
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(process.cwd());
const psql = resolve(root, "scripts/psql-production.mjs");

function runSql(sql) {
  const result = spawnSync("node", [psql, "-c", sql], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    console.error(result.stdout || "");
    console.error(result.stderr || "");
    throw new Error(`psql failed (exit ${result.status})`);
  }
  return `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
}

const checks = [];

function record(name, pass, detail) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}: ${detail}`);
}

const schemaOut = runSql(`
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name='influencers' AND column_name='vendor_io_terms_text';
SELECT pg_get_functiondef(p.oid) LIKE '%vendor_io_terms_text%' AS fn_seeds
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname='public' AND p.proname='upsert_vendor_io_from_assignment';
`);

record(
  "influencers.vendor_io_terms_text",
  /vendor_io_terms_text/.test(schemaOut) && /text/.test(schemaOut),
  schemaOut.includes("vendor_io_terms_text") ? "column present (text, nullable)" : "missing"
);

record(
  "upsert_vendor_io_from_assignment seeds vendor terms",
  /fn_seeds\s*\n\s*-+\s*\n\s*t/.test(schemaOut) || /\st\s*\n/.test(schemaOut),
  schemaOut.includes("fn_seeds") ? "function references vendor_io_terms_text" : "not verified"
);

const policyOut = runSql(`
SELECT policyname, cmd
FROM pg_policies
WHERE tablename='influencers'
ORDER BY policyname;
`);

const hasLegacy = /Allow authenticated users/i.test(policyOut);
const hasUpdate = /influencers_update/.test(policyOut);
const hasSelect = /influencers_select/.test(policyOut);

record(
  "Legacy allow-all influencers policies removed",
  !hasLegacy,
  hasLegacy ? "legacy Allow authenticated* still present" : "removed"
);

record(
  "influencers_update / influencers_select present",
  hasUpdate && hasSelect,
  hasUpdate && hasSelect ? "intended RLS policies active" : "missing intended policies"
);

const failed = checks.filter((c) => !c.pass);
console.log("\n--- Production verification ---");
console.log(`Passed: ${checks.filter((c) => c.pass).length}/${checks.length}`);
if (failed.length) {
  console.error("FAILED:", failed.map((f) => f.name).join(", "));
  process.exit(1);
}
console.log("verify-vendor-io-terms-production.mjs: ok");
