import { Worker, type Job } from "bullmq";

import { getRedisConnection } from "../queues/connection.js";
import { QUEUES } from "../queues/names.js";
import { runHashtagDiscovery } from "../discovery/hashtag-discovery.js";
import { runCompetitorDiscovery } from "../discovery/competitor-discovery.js";
import { runLocationDiscovery } from "../discovery/location-discovery.js";
import { runTrendDiscovery } from "../discovery/trend-discovery.js";
import {
  DiscoveryJobTracker,
  type DiscoveryJobOutcome,
  type DiscoveryJobResult,
} from "../discovery/job-observability.js";
import { seedMockProfiles } from "../discovery/mock-seed.js";
import { config } from "../config.js";
import type { DiscoveryPlatform } from "../crawlers/types.js";

export type DiscoveryJobData = {
  jobId?: string;
  method: "hashtag" | "competitor" | "location" | "trend" | "manual";
  platform?: DiscoveryPlatform;
  hashtag?: string;
  seedUsername?: string;
  locationCountry?: string;
  locationQuery?: string;
  trendKey?: string;
  limit?: number;
};

type CrawlMethodResult = {
  discovered: number;
  usernames?: string[];
};

async function runCrawlMethod(
  job: Job<DiscoveryJobData>,
  tracker: DiscoveryJobTracker
): Promise<CrawlMethodResult> {
  const { method, platform = "instagram" } = job.data;

  switch (method) {
    case "hashtag":
      tracker.log("info", `Hashtag crawl #${job.data.hashtag ?? "fashion"} on ${platform}`);
      return runHashtagDiscovery({
        platform,
        hashtag: job.data.hashtag ?? "fashion",
        limit: job.data.limit,
      });
    case "competitor":
      tracker.log("info", `Competitor crawl from @${job.data.seedUsername ?? "unknown"}`);
      return runCompetitorDiscovery({
        platform,
        seedUsername: job.data.seedUsername ?? "",
        limit: job.data.limit,
      });
    case "location":
      tracker.log(
        "info",
        `Location crawl ${job.data.locationCountry ?? "AE"} / ${job.data.locationQuery ?? "dubai"}`
      );
      return runLocationDiscovery({
        platform,
        countryCode: job.data.locationCountry ?? "AE",
        locationQuery: job.data.locationQuery ?? "dubai",
        limit: job.data.limit,
      });
    case "trend":
      tracker.log("info", `Trend crawl ${job.data.trendKey ?? "viral"}`);
      return runTrendDiscovery({
        platform: platform === "twitter" || platform === "youtube" ? "tiktok" : platform,
        trendKey: job.data.trendKey ?? "viral",
        limit: job.data.limit,
      });
    default:
      tracker.log("warn", `Unsupported method "${method}" — no live crawl available`);
      return { discovered: 0, usernames: [] };
  }
}

function resolveOutcome(
  crawlDiscovered: number,
  seedCount: number,
  crawlError: string | null
): DiscoveryJobOutcome {
  if (seedCount > 0 && crawlError) return "partial_success";
  if (seedCount > 0 && crawlDiscovered === 0) return "seeded_fallback";
  if (crawlDiscovered > 0) return "crawl_success";
  if (crawlError) return "crawl_blocked";
  return "empty";
}

export function startDiscoveryWorker(): Worker<DiscoveryJobData> {
  return new Worker<DiscoveryJobData>(
    QUEUES.discovery,
    async (job: Job<DiscoveryJobData>) => {
      const tracker = new DiscoveryJobTracker(job.data.jobId);
      await tracker.markRunning();

      let crawlResult: CrawlMethodResult = { discovered: 0, usernames: [] };
      let crawlError: string | null = null;

      try {
        crawlResult = await runCrawlMethod(job, tracker);
        tracker.log("info", `Live crawl returned ${crawlResult.discovered} profile(s)`);
      } catch (error) {
        crawlError = error instanceof Error ? error.message : "Discovery crawl failed";
        tracker.log("error", `Live crawl failed: ${crawlError}`);
      }

      const crawlDiscovered = crawlError ? 0 : Number(crawlResult.discovered ?? 0);
      let seedCount = 0;
      let seeded = false;
      let usernames = crawlResult.usernames ?? [];

      if (crawlDiscovered === 0) {
        if (config.mockSeedFallback) {
          const seedReason = crawlError ? "crawl_failed" : "crawl_empty";
          const seedResult = await seedMockProfiles({
            method: job.data.method,
            platform: job.data.platform,
            hashtag: job.data.hashtag,
            locationCountry: job.data.locationCountry,
            locationQuery: job.data.locationQuery,
            trendKey: job.data.trendKey,
            reason: seedReason,
            tracker,
          });
          seeded = true;
          seedCount = seedResult.seed_count;
          usernames = seedResult.usernames;
          crawlResult = { discovered: seedResult.discovered, usernames };
        } else {
          tracker.log("warn", "Mock seed fallback disabled — job will complete with zero profiles");
        }
      }

      const profilesAdded = seeded ? seedCount : crawlDiscovered;
      const outcome = resolveOutcome(crawlDiscovered, seedCount, crawlError);

      const result: DiscoveryJobResult = {
        discovered: profilesAdded,
        profiles_added: profilesAdded,
        crawl_discovered: crawlDiscovered,
        seeded,
        seed_count: seedCount,
        outcome,
        crawl_error: crawlError,
        usernames,
        logs: tracker.getLogs(),
        method: job.data.method,
        platform: job.data.platform,
      };

      await tracker.markCompleted(result);
      return result;
    },
    { connection: getRedisConnection(), concurrency: 2 }
  );
}
