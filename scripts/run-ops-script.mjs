#!/usr/bin/env node
/**
 * Common launcher for operational TypeScript scripts (rollout, backfill,
 * diagnostics, traces):
 *
 *   node scripts/run-ops-script.mjs <script.ts> [args...]
 *
 * Applies the SAME Node runtime settings as the dev server (scripts/run-dev.mjs):
 *   --use-system-ca              trust the OS cert store (corporate SSL inspection)
 *   --dns-result-order=ipv4first avoid undici connect timeouts to Supabase via broken IPv6
 *
 * Without these, bare `npx tsx` scripts fail with "TypeError: fetch failed" on
 * networks where the running app works fine — the exact failure that hit
 * trace-discovery and then backfill-creator-intelligence. One launcher, one
 * place for this logic; per-script launcher copies are retired.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const [script, ...args] = process.argv.slice(2);

if (!script) {
  console.error("Usage: node scripts/run-ops-script.mjs <script.ts> [args...]");
  process.exit(1);
}

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
