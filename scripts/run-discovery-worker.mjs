#!/usr/bin/env node
/**
 * Starts discovery-worker with Node system CA on Windows only
 * (local TLS / Supabase + Apify fetch). Linux images use ca-certificates.
 * Production entry is TypeScript via tsx (worker imports monorepo `@/*` sources).
 * Expects deps already installed in the image — no install at startup.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const workerDir = path.join(root, "services/discovery-worker");

const env = { ...process.env };
if (process.platform === "win32") {
  env.NODE_OPTIONS = [process.env.NODE_OPTIONS, "--use-system-ca"]
    .filter(Boolean)
    .join(" ");
}

const result = spawnSync(
  process.execPath,
  ["--import", "tsx", "src/index.ts"],
  {
    cwd: workerDir,
    stdio: "inherit",
    env,
  }
);

process.exit(result.status ?? 1);
