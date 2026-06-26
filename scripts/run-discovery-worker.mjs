#!/usr/bin/env node
/**
 * Starts discovery-worker with Node system CA (Windows TLS / Supabase + Apify fetch).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const workerDir = path.join(root, "services/discovery-worker");

const env = {
  ...process.env,
  NODE_OPTIONS: [process.env.NODE_OPTIONS, "--use-system-ca"].filter(Boolean).join(" "),
};

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npmCmd, ["run", "start"], {
  cwd: workerDir,
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
