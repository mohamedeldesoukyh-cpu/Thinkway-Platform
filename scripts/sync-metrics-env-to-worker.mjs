#!/usr/bin/env node
/**
 * Copy metrics provider env vars from repo root .env into discovery-worker/.env
 * when missing. Safe to run multiple times.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";

function parseEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      out[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  return out;
}

const src = parseEnv(path.join(root, ".env"));
const workerPath = path.join(root, "services/discovery-worker/.env");
const workerText = fs.readFileSync(workerPath, "utf8");

const keys = [
  "APIFY_TOKEN",
  "APIFY_INSTAGRAM_ACTOR_ID",
  "APIFY_TIKTOK_ACTOR_ID",
  "APIFY_FACEBOOK_ACTOR_ID",
  "APIFY_YOUTUBE_ACTOR_ID",
  "APIFY_SNAPCHAT_ACTOR_ID",
  "META_GRAPH_ACCESS_TOKEN",
  "FACEBOOK_GRAPH_ACCESS_TOKEN",
  "BRIGHTDATA_API_KEY",
  "BRIGHTDATA_INSTAGRAM_DATASET_ID",
  "YOUTUBE_API_KEY",
  "TIKTOK_CLIENT_KEY",
  "TIKTOK_CLIENT_SECRET",
  "SNAPCHAT_API_KEY",
  "METRICS_PLAYWRIGHT_ENABLED",
];

const missing = keys.filter((key) => src[key] && !workerText.includes(`${key}=`));
if (!missing.length) {
  console.log("discovery-worker/.env already has all available metrics provider keys.");
  process.exit(0);
}

const block =
  "\n# Metrics provider credentials (synced from root .env for publication-metrics worker)\n" +
  missing.map((key) => `${key}=${src[key]}`).join("\n") +
  "\n";

fs.appendFileSync(workerPath, block);
console.log(`Added to discovery-worker/.env: ${missing.join(", ")}`);
