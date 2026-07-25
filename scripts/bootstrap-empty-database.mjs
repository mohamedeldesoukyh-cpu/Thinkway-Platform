/**
 * Bootstrap an empty database from repository SQL only.
 *
 * Order:
 *   1. supabase/bootstrap/supabase_platform_stubs.sql (optional; plain Postgres)
 *   2. supabase/schema.sql
 *   3. supabase/seed.sql
 *   4. supabase/policies.sql
 *   5. supabase/storage.sql
 *   6. supabase/migrations/*.sql (sorted)
 *
 * Usage:
 *   node scripts/bootstrap-empty-database.mjs --database-url postgres://...
 *   node scripts/bootstrap-empty-database.mjs --database-url ... --skip-stubs
 *   node scripts/bootstrap-empty-database.mjs --database-url ... --stop-after policies
 *
 * Requires: psql on PATH, or --docker <container> (uses docker exec psql).
 * Does not modify application code. Safe for empty DBs only.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const psqlBin = process.env.PSQL_PATH || "psql";

function parseArgs(argv) {
  const out = {
    databaseUrl: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || "",
    docker: process.env.BOOTSTRAP_DOCKER || "",
    dbName: "thinkway",
    skipStubs: false,
    stopAfter: null,
    reportPath: join(root, "docs/handover/BOOTSTRAP_VALIDATION_REPORT.md"),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--database-url") out.databaseUrl = argv[++i] || "";
    else if (a === "--docker") out.docker = argv[++i] || "";
    else if (a === "--db-name") out.dbName = argv[++i] || "thinkway";
    else if (a === "--skip-stubs") out.skipStubs = true;
    else if (a === "--stop-after") out.stopAfter = argv[++i] || null;
    else if (a === "--report") out.reportPath = argv[++i] || out.reportPath;
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function runPsql(args, filePath) {
  if (args.docker) {
    const remote = `/tmp/tw-bootstrap-${basename(filePath)}`;
    const cp = spawnSync(
      "docker",
      ["cp", filePath, `${args.docker}:${remote}`],
      { encoding: "utf8" },
    );
    if (cp.status !== 0) {
      return {
        ok: false,
        status: cp.status,
        stdout: cp.stdout || "",
        stderr: cp.stderr || "docker cp failed",
        error: cp.error,
      };
    }
    const result = spawnSync(
      "docker",
      [
        "exec",
        "-e",
        "PGOPTIONS=-c client_min_messages=warning",
        args.docker,
        "psql",
        "-U",
        "postgres",
        "-d",
        args.dbName,
        "-v",
        "ON_ERROR_STOP=1",
        "-X",
        "-q",
        "-f",
        remote,
      ],
      { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
    );
    return {
      ok: result.status === 0,
      status: result.status,
      stdout: result.stdout || "",
      stderr: result.stderr || "",
      error: result.error,
    };
  }

  const result = spawnSync(
    psqlBin,
    [
      args.databaseUrl,
      "-v",
      "ON_ERROR_STOP=1",
      "-X",
      "-q",
      "-f",
      filePath,
    ],
    {
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
      env: { ...process.env, PGOPTIONS: "-c client_min_messages=warning" },
    },
  );
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    error: result.error,
  };
}

function detectNeedsStubs(args) {
  const sql =
    "SELECT to_regclass('auth.users') IS NULL OR to_regclass('storage.buckets') IS NULL;";
  let result;
  if (args.docker) {
    result = spawnSync(
      "docker",
      [
        "exec",
        args.docker,
        "psql",
        "-U",
        "postgres",
        "-d",
        args.dbName,
        "-v",
        "ON_ERROR_STOP=1",
        "-X",
        "-tAc",
        sql,
      ],
      { encoding: "utf8" },
    );
  } else {
    result = spawnSync(
      psqlBin,
      [args.databaseUrl, "-v", "ON_ERROR_STOP=1", "-X", "-tAc", sql],
      { encoding: "utf8" },
    );
  }
  if (result.status !== 0) {
    throw new Error(
      `Failed probing auth/storage: ${result.stderr || result.error || "unknown"}`,
    );
  }
  return String(result.stdout || "").trim() === "t";
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (!args.databaseUrl && !args.docker)) {
    console.log(
      "Usage: node scripts/bootstrap-empty-database.mjs (--database-url <url> | --docker <container>) [--skip-stubs] [--stop-after <step>]",
    );
    process.exit(args.help ? 0 : 1);
  }

  const migrations = readdirSync(join(root, "supabase/migrations"))
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => join(root, "supabase/migrations", f));

  /** @type {{ step: string, file: string, status: string, detail?: string }[]} */
  const log = [];
  const steps = [];

  const needsStubs = args.skipStubs ? false : detectNeedsStubs(args);
  if (needsStubs) {
    steps.push({
      id: "stubs",
      file: join(root, "supabase/bootstrap/supabase_platform_stubs.sql"),
    });
  } else {
    log.push({
      step: "stubs",
      file: "supabase/bootstrap/supabase_platform_stubs.sql",
      status: "skipped",
      detail: args.skipStubs
        ? "--skip-stubs"
        : "auth.users and storage.buckets already present",
    });
  }

  steps.push(
    { id: "schema", file: join(root, "supabase/schema.sql") },
    { id: "seed", file: join(root, "supabase/seed.sql") },
    { id: "policies", file: join(root, "supabase/policies.sql") },
    { id: "storage", file: join(root, "supabase/storage.sql") },
  );

  for (const mig of migrations) {
    steps.push({ id: "migration", file: mig });
  }

  let failed = null;
  for (const step of steps) {
    const rel = step.file.replace(root + "\\", "").replace(root + "/", "");
    if (!existsSync(step.file)) {
      failed = { step: step.id, file: rel, detail: "file missing" };
      log.push({ step: step.id, file: rel, status: "missing" });
      break;
    }

    process.stdout.write(`→ ${step.id}: ${rel} ... `);
    const result = runPsql(args, step.file);
    if (!result.ok) {
      const detail = [result.stderr, result.stdout, result.error?.message]
        .filter(Boolean)
        .join("\n")
        .trim();
      console.log("FAIL");
      log.push({ step: step.id, file: rel, status: "fail", detail });
      failed = { step: step.id, file: rel, detail };
      break;
    }
    console.log("ok");
    log.push({ step: step.id, file: rel, status: "ok" });

    if (args.stopAfter && step.id === args.stopAfter) {
      console.log(`Stopped after step: ${args.stopAfter}`);
      break;
    }
  }

  const applied = log.filter((l) => l.status === "ok").length;
  const report = [
    "# Bootstrap Validation Report",
    "",
    `**Generated:** ${new Date().toISOString()}`,
    `**Database:** (url redacted)`,
    `**Result:** ${failed ? "FAILED" : "PASSED"}`,
    `**Steps applied:** ${applied}`,
    "",
    "## Execution order",
    "",
    "1. Platform stubs (if auth/storage missing)",
    "2. `supabase/schema.sql`",
    "3. `supabase/seed.sql`",
    "4. `supabase/policies.sql`",
    "5. `supabase/storage.sql`",
    "6. All `supabase/migrations/*.sql` (lexicographic)",
    "",
    "## Step log",
    "",
    "| Status | Step | File |",
    "|--------|------|------|",
    ...log.map(
      (l) =>
        `| ${l.status} | ${l.step} | \`${l.file.replace(/\\/g, "/")}\` |`,
    ),
    "",
  ];

  if (failed) {
    report.push(
      "## Failure",
      "",
      `- **Step:** ${failed.step}`,
      `- **File:** \`${failed.file.replace(/\\/g, "/")}\``,
      "",
      "```",
      failed.detail || "(no detail)",
      "```",
      "",
    );
  } else {
    report.push("## Failure", "", "_None — full replay succeeded._", "");
  }

  mkdirSync(dirname(args.reportPath), { recursive: true });
  writeFileSync(args.reportPath, report.join("\n"), "utf8");
  console.log(`Report: ${args.reportPath}`);

  if (failed) {
    console.error(`\nBootstrap failed at ${failed.file}`);
    process.exit(1);
  }
  console.log("\nBootstrap succeeded.");
}

main();
