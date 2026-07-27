/**
 * Production-only psql runner. Asserts project ref ienowhwfyxoqtzbgltno.
 * Refuses Development and known legacy project refs.
 *
 * Usage:
 *   node scripts/psql-production.mjs -c "SELECT 1"
 *   node scripts/psql-production.mjs -f path/to/file.sql
 *
 * Requires scripts/.env.migration with a Production pooler URL.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const PROD_REF = "ienowhwfyxoqtzbgltno";
const BLOCKED = [
  "hsxrewjcbvmbkqdlzjhs",
  "pkozxsvdyswgmcqzohqd",
  "dmcpbsripfjrzqznwtss",
];
const PSQL =
  process.env.PSQL_PATH ||
  "C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe";

const envFile = resolve("scripts/.env.migration");
const text = readFileSync(envFile, "utf8");
const urls = text
  .split(/postgresql:\/\//i)
  .filter(Boolean)
  .map((part) => "postgresql://" + part.trim().split(/\s+/)[0]);

const raw = urls.find((u) => u.includes(PROD_REF));
if (!raw) {
  console.error("No Production connection string found");
  process.exit(1);
}
for (const bad of BLOCKED) {
  if (raw.includes(bad)) {
    console.error(`Refusing connection: contains blocked ref ${bad}`);
    process.exit(1);
  }
}

const m = raw.match(/^postgresql:\/\/([^:]+):(.+)@(aws-[^/\s]+)\/([^\s]+)$/);
if (!m) {
  console.error("Could not parse Production connection string");
  process.exit(1);
}
const [, user, password, hostPort, database] = m;
const [host, port = "5432"] = hostPort.split(":");
if (!user.includes(PROD_REF)) {
  console.error("User does not embed Production project ref");
  process.exit(1);
}
if (!host.includes(PROD_REF) && !user.includes(PROD_REF)) {
  console.error("Connection does not embed Production project ref");
  process.exit(1);
}

console.log(
  JSON.stringify({
    target: "production",
    ref: PROD_REF,
    host,
    user_has_ref: user.includes(PROD_REF),
  }),
);

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error(
    "Usage: node scripts/psql-production.mjs -c SQL | -f file.sql",
  );
  process.exit(1);
}

const result = spawnSync(
  PSQL,
  [
    "-h",
    host,
    "-p",
    port,
    "-U",
    user,
    "-d",
    database.split("?")[0],
    "-v",
    "ON_ERROR_STOP=1",
    ...args,
  ],
  {
    env: { ...process.env, PGPASSWORD: password },
    encoding: "utf8",
    stdio: ["inherit", "pipe", "pipe"],
  },
);

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status ?? 1);
