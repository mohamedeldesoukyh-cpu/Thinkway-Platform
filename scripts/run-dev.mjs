#!/usr/bin/env node
/**
 * Starts Next.js dev with Node system CA trust (Windows TLS / corporate proxy compatibility).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const env = {
  ...process.env,
  NODE_OPTIONS: [process.env.NODE_OPTIONS, "--use-system-ca"].filter(Boolean).join(" "),
};

const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(npxCmd, ["next", "dev", ...process.argv.slice(2)], {
  cwd: root,
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
