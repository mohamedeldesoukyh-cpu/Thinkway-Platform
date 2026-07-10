/**
 * INVESTIGATION REPRO — Thinkway 3.0 increment 1 (fit-first ranking).
 * Evidence script; not part of the app. Run: npx tsx repro-fit-bias.investigation.ts
 *
 * Documented two defects (pre-fix output preserved in the increment log):
 *   D1 — Missing creator data counted as a FAILED criterion (unknown == mismatch):
 *        Sparse Perfect Fit scored 56, Enriched Off-Brief 69 → off-brief ranked first.
 *   D2 — AI candidate pool was one thinkway_score-ordered page (200), so the best-fit
 *        creator (#221 by data-quality) was never scored at all.
 *
 * After the fix (tri-state scoring + dual-pool merge) this script demonstrates:
 *   D1 — Sparse Perfect Fit outranks Enriched Off-Brief (fit beats completeness).
 *   D2 — The strict pool rescues the best-fit creator into the ranked results.
 */
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import type { CampaignSearchCriterion } from "@/features/campaign-intelligence-profile/types/profile";
import { mergeAiCandidatePools } from "@/lib/discovery/ai-candidate-pool";
import {
  rankCreatorsByCampaignRelevance,
  scoreCreatorCampaignRelevance,
} from "@/lib/discovery/campaign-relevance-scoring";

function creator(overrides: Partial<UnifiedCreatorResult>): UnifiedCreatorResult {
  return {
    unified_id: "inf:base",
    source_type: "internal",
    influencer_id: "id-base",
    discovered_profile_id: null,
    document_number: null,
    display_name: "Base",
    status: "active",
    country_code: null,
    estimated_country: null,
    city: null,
    categories: [],
    browse_category_tags: [],
    audience_interests: [],
    language_codes: [],
    profile_image_url: null,
    bio: null,
    metrics: {
      followers: { value: null, confidence: "estimated" },
      engagement_rate: { value: null, confidence: "estimated" },
      avg_views: { value: null, confidence: "estimated" },
      avg_likes: { value: null, confidence: "estimated" },
      avg_comments: { value: null, confidence: "estimated" },
      posting_frequency_per_week: { value: null, confidence: "estimated" },
    },
    ai_category: null,
    ai_niche: null,
    authenticity_score: null,
    thinkway_score: 0,
    source_confidence: 0.5,
    brand_fit_score: null,
    is_platform_verified: false,
    platforms: [],
    ...overrides,
  } as UnifiedCreatorResult;
}

/** Realistic KSA luxury-beauty brief criteria (shape produced by discovery-search-mapping). */
const briefCriteria: CampaignSearchCriterion[] = [
  { id: "1", kind: "category", label: "Category", value: "Beauty", weight: 100, enabled: true, meta: { discoveryKey: "category", rawValue: "beauty" } },
  { id: "2", kind: "country", label: "Country", value: "Saudi Arabia", weight: 90, enabled: true, meta: { discoveryKey: "creator_country", rawValue: "SA" } },
  { id: "3", kind: "niche", label: "Niche", value: "skincare", weight: 80, enabled: true, meta: { discoveryKey: "niche", rawValue: "skincare" } },
  { id: "4", kind: "audience", label: "Audience gender", value: "female", weight: 80, enabled: true, meta: { discoveryKey: "audience_gender", rawValue: "female" } },
  { id: "5", kind: "brand_fit", label: "Brand fit", value: "65", weight: 70, enabled: true, meta: { discoveryKey: "brand_fit_min", rawValue: "65" } },
  { id: "6", kind: "language", label: "Language", value: "ar", weight: 60, enabled: true, meta: { discoveryKey: "language", rawValue: "ar" } },
  { id: "7", kind: "platform", label: "Platform", value: "instagram", weight: 60, enabled: true, meta: { discoveryKey: "platform", rawValue: "instagram" } },
  { id: "8", kind: "engagement", label: "Engagement", value: "2", weight: 50, enabled: true, meta: { discoveryKey: "engagement_min", rawValue: "2" } },
];

/** On-brief creator with sparse DNA: everything we KNOW about her matches the brief. */
const sparsePerfectFit = creator({
  unified_id: "inf:sparse-perfect",
  display_name: "Sparse Perfect Fit (KSA skincare)",
  country_code: "SA",
  categories: ["beauty"],
  browse_category_tags: ["beauty"],
  audience_interests: ["skincare"],
  bio: "Saudi skincare and beauty routines",
  ai_category: "Beauty",
  ai_niche: "Skincare",
  thinkway_score: 25, // low because DNA is sparse — not because she's bad
  // UNKNOWN (not yet enriched): demographics, brand_fit, language codes, metrics
  audience_demographics: undefined,
  brand_fit_score: null,
  language_codes: [],
  platforms: [
    { id: "p1", platform: "instagram", handle: "ksa_skin", profile_url: null, follower_count: null, engagement_rate: null, audience_country: "SA", profile_picture_url: null, is_verified: false, avg_views: null },
  ],
});

