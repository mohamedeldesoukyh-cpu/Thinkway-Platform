#!/usr/bin/env node
/**
 * Starts Next.js dev with Node TLS + DNS settings for Windows compatibility.
 * --use-system-ca: trust OS cert store (corporate SSL inspection).
 * --dns-result-order=ipv4first: avoid undici connect timeouts to Supabase via broken IPv6.
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
const result = spawnSync(npxCmd, ["next", "dev", "--turbo", ...process.argv.slice(2)], {
  cwd: root,
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
