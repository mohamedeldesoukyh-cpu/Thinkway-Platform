#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const preload = "./lib/performance/script-env-preload.ts";
const script = "scripts/backfill-creator-avatars.ts";

const env = {
  ...process.env,
  NODE_OPTIONS: [process.env.NODE_OPTIONS, "--use-system-ca"].filter(Boolean).join(" "),
};

const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(
  npxCmd,
  ["tsx", "--import", preload, script, ...process.argv.slice(2)],
  { cwd: root, stdio: "inherit", env, shell: process.platform === "win32" }
);

process.exit(result.status ?? 1);
