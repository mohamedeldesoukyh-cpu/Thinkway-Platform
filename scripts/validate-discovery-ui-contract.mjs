#!/usr/bin/env node
/**
 * Discovery UI Contract validator (CI entrypoint).
 * Run: npm run validate:discovery-ui-contract
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const result = spawnSync(
  "npx",
  ["tsx", "features/discovery/components/discovery-ui-contract.test.ts"],
  { cwd: ROOT, stdio: "inherit", shell: true }
);

process.exit(result.status ?? 1);
