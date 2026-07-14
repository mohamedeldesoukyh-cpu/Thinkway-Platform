#!/usr/bin/env node
/**
 * Common launcher for operational TypeScript scripts (rollout, backfill,
 * diagnostics, traces):
 *
 *   node scripts/run-ops-script.mjs <script.ts> [args...]
 *
 * ONE place for the ops runtime:
 *  - environment: loads <repo-root>/.env by ABSOLUTE path into this process and
 *    passes it to the child, so env loading never depends on the child's cwd
 *    (a per-script relative `config({ path: ".env" })` broke on Windows when
 *    the spawn cwd resolved differently between runs). Session variables still
 *    win: dotenv never overrides values already set in the shell.
 *  - Node flags (same as the dev server, scripts/run-dev.mjs):
 *      --use-system-ca              corporate SSL inspection
 *      --dns-result-order=ipv4first undici-vs-IPv6 Supabase timeouts
 *
 * Scripts launched here must NOT call dotenv themselves — exactly one
 * environment-loading path.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [script, ...args] = process.argv.slice(2);

if (!script) {
  console.error("Usage: node scripts/run-ops-script.mjs <script.ts> [args...]");
  process.exit(1);
}

// Absolute-path env load — immune to cwd differences across shells/platforms.
config({ path: path.join(root, ".env") });

const env = {
  ...process.env,
  NODE_OPTIONS: [process.env.NODE_OPTIONS, "--use-system-ca", "--dns-result-order=ipv4first"]
    .filter(Boolean)
    .join(" "),
};

const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(npxCmd, ["tsx", script, ...args], {
  cwd: root,
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
