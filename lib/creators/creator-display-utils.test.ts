import assert from "node:assert/strict";

import {
  countryFlagImageFallbackUrls,
  countryFlagImageUrl,
  normalizeCountryCode,
  resolveCreatorEngagementRate,
  resolveCreatorFollowersCount,
} from "./creator-display-utils";
import type { UnifiedCreatorResult } from "./types";

assert.equal(normalizeCountryCode(" eg "), "EG");
assert.equal(normalizeCountryCode("EGY"), null);
assert.equal(normalizeCountryCode(null), null);

assert.equal(countryFlagImageUrl("EG", 20), "https://flagcdn.com/w40/eg.png");
assert.equal(countryFlagImageUrl("EG", 14), "https://flagcdn.com/w40/eg.png");
assert.equal(countryFlagImageUrl("EG", 24), "https://flagcdn.com/w80/eg.png");

const inlineUrl = countryFlagImageUrl("AE", 14);
assert.match(inlineUrl ?? "", /w(20|40|80|160|320|640|1280|2560)\//);
assert.doesNotMatch(inlineUrl ?? "", /w(16|24|28|32|48|56)\//);

const urls = countryFlagImageFallbackUrls("EG", 20);
assert.equal(urls[0], "https://flagcdn.com/w40/eg.png");
assert.ok(urls.includes("https://flagcdn.com/40x30/eg.png"));
assert.equal(new Set(urls).size, urls.length);

{
  const creator = {
    metrics: {
      followers: { value: 0, confidence: "verified" as const },
      engagement_rate: { value: 0, confidence: "verified" as const },
    },
    platforms: [
      {
        id: "tt-1",
        platform: "tiktok",
        handle: "karimgaadd",
        profile_url: null,
        follower_count: 58_500,
        engagement_rate: 3.14,
        audience_country: "EG",
        is_verified: false,
      },
    ],
    default_metrics_platform_account_id: "tt-1",
  } as Pick<
    UnifiedCreatorResult,
    "metrics" | "platforms" | "default_metrics_platform_account_id"
  >;

  assert.equal(
    resolveCreatorFollowersCount(creator, "tiktok"),
    58_500,
    "falls back to platform account when DNA metrics are zero"
  );

  assert.equal(
    resolveCreatorEngagementRate(creator, "tiktok"),
    3.14,
    "falls back to platform account ER when DNA metrics are zero"
  );
}

console.log("creator-display-utils tests passed");
