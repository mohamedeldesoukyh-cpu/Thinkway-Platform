#!/usr/bin/env node
/**
 * Local Discovery setup health check (no secrets printed).
 * Run: node scripts/verify-local-discovery.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Redis from "ioredis";

const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";

function parseEnv(file) {
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

function status(ok, label, detail = "") {
  const icon = ok ? "PASS" : "FAIL";
  console.log(`${icon}  ${label}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

const rootEnv = parseEnv(path.join(root, ".env"));
const workerEnv = parseEnv(path.join(root, "services/discovery-worker/.env"));

console.log("\n=== Thinkway Discovery — Local Setup Check ===\n");

// 1. Environment variables
console.log("1) Environment variables");
const rootRequired = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "REDIS_URL",
];
for (const key of rootRequired) {
  status(Boolean(rootEnv[key]), `Root .env: ${key}`);
}
status(Boolean(rootEnv.OPENAI_API_KEY), "Root .env: OPENAI_API_KEY (optional for AI match)", rootEnv.OPENAI_API_KEY ? "" : "not set — AI features use heuristics only");

status(fs.existsSync(path.join(root, "services/discovery-worker/.env")), "Worker .env exists");
for (const key of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "REDIS_URL"]) {
  status(Boolean(workerEnv[key]), `Worker .env: ${key}`);
}

// 2. Supabase
console.log("\n2) Supabase connection");
let supabaseOk = false;
if (rootEnv.NEXT_PUBLIC_SUPABASE_URL && rootEnv.SUPABASE_SERVICE_ROLE_KEY) {
  try {
    const r = await fetch(`${rootEnv.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
      headers: {
        apikey: rootEnv.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${rootEnv.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    supabaseOk = r.ok;
    status(supabaseOk, "Supabase REST API", `HTTP ${r.status}`);
  } catch (e) {
    status(false, "Supabase REST API", e.message);
  }
} else {
  status(false, "Supabase REST API", "missing URL or service role key");
}

// 3. Discovery tables
console.log("\n3) Discovery database tables");
const tables = [
  "discovered_profiles",
  "discovery_jobs",
  "discovery_shortlists",
  "discovery_shortlist_items",
  "discovery_campaign_matches",
];
if (supabaseOk) {
  for (const table of tables) {
    try {
      const r = await fetch(
        `${rootEnv.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}?select=id&limit=1`,
        {
          headers: {
            apikey: rootEnv.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${rootEnv.SUPABASE_SERVICE_ROLE_KEY}`,
          },
        }
      );
      status(r.ok, `Table: ${table}`, r.ok ? "ready" : "missing — run discovery migrations");
    } catch (e) {
      status(false, `Table: ${table}`, e.message);
    }
  }
}

// 4. Redis
console.log("\n4) Redis (job queue)");
const redisUrl = rootEnv.REDIS_URL ?? workerEnv.REDIS_URL ?? "redis://127.0.0.1:6379";
if (!rootEnv.REDIS_URL && !workerEnv.REDIS_URL) {
  status(false, "REDIS_URL configured", "not set in .env files");
}
try {
  const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
    lazyConnect: true,
    retryStrategy: () => null,
  });
  redis.on("error", () => {});
  await redis.connect();
  const pong = await redis.ping();
  redis.disconnect();
  status(pong === "PONG", "Redis ping", redisUrl.replace(/:[^:@]+@/, ":***@"));
} catch (e) {
  status(false, "Redis ping", e.message);
}

// 5. Dependencies
console.log("\n5) Dependencies");
status(fs.existsSync(path.join(root, "node_modules")), "Root node_modules");
status(fs.existsSync(path.join(root, "services/discovery-worker/node_modules")), "Worker node_modules");

console.log("\n=== Done ===\n");
console.log("Next steps if anything failed:");
console.log("  • Tables missing → npx supabase db query --linked -f supabase/migrations/20260611010000_discovery_engine.sql");
console.log("  • Integration cols → npx supabase db query --linked -f supabase/migrations/20260612010000_creator_discovery_integration.sql");
console.log("  • Redis failed → install Docker Desktop OR Memurai OR use Upstash free Redis URL");
console.log("  • Worker deps → cd services/discovery-worker && npm install");
console.log("  • Start app → npm run dev (terminal 1)");
console.log("  • Start worker → npm run discovery:worker:dev (terminal 2)\n");
