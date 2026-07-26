#!/usr/bin/env node
/**
 * Configure Vercel Production vs Preview (Development Supabase) env isolation.
 * Does not print secret values.
 *
 * Safety: never uses `vercel env rm <name> preview` on shared Production+Preview
 * entries (that deletes the whole variable). Uses Vercel REST upserts instead.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PROJECT = "prj_GQ3PcSIedDuhKdzwLVfHPqeJzKzr";
const TEAM = "team_CgjfGGqYSvmyuXX3iNBKwrbO";
const PROD_REF = "ienowhwfyxoqtzbgltno";
const DEV_REF = "hsxrewjcbvmbkqdlzjhs";

function parseEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
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

function vercelToken() {
  const candidates = [
    path.join(
      process.env.APPDATA || "",
      "xdg.data",
      "com.vercel.cli",
      "auth.json",
    ),
    path.join(process.env.APPDATA || "", "com.vercel.cli", "auth.json"),
    path.join(
      process.env.USERPROFILE || "",
      ".local",
      "share",
      "com.vercel.cli",
      "auth.json",
    ),
  ];
  for (const p of candidates) {
    if (!p || !fs.existsSync(p)) continue;
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    if (j.token) return j.token;
  }
  throw new Error("Vercel auth token not found. Run `vercel login`.");
}

function refOf(url) {
  return String(url || "").match(/https:\/\/([^.]+)\.supabase/i)?.[1] || null;
}

function supabaseAnon(ref) {
  const r = spawnSync(
    "npx",
    ["supabase", "projects", "api-keys", "--project-ref", ref, "-o", "json"],
    { encoding: "utf8", shell: true, windowsHide: true },
  );
  if ((r.status ?? 1) !== 0) {
    throw new Error(`Failed to fetch API keys for ${ref}`);
  }
  const keys = JSON.parse(r.stdout.slice(r.stdout.indexOf("[")));
  const anon = keys.find((k) => k.name === "anon")?.api_key;
  if (!anon) throw new Error(`No anon key for ${ref}`);
  return anon;
}

async function upsertEnv({ key, value, target, gitBranch }) {
  if (!value) {
    console.log(`skip ${key} (${target}): empty`);
    return false;
  }
  const body = {
    key,
    value,
    type: "encrypted",
    target: [target],
  };
  if (gitBranch) body.gitBranch = gitBranch;

  const token = vercelToken();
  const res = await fetch(
    `https://api.vercel.com/v10/projects/${PROJECT}/env?upsert=true&teamId=${TEAM}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  console.log(
    `upsert ${key} → ${target}${gitBranch ? `/${gitBranch}` : ""} (http ${res.status})`,
  );
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    console.error(`FAILED ${key}`, j.error || j.message || res.status);
  }
  return res.ok;
}

const local = {
  ...parseEnvFile(".env"),
  ...parseEnvFile(".env.local"),
};

const prodUrl = `https://${PROD_REF}.supabase.co`;
const devUrl = `https://${DEV_REF}.supabase.co`;
const prodAnon = supabaseAnon(PROD_REF);
const devAnon = supabaseAnon(DEV_REF);

if (refOf(local.NEXT_PUBLIC_SUPABASE_URL) !== DEV_REF) {
  console.warn(
    "Local NEXT_PUBLIC_SUPABASE_URL is not Development; continuing with CLI-fetched Dev keys for Preview.",
  );
}

const redis = local.REDIS_URL || "";
const redisIsLocal = !redis || /localhost|127\.0\.0\.1|::1/i.test(redis);

console.log("=== Production labels + Production Supabase (production only) ===");
await upsertEnv({ key: "THINKWAY_ENV", value: "production", target: "production" });
await upsertEnv({
  key: "NEXT_PUBLIC_THINKWAY_ENV",
  value: "production",
  target: "production",
});
await upsertEnv({
  key: "NEXT_PUBLIC_APP_URL",
  value: "https://app.thinkwaymedia.com",
  target: "production",
});
await upsertEnv({
  key: "NEXT_PUBLIC_DEVELOPMENT_APP_URL",
  value: "https://dev.thinkwaymedia.com",
  target: "production",
});
await upsertEnv({
  key: "NEXT_PUBLIC_PRODUCTION_APP_URL",
  value: "https://app.thinkwaymedia.com",
  target: "production",
});
await upsertEnv({
  key: "EXPECTED_SUPABASE_PROJECT_REF",
  value: PROD_REF,
  target: "production",
});
await upsertEnv({
  key: "CSRF_ALLOWED_ORIGINS",
  value: "https://dev.thinkwaymedia.com,https://app.thinkwaymedia.com",
  target: "production",
});
await upsertEnv({
  key: "NEXT_PUBLIC_SUPABASE_URL",
  value: prodUrl,
  target: "production",
});
await upsertEnv({
  key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  value: prodAnon,
  target: "production",
});

console.log("=== Preview (all branches) → Development Supabase ===");
await upsertEnv({
  key: "NEXT_PUBLIC_SUPABASE_URL",
  value: devUrl,
  target: "preview",
});
await upsertEnv({
  key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  value: devAnon,
  target: "preview",
});

console.log("=== Preview/develop labels + Development Supabase ===");
const branch = "develop";
await upsertEnv({
  key: "THINKWAY_ENV",
  value: "development",
  target: "preview",
  gitBranch: branch,
});
await upsertEnv({
  key: "NEXT_PUBLIC_THINKWAY_ENV",
  value: "development",
  target: "preview",
  gitBranch: branch,
});
await upsertEnv({
  key: "NEXT_PUBLIC_APP_URL",
  value: "https://dev.thinkwaymedia.com",
  target: "preview",
  gitBranch: branch,
});
await upsertEnv({
  key: "NEXT_PUBLIC_DEVELOPMENT_APP_URL",
  value: "https://dev.thinkwaymedia.com",
  target: "preview",
  gitBranch: branch,
});
await upsertEnv({
  key: "NEXT_PUBLIC_PRODUCTION_APP_URL",
  value: "https://app.thinkwaymedia.com",
  target: "preview",
  gitBranch: branch,
});
await upsertEnv({
  key: "EXPECTED_SUPABASE_PROJECT_REF",
  value: DEV_REF,
  target: "preview",
  gitBranch: branch,
});
await upsertEnv({
  key: "CSRF_ALLOWED_ORIGINS",
  value: "https://dev.thinkwaymedia.com,https://app.thinkwaymedia.com",
  target: "preview",
  gitBranch: branch,
});
await upsertEnv({
  key: "NEXT_PUBLIC_SUPABASE_URL",
  value: devUrl,
  target: "preview",
  gitBranch: branch,
});
await upsertEnv({
  key: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  value: devAnon,
  target: "preview",
  gitBranch: branch,
});

if (local.SUPABASE_SERVICE_ROLE_KEY) {
  await upsertEnv({
    key: "SUPABASE_SERVICE_ROLE_KEY",
    value: local.SUPABASE_SERVICE_ROLE_KEY,
    target: "preview",
    gitBranch: branch,
  });
} else {
  console.log(
    "WARNING: No local SUPABASE_SERVICE_ROLE_KEY — Preview/develop service role not updated.",
  );
}

if (redisIsLocal) {
  console.log(
    "WARNING: No cloud Development REDIS_URL in local .env. " +
      "Add a dedicated Development Redis on Vercel → Preview/develop. " +
      "Do not point develop at Production Redis.",
  );
} else {
  await upsertEnv({
    key: "REDIS_URL",
    value: redis,
    target: "preview",
    gitBranch: branch,
  });
  await upsertEnv({
    key: "REDIS_URL",
    value: redis,
    target: "preview",
  });
}

if (local.OPENAI_API_KEY) {
  await upsertEnv({
    key: "OPENAI_API_KEY",
    value: local.OPENAI_API_KEY,
    target: "preview",
    gitBranch: branch,
  });
}
if (local.CRON_SECRET) {
  await upsertEnv({
    key: "CRON_SECRET",
    value: local.CRON_SECRET,
    target: "preview",
    gitBranch: branch,
  });
}

console.log("Done. Production Supabase is production-only; all Preview → Development.");
