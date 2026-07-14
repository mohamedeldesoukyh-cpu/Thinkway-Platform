#!/usr/bin/env node
/**
 * Rollout preflight with the same Node TLS + DNS settings as `npm run dev`.
 * Without these flags, bare tsx on Windows cannot reach Supabase (corporate CA / IPv6).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const preload = "./lib/performance/app-env-preload.ts";

const env = {
  ...process.env,
  NODE_OPTIONS: [process.env.NODE_OPTIONS, "--use-system-ca", "--dns-result-order=ipv4first"]
    .filter(Boolean)
    .join(" "),
};

const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(
  npxCmd,
  ["tsx", "--import", preload, "scripts/rollout-preflight.ts", ...process.argv.slice(2)],
  { cwd: root, stdio: "inherit", env, shell: process.platform === "win32" }
);

process.exit(result.status ?? 1);
