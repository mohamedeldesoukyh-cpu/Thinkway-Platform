#!/usr/bin/env node
/**
 * Smoke-test Apify metrics for any supported platform URL.
 *
 * Run: npm run test:apify-platform -- <platform-url>
 * Example:
 *   npm run test:apify-platform -- https://www.tiktok.com/@apifyoffice/video/7200360993149553925
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

import { detectPublicationPlatform } from "@/lib/performance/metrics-collector/detect-platform";
import { getMetricsCollectorEnv } from "@/lib/performance/metrics-collector/config";
import { computeEngagements } from "@/lib/performance/metrics-collector/merge-metrics";
import { tryApifyProvider } from "@/lib/performance/metrics-collector/providers/apify";
import { calculateEngagementRate } from "@/lib/campaigns/performance-calculations";

const root = path.dirname(fileURLToPath(import.meta.url)) + "/..";

if (existsSync(path.join(root, ".env.local"))) {
  config({ path: path.join(root, ".env.local") });
}
config({ path: path.join(root, ".env") });

async function main() {
  const url = process.argv[2]?.trim();
  if (!url) {
    console.error("Usage: npm run test:apify-platform -- <content-url>");
    process.exit(1);
  }

  const env = getMetricsCollectorEnv();
  if (!env.apifyToken) {
    console.error("APIFY_TOKEN not configured.");
    process.exit(1);
  }

  const detection = detectPublicationPlatform({
    id: "smoke",
    campaign_header_id: "smoke",
    platform: "instagram",
    content_url: url,
    external_media_id: null,
    publication_type: "smoke",
  });

  console.log(`Platform: ${detection.platform}`);
  console.log(`Media id: ${detection.mediaId ?? "—"}`);
  console.log(`URL: ${url}`);

  const result = await tryApifyProvider({
    publication: { content_url: url },
    platform: detection.platform,
    contentUrl: url,
    env,
  });

  console.log(`Provider: ${result.provider}`);
  console.log(`Status: ${result.skippedReason ?? result.error ?? "success"}`);
  console.log(`Duration: ${result.durationMs ?? "—"}ms`);

  if (!result.metrics) {
    console.error("No metrics returned.");
    process.exit(1);
  }

  const metrics = result.metrics;
  const engagements = metrics.engagements ?? computeEngagements(metrics);
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

  console.log(`Views: ${metrics.views ?? "—"}`);
  console.log(`Likes: ${metrics.likes ?? "—"}`);
  console.log(`Comments: ${metrics.comments ?? "—"}`);
  console.log(`Publication date: ${result.publicationDate ?? "—"}`);
  console.log(`Engagements: ${engagements ?? "—"}`);
  console.log(`Engagement rate: ${engagementRate != null ? `${engagementRate.toFixed(3)}%` : "—"}`);
  console.log(`Publication date: ${result.publicationDate ?? "—"}`);
  if (result.publicationContent) {
    console.log(`Caption: ${result.publicationContent.caption ?? "—"}`);
    console.log(`Hashtags: ${result.publicationContent.hashtags ?? "—"}`);
    console.log(`Mentions: ${result.publicationContent.mentions ?? "—"}`);
    console.log(
      `Content sources: caption=${result.publicationContent.caption_source} hashtags=${result.publicationContent.hashtags_source} mentions=${result.publicationContent.mentions_source}`
    );
  } else {
    console.log("Publication content: — (no caption/hashtags/mentions extracted)");
  }
  console.log("✓ Apify platform smoke test finished.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
