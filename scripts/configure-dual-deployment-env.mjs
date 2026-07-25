#!/usr/bin/env node
/**
 * Configure Vercel Production vs Development (Preview/`develop`) env.
 * Does not print secret values.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";

function parseEnvFile(path) {
  const out = {};
  if (!fs.existsSync(path)) return out;
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[t.slice(0, i).trim()] = v;
  }
  return out;
}

function run(args) {
  const cmd = process.platform === "win32" ? "npx.cmd" : "npx";
  const result = spawnSync(cmd, ["vercel", ...args], {
    encoding: "utf8",
    shell: true,
    windowsHide: true,
  });
  const out = `${result.stdout || ""}${result.stderr || ""}`;
  if (result.error) console.error(result.error.message);
  if (out.trim()) console.log(out.trim().split("\n").slice(-8).join("\n"));
  return result.status ?? 1;
}

function upsert(name, environment, value, gitBranch) {
  if (!value) {
    console.log(`skip ${name} (${environment}): empty`);
    return false;
  }
  const args = [
    "env",
    "add",
    name,
    environment,
    ...(gitBranch ? [gitBranch] : []),
    "--yes",
    "--force",
    "--value",
    value,
  ];
  console.log(
    `upsert ${name} → ${environment}${gitBranch ? `/${gitBranch}` : ""}`,
  );
  const code = run(args);
  if (code !== 0) console.error(`FAILED ${name} ${environment}`);
  return code === 0;
}

function rmPreview(name) {
  console.log(`rm preview association for ${name} (if present)`);
  run(["env", "rm", name, "preview", "--yes"]);
}

const local = {
  ...parseEnvFile(".env"),
  ...parseEnvFile(".env.local"),
};

const devUrl = local.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/hsxrewjcbvmbkqdlzjhs\.supabase\.co/i.test(devUrl)) {
  console.error("Local Supabase URL is not Development project. Aborting.");
  process.exit(1);
}

const redis = local.REDIS_URL || "";
const redisIsLocal = !redis || /localhost|127\.0\.0\.1|::1/i.test(redis);

console.log("=== Production labels ===");
upsert("THINKWAY_ENV", "production", "production");
upsert("NEXT_PUBLIC_THINKWAY_ENV", "production", "production");
upsert("NEXT_PUBLIC_APP_URL", "production", "https://app.thinkwaymedia.com");
upsert(
  "NEXT_PUBLIC_DEVELOPMENT_APP_URL",
  "production",
  "https://dev.thinkwaymedia.com",
);
upsert(
  "NEXT_PUBLIC_PRODUCTION_APP_URL",
  "production",
  "https://app.thinkwaymedia.com",
);
upsert("EXPECTED_SUPABASE_PROJECT_REF", "production", "ienowhwfyxoqtzbgltno");
upsert(
  "CSRF_ALLOWED_ORIGINS",
  "production",
  "https://dev.thinkwaymedia.com,https://app.thinkwaymedia.com",
);

console.log("=== Detach Preview from shared Production secrets ===");
for (const key of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "REDIS_URL",
  "NEXT_PUBLIC_APP_URL",
]) {
  rmPreview(key);
}

console.log("=== Development (Preview branch develop) ===");
const branch = "develop";
upsert("THINKWAY_ENV", "preview", "development", branch);
upsert("NEXT_PUBLIC_THINKWAY_ENV", "preview", "development", branch);
upsert("NEXT_PUBLIC_APP_URL", "preview", "https://dev.thinkwaymedia.com", branch);
upsert(
  "NEXT_PUBLIC_DEVELOPMENT_APP_URL",
  "preview",
  "https://dev.thinkwaymedia.com",
  branch,
);
upsert(
  "NEXT_PUBLIC_PRODUCTION_APP_URL",
  "preview",
  "https://app.thinkwaymedia.com",
  branch,
);
upsert("EXPECTED_SUPABASE_PROJECT_REF", "preview", "hsxrewjcbvmbkqdlzjhs", branch);
upsert(
  "CSRF_ALLOWED_ORIGINS",
  "preview",
  "https://dev.thinkwaymedia.com,https://app.thinkwaymedia.com",
  branch,
);
upsert("NEXT_PUBLIC_SUPABASE_URL", "preview", local.NEXT_PUBLIC_SUPABASE_URL, branch);
upsert(
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "preview",
  local.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  branch,
);
upsert(
  "SUPABASE_SERVICE_ROLE_KEY",
  "preview",
  local.SUPABASE_SERVICE_ROLE_KEY,
  branch,
);

if (redisIsLocal) {
  console.log(
    "WARNING: No cloud Development REDIS_URL in local .env. " +
      "Add a dedicated Development Redis on Vercel → Preview/develop. " +
      "Do not point develop at Production Redis.",
  );
} else {
  upsert("REDIS_URL", "preview", redis, branch);
}

if (local.OPENAI_API_KEY) {
  upsert("OPENAI_API_KEY", "preview", local.OPENAI_API_KEY, branch);
}
if (local.CRON_SECRET) {
  upsert("CRON_SECRET", "preview", local.CRON_SECRET, branch);
}

console.log("Done.");
