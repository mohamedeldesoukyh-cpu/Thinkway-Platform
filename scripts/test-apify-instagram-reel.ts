#!/usr/bin/env node
/**
 * Verify Apify integration for Instagram Reel metrics (read-only smoke test).
 *
 * Run: npm run test:apify-instagram -- <instagram-reel-url>
 * Example:
 *   npm run test:apify-instagram -- https://www.instagram.com/reel/ABC123xyz/
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

import { providerChainForPlatform } from "@/lib/performance/metrics-collector/detect-platform";
import { getMetricsCollectorEnv } from "@/lib/performance/metrics-collector/config";
import { computeEngagements } from "@/lib/performance/metrics-collector/merge-metrics";
import { tryApifyProvider } from "@/lib/performance/metrics-collector/providers/apify";
import { calculateEngagementRate } from "@/lib/campaigns/performance-calculations";

const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";

if (existsSync(path.join(root, ".env.local"))) {
  config({ path: path.join(root, ".env.local") });
}
config({ path: path.join(root, ".env") });

function maskSecret(value: string | null): string {
  if (!value) return "not set";
  return `configured (${value.length} chars, prefix ${value.slice(0, 4)}…)`;
}

function printSection(title: string) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 52 - title.length))}`);
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--verbose");
  const verbose = process.argv.includes("--verbose");
  const reelUrl = args[0]?.trim() || process.env.INSTAGRAM_REEL_TEST_URL?.trim();

  printSection("Environment");
  const env = getMetricsCollectorEnv();
  console.log(`APIFY_TOKEN (process.env):     ${maskSecret(process.env.APIFY_TOKEN?.trim() || null)}`);
  console.log(`APIFY_TOKEN (getMetricsCollectorEnv): ${maskSecret(env.apifyToken)}`);
  console.log(`APIFY_INSTAGRAM_ACTOR_ID:      ${env.apifyInstagramActorId ?? "not set"}`);
  console.log(`APIFY_TIKTOK_ACTOR_ID:         ${env.apifyTikTokActorId ?? "not set"}`);

  if (!env.apifyToken) {
    console.error("\n❌ APIFY_TOKEN is missing. Add it to .env or .env.local and retry.");
    process.exit(1);
  }

  printSection("Provider chain (Instagram)");
  const chain = providerChainForPlatform("instagram");
  console.log(chain.join(" → "));
  const apifyIndex = chain.indexOf("apify");
  if (apifyIndex === -1) {
    console.error("\n❌ Apify is not in the Instagram provider chain.");
    process.exit(1);
  }
  if (apifyIndex === 0) {
    console.log("✓ Apify is the first provider for Instagram");
  } else {
    console.log(`✓ Apify is provider #${apifyIndex + 1} for Instagram (after ${chain[apifyIndex - 1] ?? "none"})`);
  }

  if (!reelUrl) {
    console.error(
      "\n❌ Pass an Instagram Reel URL as the first argument, or set INSTAGRAM_REEL_TEST_URL."
    );
    console.error("   npm run test:apify-instagram -- https://www.instagram.com/reel/…/");
    process.exit(1);
  }

  printSection("Apify fetch");
  console.log(`URL: ${reelUrl}`);
  console.log(`Actor: ${env.apifyInstagramActorId}`);
  console.log("Calling tryApifyProvider…");

  const started = Date.now();
  const result = await tryApifyProvider({
    publication: { content_url: reelUrl },
    platform: "instagram",
    contentUrl: reelUrl,
    env: {
      apifyToken: env.apifyToken,
      apifyInstagramActorId: env.apifyInstagramActorId,
      apifyTikTokActorId: env.apifyTikTokActorId,
      apifyFacebookActorId: env.apifyFacebookActorId ?? null,
      apifyYouTubeActorId: env.apifyYouTubeActorId ?? null,
      apifySnapchatActorId: env.apifySnapchatActorId ?? null,
    },
  });
  const durationMs = Date.now() - started;

  console.log(`Duration: ${durationMs}ms`);
  console.log(`Provider: ${result.provider}`);
  console.log(`Available: ${result.available}`);
  if (result.skippedReason) console.log(`Skipped: ${result.skippedReason}`);
  if (result.error) console.log(`Error: ${result.error} (${result.errorCode ?? "n/a"})`);

  if (!result.metrics) {
    console.error("\n❌ No metrics returned from Apify.");
    printConfigNotes();
    process.exit(1);
  }

  const metrics = result.metrics;
  const hasCoreMetrics = Boolean(metrics.views || metrics.likes || metrics.comments);

  if (!hasCoreMetrics && verbose) {
    printSection("Raw Apify probe");
    const probe = await fetch(
      `https://api.apify.com/v2/acts/${encodeURIComponent(env.apifyInstagramActorId!)}/run-sync-get-dataset-items?token=${env.apifyToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directUrls: [reelUrl], resultsLimit: 1 }),
        signal: AbortSignal.timeout(120_000),
      }
    );
    const items = (await probe.json()) as unknown;
    if (Array.isArray(items) && items[0] && typeof items[0] === "object") {
      const row = items[0] as Record<string, unknown>;
      console.log("Top-level keys:", Object.keys(row).join(", "));
      console.log("Sample:", JSON.stringify(row, null, 2).slice(0, 1500));
    } else {
      console.log("Response:", JSON.stringify(items, null, 2).slice(0, 1500));
    }
  }

  if (!hasCoreMetrics) {
    console.error("\n⚠ Apify responded but views/likes/comments were not mapped.");
    printConfigNotes();
    process.exit(1);
  }
  const engagements =
    metrics.engagements ??
    computeEngagements(metrics);
  const engagementRate =
    metrics.engagement_rate ??
    calculateEngagementRate({
      impressions: metrics.impressions ?? null,
      reach: metrics.reach ?? null,
      views: metrics.views ?? null,
      likes: metrics.likes ?? null,
      comments: metrics.comments ?? null,
      shares: metrics.shares ?? null,
      saves: metrics.saves ?? null,
      clicks: metrics.clicks ?? null,
      cost: null,
    });

  printSection("Metrics");
  console.log(`Views:       ${metrics.views ?? "—"}`);
  console.log(`Likes:       ${metrics.likes ?? "—"}`);
  console.log(`Comments:    ${metrics.comments ?? "—"}`);
  console.log(`Shares:      ${metrics.shares ?? "—"}`);
  console.log(`Saves:       ${metrics.saves ?? "—"}`);
  console.log(`Engagements: ${engagements ?? "—"}`);
  console.log(
    `Engagement rate: ${
      engagementRate != null ? `${engagementRate.toFixed(3)}%` : "—"
    }`
  );
  console.log(`Complete:    ${result.complete ? "yes" : "partial"}`);

  console.log("\n✓ Apify integration smoke test finished.");
}

function printConfigNotes() {
  console.log("\nConfiguration notes:");
  console.log("- APIFY_TOKEN: required (Apify console → Settings → Integrations)");
  console.log("- APIFY_INSTAGRAM_ACTOR_ID: optional; defaults to apify/instagram-scraper");
  console.log("- Ensure the actor accepts directUrls + resultsLimit input (see providers/apify.ts)");
  console.log("- Reel must be public; private or geo-blocked posts may return empty datasets");
  console.log("- Re-run with --verbose to dump raw Apify dataset keys when mapping is empty");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
