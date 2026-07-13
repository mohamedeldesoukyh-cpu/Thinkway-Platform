#!/usr/bin/env node
/**
 * Runs the Discovery diagnostic with the SAME Node TLS + DNS settings the dev
 * server uses (see scripts/run-dev.mjs):
 *   --use-system-ca            trust the OS cert store (corporate SSL inspection)
 *   --dns-result-order=ipv4first  avoid undici connect timeouts via broken IPv6
 *
 * Without these, undici's global fetch throws "TypeError: fetch failed" against
 * Supabase even though the running Next.js app connects fine — because the app
 * is launched with these exact flags and the bare `tsx` script is not.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const env = {
  ...process.env,
  NODE_OPTIONS: [process.env.NODE_OPTIONS, "--use-system-ca", "--dns-result-order=ipv4first"]
    .filter(Boolean)
    .join(" "),
};

const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(npxCmd, ["tsx", "scripts/trace-discovery.ts", ...process.argv.slice(2)], {
  cwd: root,
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
