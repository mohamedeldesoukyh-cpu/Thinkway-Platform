#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";
const preload = "./lib/performance/script-env-preload.ts";

const env = {
  ...process.env,
  NODE_OPTIONS: [process.env.NODE_OPTIONS, "--use-system-ca"].filter(Boolean).join(" "),
};

function runScript(scriptPath) {
  return spawnSync(
    "npx",
    ["tsx", "--import", preload, scriptPath],
    { cwd: root, stdio: "inherit", shell: true, env }
  );
}

export { runScript, root, preload };