/** Off-brief creator with rich DNA: wrong content, but every data field is populated. */
const enrichedOffBrief = creator({
  unified_id: "inf:enriched-offbrief",
  display_name: "Enriched Off-Brief (lifestyle/travel)",
  country_code: "SA",
  categories: ["lifestyle", "travel"],
  browse_category_tags: ["lifestyle"],
  audience_interests: ["travel", "food"],
  bio: "Travel vlogs and lifestyle from Riyadh",
  ai_category: "Lifestyle",
  ai_niche: "Travel",
  thinkway_score: 92, // high because fully enriched
  brand_fit_score: 75,
  language_codes: ["ar", "en"],
  audience_demographics: {
    source: "provider",
    gender: { male: 28, female: 72 },
    age_bands: { "18-24": 40, "25-34": 35 },
  } as never,
  metrics: {
    followers: { value: 480_000, confidence: "verified" },
    engagement_rate: { value: 3.4, confidence: "verified" },
    avg_views: { value: 60_000, confidence: "estimated" },
    avg_likes: { value: 0, confidence: "estimated" },
    avg_comments: { value: 0, confidence: "estimated" },
    posting_frequency_per_week: { value: 0, confidence: "estimated" },
  },
  platforms: [
    { id: "p2", platform: "instagram", handle: "riyadh_life", profile_url: null, follower_count: 480_000, engagement_rate: 3.4, audience_country: "SA", profile_picture_url: null, is_verified: true, avg_views: 60_000 },
  ],
});

console.log("=== D1: unknown-data disqualification ===");
for (const c of [sparsePerfectFit, enrichedOffBrief]) {
  const b = scoreCreatorCampaignRelevance(c, briefCriteria);
  console.log(
    `${c.display_name}: score=${b.score} matched=${b.matchedCount}/${b.criterionCount} (weight ${b.matchedWeight}/${b.totalWeight})`
  );
}
const ranked = rankCreatorsByCampaignRelevance([sparsePerfectFit, enrichedOffBrief], briefCriteria, { minScore: 30 });
console.log("Ranked order:", ranked.map((c) => `${c.display_name} [${c.campaign_relevance_score}]`).join("  >  "));

console.log("\n=== D2: pool truncation by thinkway_score (AI_CAMPAIGN_PAGE_SIZE=200, has_more=false) ===");
// Simulate the server pool: unified-browse sorts merged results by thinkway_score desc
// (lib/creators/unified-browse.ts:1520,1648) and AI mode fetches exactly one page of 200
// via filtersToRelaxedBrowseParams (platform-only filter), then never paginates
// (creator-search-workspace.tsx:120,653-655,707-711).
const database: UnifiedCreatorResult[] = [];
for (let i = 0; i < 220; i++) {
  database.push(
    creator({
      unified_id: `inf:generic-${i}`,
      display_name: `Generic Enriched ${i}`,
      country_code: "AE",
      categories: ["lifestyle"],
      ai_category: "Lifestyle",
      thinkway_score: 50 + (i % 45), // 50–94, all above the perfect fit
      brand_fit_score: 70,
      language_codes: ["en"],
      platforms: [{ id: `pg${i}`, platform: "instagram", handle: `gen${i}`, profile_url: null, follower_count: 100_000, engagement_rate: 2.5, audience_country: "AE", profile_picture_url: null, is_verified: false, avg_views: 10_000 }],
    })
  );
}
database.push(sparsePerfectFit); // thinkway_score 25 → ranks #221 of 221 by data-quality

const relaxedPool = [...database]
  .sort((a, b) => (b.thinkway_score ?? 0) - (a.thinkway_score ?? 0))
  .slice(0, 200); // legacy AI-mode pool: one page ordered by data-quality

const legacyResults = rankCreatorsByCampaignRelevance(relaxedPool, briefCriteria, { minScore: 30 });
console.log(`Database size: ${database.length}; relaxed pool: ${relaxedPool.length}`);
console.log(
  `LEGACY single pool — best-fit creator visible: ${legacyResults.some((c) => c.unified_id === "inf:sparse-perfect")}`
);

// Fixed pipeline: strict (brief-filtered) pool merged in front of the relaxed pool.
const strictPool = database.filter(
  (c) => c.country_code === "SA" && c.categories.includes("beauty")
);
const mergedPool = mergeAiCandidatePools(strictPool, relaxedPool);
const fixedResults = rankCreatorsByCampaignRelevance(mergedPool, briefCriteria, { minScore: 30 });
console.log(
  `FIXED dual pool  — best-fit creator visible: ${fixedResults.some((c) => c.unified_id === "inf:sparse-perfect")}`
);
console.log(
  `Top 3 now: ${fixedResults.slice(0, 3).map((c) => `${c.display_name} [${c.campaign_relevance_score}]`).join(", ")}`
);
