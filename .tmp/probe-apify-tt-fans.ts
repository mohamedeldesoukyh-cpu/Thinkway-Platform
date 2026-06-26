#!/usr/bin/env npx tsx
import { config } from "dotenv";
config({ path: ".env" });
import { getMetricsCollectorEnv } from "@/lib/performance/metrics-collector/config";

async function probe(platform: string, url: string, input: Record<string, unknown>) {
  const env = getMetricsCollectorEnv();
  const actor =
    platform === "tiktok" ? env.apifyTikTokActorId : env.apifyInstagramActorId;
  const probe = await fetch(
    `https://api.apify.com/v2/acts/${encodeURIComponent(actor!)}/run-sync-get-dataset-items?token=${env.apifyToken}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(120_000),
    }
  );
  const items = (await probe.json()) as unknown;
  const row = Array.isArray(items) ? items[0] : null;
  console.log(platform, JSON.stringify(row, null, 2)?.slice(0, 1200));
}

async function main() {
  await probe("tiktok", "", {
    postURLs: ["https://www.tiktok.com/@amiryoussef.official/video/000"],
    resultsPerPage: 1,
  });
}

main().catch(console.error);
