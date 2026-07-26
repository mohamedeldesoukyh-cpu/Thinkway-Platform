/**
 * Development-only psql runner. Asserts project ref hsxrewjcbvmbkqdlzjhs.
 * Refuses Production and known legacy project refs.
 *
 * Usage:
 *   node scripts/psql-development.mjs -c "SELECT 1"
 *   node scripts/psql-development.mjs -f path/to/file.sql
 *
 * Requires scripts/.env.migration with a Dev pooler URL (password may contain @).
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const DEV_REF = "hsxrewjcbvmbkqdlzjhs";
const BLOCKED = [
  "ienowhwfyxoqtzbgltno",
  "pkozxsvdyswgmcqzohqd",
  "dmcpbsripfjrzqznwtss",
];
const PSQL =
  process.env.PSQL_PATH ||
  "C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe";

const envFile = resolve("scripts/.env.migration");
const lines = readFileSync(envFile, "utf8")
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l.startsWith("postgresql:"));

const raw = lines.find((l) => l.includes(DEV_REF));
if (!raw) {
  console.error("No Development connection string found");
  process.exit(1);
}
for (const bad of BLOCKED) {
  if (raw.includes(bad)) {
    console.error(`Refusing connection: contains blocked ref ${bad}`);
    process.exit(1);
  }
}

const m = raw.match(/^postgresql:\/\/([^:]+):(.+)@(aws-[^/]+)\/(.+)$/);
if (!m) {
  console.error("Could not parse Dev connection string");
  process.exit(1);
}
const [, user, password, hostPort, database] = m;
const [host, port = "5432"] = hostPort.split(":");
if (!user.includes(DEV_REF)) {
  console.error("User does not embed Development project ref");
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error(
    "Usage: node scripts/psql-development.mjs -c SQL | -f file.sql",
  );
  process.exit(1);
}

const psqlArgs = [
  "-h",
  host,
  "-p",
  port,
  "-U",
  user,
  "-d",
  database,
  "-v",
  "ON_ERROR_STOP=1",
  ...args,
];

const result = spawnSync(PSQL, psqlArgs, {
  env: { ...process.env, PGPASSWORD: password },
  encoding: "utf8",
  stdio: ["inherit", "pipe", "pipe"],
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status ?? 1);
