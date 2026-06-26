#!/usr/bin/env npx tsx
import { config } from "dotenv";
config({ path: ".env" });

import { getMetricsCollectorEnv } from "@/lib/performance/metrics-collector/config";

const url = "https://www.instagram.com/p/DX2Sm9IIOfQ/";

function findFollowerKeys(obj: unknown, prefix = ""): void {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => findFollowerKeys(item, `${prefix}[${i}]`));
    return;
  }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (/follow|fan|subscriber/i.test(k)) {
      console.log(`${path}:`, JSON.stringify(v)?.slice(0, 200));
    }
    if (v && typeof v === "object") findFollowerKeys(v, path);
  }
}

async function main() {
  const env = getMetricsCollectorEnv();
  const probe = await fetch(
    `https://api.apify.com/v2/acts/${encodeURIComponent(env.apifyInstagramActorId!)}/run-sync-get-dataset-items?token=${env.apifyToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directUrls: [url], resultsLimit: 1 }),
      signal: AbortSignal.timeout(120_000),
    }
  );
  const items = (await probe.json()) as unknown;
  const row = Array.isArray(items) && items[0] && typeof items[0] === "object"
    ? (items[0] as Record<string, unknown>)
    : null;
  if (!row) {
    console.log("no row", items);
    return;
  }
  console.log("Top keys:", Object.keys(row).join(", "));
  console.log("\nFollower-related fields:");
  findFollowerKeys(row);
  console.log("\nowner:", JSON.stringify(row.owner, null, 2)?.slice(0, 800));
  console.log("\nauthorMeta:", JSON.stringify(row.authorMeta, null, 2)?.slice(0, 800));
}

main().catch(console.error);
