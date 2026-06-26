#!/usr/bin/env node
/**
 * Runs verify-campaign-performance-schema.ts with Node system CA (Windows TLS)
 * and npx tsx (tsx is not a direct dependency).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const script = path.join(root, "scripts/verify-campaign-performance-schema.ts");

const env = {
  ...process.env,
  NODE_OPTIONS: [process.env.NODE_OPTIONS, "--use-system-ca"].filter(Boolean).join(" "),
};

const npxCmd = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(npxCmd, ["tsx", script], {
  cwd: root,
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
