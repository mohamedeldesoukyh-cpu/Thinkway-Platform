import type { DiscoveryPlatform } from "../crawlers/types.js";
import {
  saveProfileMetrics,
  upsertDiscoveredProfile,
  type DiscoveryMethod,
} from "../db/profiles.js";
import { supabase } from "../db/supabase.js";
import type { DiscoveryJobTracker } from "./job-observability.js";

const PLATFORMS: DiscoveryPlatform[] = ["instagram", "tiktok", "youtube", "twitter"];

const COUNTRY_POOL = [
  { code: "AE", cities: ["Dubai", "Abu Dhabi", "Sharjah"] },
  { code: "SA", cities: ["Riyadh", "Jeddah", "Dammam"] },
  { code: "EG", cities: ["Cairo", "Alexandria", "Giza"] },
  { code: "US", cities: ["New York", "Los Angeles", "Miami"] },
  { code: "GB", cities: ["London", "Manchester"] },
] as const;

const CATEGORIES = [
  "beauty",
  "fashion",
  "tech",
  "food",
  "travel",
  "gaming",
  "lifestyle",
  "fitness",
  "luxury",
  "parenting",
] as const;

const FIRST_NAMES = [
  "Layla",
  "Omar",
  "Sara",
  "Noor",
  "Yasmin",
  "Khalid",
  "Maya",
  "Adam",
  "Hana",
  "Zain",
  "Aisha",
  "Rami",
  "Lina",
  "Tariq",
  "Nadia",
] as const;

const BIO_TEMPLATES = [
  "{category} creator based in {city} · {platform} content · collabs: {email}",
  "{city}-based {category} storyteller · UGC & brand partnerships",
  "Daily {category} tips from {country} · DM for campaigns",
  "Creator | {category} | {city} · authentic reviews & lifestyle",
] as const;

function platformHost(platform: DiscoveryPlatform): string {
  if (platform === "twitter") return "x.com";
  return `${platform}.com`;
}

function pick<T>(items: readonly T[], index: number): T {
  return items[index % items.length]!;
}

function followerBand(index: number): number {
  const bands = [12_500, 48_000, 125_000, 310_000, 890_000, 1_450_000];
  return bands[index % bands.length]!;
}

function engagementFor(followers: number, index: number): number {
  const base = followers >= 500_000 ? 1.2 : followers >= 100_000 ? 2.4 : 4.8;
  return Number((base + (index % 5) * 0.35).toFixed(2));
}

function thinkwayScore(followers: number, engagement: number, index: number): number {
  const raw =
    Math.log10(followers + 1) * 14 +
    engagement * 6 +
    (index % 7) * 2 +
    (CATEGORIES.length - (index % CATEGORIES.length));
  return Number(Math.min(95, Math.max(42, raw)).toFixed(1));
}

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

export async function seedMockProfiles(
  input: MockSeedInput
): Promise<{ discovered: number; usernames: string[]; seeded: true; seed_count: number }> {
  const min = 20;
  const max = 50;
  const targetCount = Math.min(
    max,
    Math.max(min, input.targetCount ?? 25 + (input.method.length % 11))
  );

  input.tracker?.log(
    "warn",
    `Applying mock seed fallback (${input.reason}) — target ${targetCount} profiles`
  );

  const preferredPlatform = input.platform ?? "instagram";
  const usernames: string[] = [];
  let discovered = 0;

  for (let i = 0; i < targetCount; i += 1) {
    const platform = i % 4 === 0 ? pick(PLATFORMS, i) : preferredPlatform;
    const country =
      input.locationCountry && i < 12
        ? COUNTRY_POOL.find((c) => c.code === input.locationCountry) ?? pick(COUNTRY_POOL, i)
        : pick(COUNTRY_POOL, i);
    const city = pick(country.cities, i);
    const category =
      input.hashtag && i < 8
        ? input.hashtag.toLowerCase().replace(/[^a-z0-9]/g, "") || pick(CATEGORIES, i)
        : pick(CATEGORIES, i + 3);
    const firstName = pick(FIRST_NAMES, i);
    const slug = `${category}_${country.code.toLowerCase()}_${String(i + 1).padStart(2, "0")}`;
    const username = `tw_${slug}`;
    const displayName = `${firstName} ${category.charAt(0).toUpperCase()}${category.slice(1)}`;
    const bio = pick(BIO_TEMPLATES, i)
      .replace("{category}", category)
      .replace("{city}", city)
      .replace("{country}", country.code)
      .replace("{platform}", platform)
      .replace("{email}", `${username}@creator.mail`);

    const followers = followerBand(i);
    const engagement = engagementFor(followers, i);
    const score = thinkwayScore(followers, engagement, i);

    const profileId = await upsertDiscoveredProfile(
      {
        platform,
        username,
        profileUrl: `https://${platformHost(platform)}/${username}`,
        displayName,
        bio,
        metadata: {
          source: "mock_seed",
          seed_reason: input.reason,
          seed_method: input.method,
          hashtag: input.hashtag ?? null,
          location_query: input.locationQuery ?? null,
          trend_key: input.trendKey ?? null,
          generated_at: new Date().toISOString(),
        },
      },
      input.method,
      input.hashtag ?? input.locationQuery ?? input.trendKey ?? "mock_seed",
      {
        countryCode: country.code,
        city,
        categoryTags: [category, platform, country.code.toLowerCase()],
        thinkwayScore: score,
        sourceConfidence: input.reason === "crawl_failed" ? 0.55 : 0.72,
        languageCodes: country.code === "EG" ? ["ar", "en"] : ["en", "ar"],
        stage: "metrics_enriched",
        metricConfidence: {
          followers: "estimated",
          engagement_rate: "estimated",
          avg_likes: "estimated",
        },
      }
    );

    await saveProfileMetrics(profileId, {
      followers,
      following: Math.round(followers * 0.08) + (i % 40),
      postsCount: 120 + i * 3,
      avgLikes: Math.round(followers * (engagement / 100) * 0.7),
      avgComments: Math.round(followers * (engagement / 100) * 0.15),
      engagementRate: engagement,
      avgViews:
        platform === "tiktok" || platform === "youtube" ? followers * 0.4 : undefined,
      postingFrequencyPerWeek: 2 + (i % 5),
      reelsViewsAvg: platform === "instagram" ? followers * 0.25 : undefined,
    });

    await supabase.from("profile_ai_scores").delete().eq("profile_id", profileId);
    await supabase.from("profile_ai_scores").insert({
      profile_id: profileId,
      category,
      niche: `${category} · ${country.code}`,
      audience_type: followers >= 500_000 ? "macro" : followers >= 100_000 ? "mid" : "micro",
      content_quality_score: Math.round(score * 0.9),
      luxury_level_score: category === "luxury" ? 88 : 55 + (i % 20),
      brand_fit_score: 60 + (i % 25),
      professionalism_score: 65 + (i % 18),
      influencer_summary: `${displayName} creates ${category} content for audiences in ${city}.`,
      audience_persona: `${country.code} ${category} enthusiasts`,
      content_style: platform === "tiktok" ? "short-form" : "visual storytelling",
    });

    usernames.push(username);
    discovered += 1;
  }

  input.tracker?.log("info", `Mock seed inserted ${discovered} profiles`);

  return { discovered, usernames, seeded: true, seed_count: discovered };
}
