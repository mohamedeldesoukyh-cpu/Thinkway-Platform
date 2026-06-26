import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  formatEnvSearchMessage,
  formatScriptError,
  getScriptEnvFilePaths,
  loadScriptEnv,
  requireScriptEnvVars,
  SCRIPT_ENV_RELATIVE_PATHS,
} from "@/lib/performance/script-env";

function withTempRoot(run: (root: string) => void): void {
  const root = mkdtempSync(path.join(os.tmpdir(), "script-env-test-"));
  try {
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function writeEnvFile(root: string, relative: string, contents: string): void {
  const filePath = path.join(root, relative);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, contents, "utf8");
}

// --- file search paths ---
assert.deepEqual(
  SCRIPT_ENV_RELATIVE_PATHS,
  [".env.local", ".env", "services/discovery-worker/.env"]
);

withTempRoot((root) => {
  const paths = getScriptEnvFilePaths(root);
  assert.equal(paths.length, 3);
  assert.ok(paths[0]!.endsWith(`${path.sep}.env.local`));
  assert.ok(paths[1]!.endsWith(`${path.sep}.env`));
  assert.ok(paths[2]!.endsWith(`${path.sep}services${path.sep}discovery-worker${path.sep}.env`));
});

// --- load order: later overrides earlier ---
withTempRoot((root) => {
  writeEnvFile(root, ".env", "FOO=from-dotenv\nBAR=from-dotenv\n");
  writeEnvFile(root, ".env.local", "FOO=from-local\n");
  writeEnvFile(root, "services/discovery-worker/.env", "FOO=from-worker\nBAR=from-worker\n");

  const result = loadScriptEnv(root);
  assert.equal(process.env.FOO, "from-worker");
  assert.equal(process.env.BAR, "from-worker");

  assert.equal(result.files.length, 3);
  assert.equal(result.files.filter((f) => f.loaded).length, 3);
});

// --- formatEnvSearchMessage lists searched files ---
withTempRoot((root) => {
  writeEnvFile(root, ".env", "PING=1\n");
  const result = loadScriptEnv(root);
  const message = formatEnvSearchMessage(result);

  assert.match(message, /Searched env files/);
  for (const entry of result.files) {
    assert.match(message, new RegExp(entry.path.replace(/\\/g, "\\\\")));
    assert.match(message, entry.found ? /loaded/ : /not found/);
  }
});

// --- missing var errors include searched paths ---
withTempRoot((root) => {
  writeEnvFile(root, ".env", "OTHER=value\n");
  loadScriptEnv(root);
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;

  assert.throws(
    () => requireScriptEnvVars(["NEXT_PUBLIC_SUPABASE_URL"]),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL/);
      assert.match(error.message, /Searched env files/);
      assert.ok(error.message.includes(path.join(root, ".env")));
      return true;
    }
  );
});

withTempRoot((root) => {
  writeEnvFile(root, ".env", "NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co\n");
  loadScriptEnv(root);
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  assert.throws(
    () => requireScriptEnvVars(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /SUPABASE_SERVICE_ROLE_KEY/);
      assert.match(error.message, /Searched env files/);
      return true;
    }
  );
});

// --- formatScriptError unwraps fetch failures ---
{
  const nested = new TypeError("connect ECONNREFUSED", {
    cause: new Error("socket hang up"),
  });
  const fetchErr = new TypeError("fetch failed", { cause: nested });
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  const message = formatScriptError(fetchErr);
  assert.match(message, /fetch failed/);
  assert.match(message, /caused by:/);
  assert.match(message, /example\.supabase\.co/);
  assert.match(message, /no localhost HTTP/);
  assert.match(message, /metrics audit URL:/);
  assert.match(message, /campaign_publications/);
}

console.log("script-env.test.ts: all assertions passed");
