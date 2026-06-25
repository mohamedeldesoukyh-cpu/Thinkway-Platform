import type { DiscoveryPlatform } from "../crawlers/types.js";
import type { DiscoveryMethod } from "../db/profiles.js";
import type { DiscoveryJobTracker } from "./job-observability.js";
import { MOCK_SEED_DISABLED_MESSAGE } from "./mock-seed-policy.js";

export type MockSeedInput = {
  method: DiscoveryMethod;
  platform?: DiscoveryPlatform;
  hashtag?: string;
  locationCountry?: string;
  locationQuery?: string;
  trendKey?: string;
  targetCount?: number;
  reason: "crawl_empty" | "crawl_failed";
  tracker?: DiscoveryJobTracker;
};

/** Permanently disabled — never inserts mock_seed discovered profiles. */
export async function seedMockProfiles(
  input: MockSeedInput
): Promise<{ discovered: number; usernames: string[]; seeded: boolean; seed_count: number }> {
  input.tracker?.log("error", MOCK_SEED_DISABLED_MESSAGE);
  throw new Error(MOCK_SEED_DISABLED_MESSAGE);
}
