import assert from "node:assert/strict";
import test from "node:test";

import {
  browseAccountQualificationActive,
  browseCandidateQualificationActive,
  browseCreatorCountryQualificationActive,
  intersectOrderedIds,
  resolveBrowseCreatorCountryCodes,
  resolveBrowsePlatformKeys,
} from "@/lib/creators/browse-candidate-qualification";
import { applyInfluencerCountriesBrowseFilter } from "@/lib/creators/country-inference";

test("resolveBrowsePlatformKeys normalizes singular and multi platforms", () => {
  assert.deepEqual(resolveBrowsePlatformKeys({ platform: "Instagram" }), ["instagram"]);
  assert.deepEqual(
    resolveBrowsePlatformKeys({ platforms: ["instagram", "tiktok", "instagram"] }),
    ["instagram", "tiktok"]
  );
  assert.deepEqual(
    resolveBrowsePlatformKeys({ platform: "tiktok", platforms: ["youtube"] }),
    ["tiktok", "youtube"]
  );
  assert.deepEqual(resolveBrowsePlatformKeys({}), []);
});

test("resolveBrowseCreatorCountryCodes prefers creatorCountries and normalizes", () => {
  assert.deepEqual(resolveBrowseCreatorCountryCodes({ country: "eg" }), ["EG"]);
  assert.deepEqual(
    resolveBrowseCreatorCountryCodes({
      country: "EG",
      creatorCountries: ["Egypt", "AE", "eg"],
    }),
    ["EG", "AE"]
  );
  assert.deepEqual(resolveBrowseCreatorCountryCodes({}), []);
});

test("qualification active flags stay false on empty filters", () => {
  assert.equal(browseAccountQualificationActive({}), false);
  assert.equal(browseCreatorCountryQualificationActive({}), false);
  assert.equal(browseCandidateQualificationActive({}), false);
});

test("qualification active when platform / metrics / countries set", () => {
  assert.equal(browseAccountQualificationActive({ platform: "instagram" }), true);
  assert.equal(browseAccountQualificationActive({ platforms: ["tiktok"] }), true);
  assert.equal(browseAccountQualificationActive({ minFollowers: 1000 }), true);
  assert.equal(browseAccountQualificationActive({ maxFollowers: 5000 }), true);
  assert.equal(browseAccountQualificationActive({ minEngagement: 2 }), true);
  assert.equal(browseAccountQualificationActive({ minViews: 10000 }), true);
  assert.equal(
    browseCreatorCountryQualificationActive({ creatorCountries: ["EG", "AE"] }),
    true
  );
  assert.equal(
    browseCandidateQualificationActive({
      platforms: ["instagram", "tiktok"],
      creatorCountries: ["EG"],
      minFollowers: 1000,
    }),
    true
  );
});

test("intersectOrderedIds preserves order and uniqueness of ordered list", () => {
  const ordered = ["a", "b", "c", "d", "e"];
  const allowed = new Set(["e", "c", "a", "z"]);
  assert.deepEqual(intersectOrderedIds(ordered, allowed), ["a", "c", "e"]);
  assert.deepEqual(intersectOrderedIds([], allowed), []);
  assert.deepEqual(intersectOrderedIds(ordered, new Set()), []);
});

test("applyInfluencerCountriesBrowseFilter builds multi-country OR", () => {
  const calls: string[] = [];
  const query = {
    eq() {
      return this;
    },
    or(filters: string) {
      calls.push(filters);
      return this;
    },
  };
  applyInfluencerCountriesBrowseFilter(query, ["EG", "AE"]);
  assert.equal(calls.length, 1);
  assert.match(calls[0]!, /country_code\.eq\.EG/);
  assert.match(calls[0]!, /country_codes\.cs\.\{EG\}/);
  assert.match(calls[0]!, /country_code\.eq\.AE/);
  assert.match(calls[0]!, /country_codes\.cs\.\{AE\}/);
});

test("applyInfluencerCountriesBrowseFilter collapses to singular when one code", () => {
  const calls: string[] = [];
  const query = {
    eq() {
      return this;
    },
    or(filters: string) {
      calls.push(filters);
      return this;
    },
  };
  applyInfluencerCountriesBrowseFilter(query, ["EG"]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0], "country_code.eq.EG,country_codes.cs.{EG}");
});

test("source: fetchInternalCreators qualifies scoped candidates before hydrate", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const source = fs.readFileSync(
    path.join(process.cwd(), "lib/creators/unified-browse.ts"),
    "utf8"
  );
  assert.match(
    source,
    /qualifyBrowseCandidateIds\([\s\S]*scopedInfluencerIds/
  );
  assert.match(source, /5b_candidate_qualification/);
  assert.ok(
    source.indexOf("qualifyBrowseCandidateIds") <
      source.indexOf("async function queryInfluencerRows"),
    "qualification must be wired before influencer row hydration helper usage in fetchInternalCreators"
  );
});

type MockAccountRow = {
  influencer_id: string;
  platform: string;
  follower_count: number | null;
  engagement_rate: number | null;
  avg_views: number | null;
};

type MockInfluencerRow = {
  id: string;
  country_code: string | null;
  country_codes: string[] | null;
};

function createQualificationMockSupabase(opts: {
  accounts: MockAccountRow[];
  influencers: MockInfluencerRow[];
  onAccountQuery?: (filters: Record<string, unknown>) => void;
  onInfluencerQuery?: (filters: Record<string, unknown>) => void;
}) {
  return {
    from(table: string) {
      if (table === "influencer_platform_accounts") {
        const state: {
          ids: string[] | null;
          platformEq: string | null;
          platformsIn: string[] | null;
          minFollowers: number | null;
          maxFollowers: number | null;
          minEngagement: number | null;
          minViews: number | null;
        } = {
          ids: null,
          platformEq: null,
          platformsIn: null,
          minFollowers: null,
          maxFollowers: null,
          minEngagement: null,
          minViews: null,
        };
        const builder = {
          select() {
            return builder;
          },
          in(column: string, values: string[]) {
            if (column === "influencer_id") state.ids = values;
            if (column === "platform") state.platformsIn = values;
            return builder;
          },
          eq(column: string, value: string) {
            if (column === "platform") state.platformEq = value;
            return builder;
          },
          gte(column: string, value: number) {
            if (column === "follower_count") state.minFollowers = value;
            if (column === "engagement_rate") state.minEngagement = value;
            if (column === "avg_views") state.minViews = value;
            return builder;
          },
          lte(column: string, value: number) {
            if (column === "follower_count") state.maxFollowers = value;
            return builder;
          },
          then(
            resolve: (value: { data: Array<{ influencer_id: string }>; error: null }) => unknown
          ) {
            opts.onAccountQuery?.({ ...state });
            const rows = opts.accounts.filter((row) => {
              if (state.ids && !state.ids.includes(row.influencer_id)) return false;
              if (state.platformEq && row.platform !== state.platformEq) return false;
              if (state.platformsIn && !state.platformsIn.includes(row.platform)) return false;
              if (
                state.minFollowers != null &&
                (row.follower_count == null || row.follower_count < state.minFollowers)
              ) {
                return false;
              }
              if (
                state.maxFollowers != null &&
                (row.follower_count == null || row.follower_count > state.maxFollowers)
              ) {
                return false;
              }
              if (
                state.minEngagement != null &&
                (row.engagement_rate == null || row.engagement_rate < state.minEngagement)
              ) {
                return false;
              }
              if (
                state.minViews != null &&
                (row.avg_views == null || row.avg_views < state.minViews)
              ) {
                return false;
              }
              return true;
            });
            const deduped = [
              ...new Map(
                rows.map((row) => [
                  row.influencer_id,
                  {
                    influencer_id: row.influencer_id,
                    follower_count: row.follower_count,
                  },
                ])
              ).values(),
            ];
            return Promise.resolve(resolve({ data: deduped, error: null }));
          },
        };
        return builder;
      }

      if (table === "influencers") {
        const state: {
          ids: string[] | null;
          orFilter: string | null;
        } = { ids: null, orFilter: null };
        const builder = {
          select() {
            return builder;
          },
          in(column: string, values: string[]) {
            if (column === "id") state.ids = values;
            return builder;
          },
          or(filters: string) {
            state.orFilter = filters;
            return builder;
          },
          then(resolve: (value: { data: Array<{ id: string }>; error: null }) => unknown) {
            opts.onInfluencerQuery?.({ ...state });
            const codes = new Set<string>();
            if (state.orFilter) {
              for (const match of state.orFilter.matchAll(/country_code\.eq\.([A-Z]{2})/g)) {
                codes.add(match[1]!);
              }
            }
            const rows = opts.influencers.filter((row) => {
              if (state.ids && !state.ids.includes(row.id)) return false;
              if (codes.size === 0) return true;
              if (row.country_code && codes.has(row.country_code)) return true;
              return (row.country_codes ?? []).some((code) => codes.has(code));
            });
            return Promise.resolve(
              resolve({ data: rows.map((row) => ({ id: row.id })), error: null })
            );
          },
        };
        return builder;
      }

      throw new Error(`unexpected table ${table}`);
    },
  };
}

const ORDERED = ["a", "b", "c", "d", "e", "f"];

const MOCK_ACCOUNTS: MockAccountRow[] = [
  {
    influencer_id: "a",
    platform: "instagram",
    follower_count: 10_000,
    engagement_rate: 3,
    avg_views: 5_000,
  },
  {
    influencer_id: "a",
    platform: "tiktok",
    follower_count: 50_000,
    engagement_rate: 8,
    avg_views: 20_000,
  },
  {
    influencer_id: "b",
    platform: "instagram",
    follower_count: 2_000,
    engagement_rate: 1,
    avg_views: null,
  },
  {
    influencer_id: "c",
    platform: "tiktok",
    follower_count: 80_000,
    engagement_rate: 5,
    avg_views: 40_000,
  },
  {
    influencer_id: "d",
    platform: "youtube",
    follower_count: 15_000,
    engagement_rate: 4,
    avg_views: 8_000,
  },
  {
    influencer_id: "e",
    platform: "instagram",
    follower_count: null,
    engagement_rate: null,
    avg_views: null,
  },
  {
    influencer_id: "f",
    platform: "snapchat",
    follower_count: 9_000,
    engagement_rate: 2,
    avg_views: 1_000,
  },
];

const MOCK_INFLUENCERS: MockInfluencerRow[] = [
  { id: "a", country_code: "EG", country_codes: ["EG"] },
  { id: "b", country_code: "AE", country_codes: ["AE"] },
  { id: "c", country_code: null, country_codes: ["EG", "SA"] },
  { id: "d", country_code: "SA", country_codes: ["SA"] },
  { id: "e", country_code: "EG", country_codes: null },
  { id: "f", country_code: "AE", country_codes: ["AE"] },
];

test("platform Instagram only — ID-stage OR dedupes multi-account influencers", async () => {
  const { qualifyBrowseCandidateIds } = await import(
    "@/lib/creators/browse-candidate-qualification"
  );
  let accountQueries = 0;
  const supabase = createQualificationMockSupabase({
    accounts: MOCK_ACCOUNTS,
    influencers: MOCK_INFLUENCERS,
    onAccountQuery: () => {
      accountQueries += 1;
    },
  });
  const ids = await qualifyBrowseCandidateIds(
    supabase as never,
    { platform: "instagram" },
    ORDERED
  );
  assert.deepEqual(ids, ["a", "b", "e"]);
  assert.ok(accountQueries >= 1, "platform filter must query accounts at ID stage");
});

test("platform TikTok only", async () => {
  const { qualifyBrowseCandidateIds } = await import(
    "@/lib/creators/browse-candidate-qualification"
  );
  const supabase = createQualificationMockSupabase({
    accounts: MOCK_ACCOUNTS,
    influencers: MOCK_INFLUENCERS,
  });
  const ids = await qualifyBrowseCandidateIds(
    supabase as never,
    { platforms: ["tiktok"] },
    ORDERED
  );
  assert.deepEqual(ids, ["a", "c"]);
});

test("platform Instagram OR TikTok preserves order and uniqueness", async () => {
  const { qualifyBrowseCandidateIds } = await import(
    "@/lib/creators/browse-candidate-qualification"
  );
  const supabase = createQualificationMockSupabase({
    accounts: MOCK_ACCOUNTS,
    influencers: MOCK_INFLUENCERS,
  });
  const ids = await qualifyBrowseCandidateIds(
    supabase as never,
    { platforms: ["instagram", "tiktok"] },
    ORDERED
  );
  assert.deepEqual(ids, ["a", "b", "c", "e"]);
});

test("platform 3+ OR includes youtube", async () => {
  const { qualifyBrowseCandidateIds } = await import(
    "@/lib/creators/browse-candidate-qualification"
  );
  const supabase = createQualificationMockSupabase({
    accounts: MOCK_ACCOUNTS,
    influencers: MOCK_INFLUENCERS,
  });
  const ids = await qualifyBrowseCandidateIds(
    supabase as never,
    { platforms: ["instagram", "tiktok", "youtube"] },
    ORDERED
  );
  assert.deepEqual(ids, ["a", "b", "c", "d", "e"]);
});

test("country Egypt only — country_code and country_codes overlap", async () => {
  const { qualifyBrowseCandidateIds } = await import(
    "@/lib/creators/browse-candidate-qualification"
  );
  let countryQueries = 0;
  const supabase = createQualificationMockSupabase({
    accounts: MOCK_ACCOUNTS,
    influencers: MOCK_INFLUENCERS,
    onInfluencerQuery: () => {
      countryQueries += 1;
    },
  });
  const ids = await qualifyBrowseCandidateIds(
    supabase as never,
    { creatorCountries: ["EG"] },
    ORDERED
  );
  assert.deepEqual(ids, ["a", "c", "e"]);
  assert.ok(countryQueries >= 1);
});

test("country UAE only", async () => {
  const { qualifyBrowseCandidateIds } = await import(
    "@/lib/creators/browse-candidate-qualification"
  );
  const supabase = createQualificationMockSupabase({
    accounts: MOCK_ACCOUNTS,
    influencers: MOCK_INFLUENCERS,
  });
  const ids = await qualifyBrowseCandidateIds(
    supabase as never,
    { creatorCountries: ["AE"] },
    ORDERED
  );
  assert.deepEqual(ids, ["b", "f"]);
});

test("country Egypt OR UAE", async () => {
  const { qualifyBrowseCandidateIds } = await import(
    "@/lib/creators/browse-candidate-qualification"
  );
  const supabase = createQualificationMockSupabase({
    accounts: MOCK_ACCOUNTS,
    influencers: MOCK_INFLUENCERS,
  });
  const ids = await qualifyBrowseCandidateIds(
    supabase as never,
    { creatorCountries: ["EG", "AE"] },
    ORDERED
  );
  assert.deepEqual(ids, ["a", "b", "c", "e", "f"]);
});

test("country 3+ OR includes SA via country_code", async () => {
  const { qualifyBrowseCandidateIds } = await import(
    "@/lib/creators/browse-candidate-qualification"
  );
  const supabase = createQualificationMockSupabase({
    accounts: MOCK_ACCOUNTS,
    influencers: MOCK_INFLUENCERS,
  });
  const ids = await qualifyBrowseCandidateIds(
    supabase as never,
    { creatorCountries: ["EG", "AE", "SA"] },
    ORDERED
  );
  assert.deepEqual(ids, ["a", "b", "c", "d", "e", "f"]);
});

test("followers min/max at ID stage", async () => {
  const { qualifyBrowseCandidateIds } = await import(
    "@/lib/creators/browse-candidate-qualification"
  );
  const supabase = createQualificationMockSupabase({
    accounts: MOCK_ACCOUNTS,
    influencers: MOCK_INFLUENCERS,
  });
  const minIds = await qualifyBrowseCandidateIds(
    supabase as never,
    { minFollowers: 10_000 },
    ORDERED
  );
  assert.deepEqual(minIds, ["a", "c", "d"]);
  const maxIds = await qualifyBrowseCandidateIds(
    supabase as never,
    { maxFollowers: 10_000 },
    ORDERED
  );
  // a qualifies via Instagram 10k; b 2k; e null excluded; f 9k
  assert.deepEqual(maxIds, ["a", "b", "f"]);
});

test("multi followerRanges OR at ID stage", async () => {
  const { qualifyBrowseCandidateIds } = await import(
    "@/lib/creators/browse-candidate-qualification"
  );
  const supabase = createQualificationMockSupabase({
    accounts: MOCK_ACCOUNTS,
    influencers: MOCK_INFLUENCERS,
  });
  const ids = await qualifyBrowseCandidateIds(
    supabase as never,
    {
      followerRanges: [
        { min: 1_000, max: 5_000 },
        { min: 50_000, max: 200_000 },
      ],
    },
    ORDERED
  );
  // b=2k (band1); a via TT 50k + c=80k (band2); d=15k / f=9k fall in the gap
  assert.deepEqual(ids, ["a", "b", "c"]);
});

test("ER minimum and NULL metrics do not match active minima", async () => {
  const { qualifyBrowseCandidateIds } = await import(
    "@/lib/creators/browse-candidate-qualification"
  );
  const supabase = createQualificationMockSupabase({
    accounts: MOCK_ACCOUNTS,
    influencers: MOCK_INFLUENCERS,
  });
  const erIds = await qualifyBrowseCandidateIds(
    supabase as never,
    { minEngagement: 4 },
    ORDERED
  );
  assert.deepEqual(erIds, ["a", "c", "d"]);
  const viewsIds = await qualifyBrowseCandidateIds(
    supabase as never,
    { minViews: 1 },
    ORDERED
  );
  // b and e have null avg_views — excluded
  assert.deepEqual(viewsIds, ["a", "c", "d", "f"]);
});

test("composition platform + country + followers + ER preserves order", async () => {
  const { qualifyBrowseCandidateIds } = await import(
    "@/lib/creators/browse-candidate-qualification"
  );
  const supabase = createQualificationMockSupabase({
    accounts: MOCK_ACCOUNTS,
    influencers: MOCK_INFLUENCERS,
  });
  const ids = await qualifyBrowseCandidateIds(
    supabase as never,
    {
      platforms: ["instagram", "tiktok"],
      creatorCountries: ["EG", "AE"],
      minFollowers: 5_000,
      minEngagement: 3,
    },
    ORDERED
  );
  // a: IG+TT, EG, metrics ok; c: TT, EG via codes, metrics ok; b fails followers/ER on IG
  assert.deepEqual(ids, ["a", "c"]);
});

test("inactive filters skip all qualification queries", async () => {
  const { qualifyBrowseCandidateIds } = await import(
    "@/lib/creators/browse-candidate-qualification"
  );
  let queries = 0;
  const supabase = createQualificationMockSupabase({
    accounts: MOCK_ACCOUNTS,
    influencers: MOCK_INFLUENCERS,
    onAccountQuery: () => {
      queries += 1;
    },
    onInfluencerQuery: () => {
      queries += 1;
    },
  });
  const ids = await qualifyBrowseCandidateIds(supabase as never, {}, ORDERED);
  assert.deepEqual(ids, ORDERED);
  assert.equal(queries, 0);
});

test("empty candidate set is cheap", async () => {
  const { qualifyBrowseCandidateIds } = await import(
    "@/lib/creators/browse-candidate-qualification"
  );
  let queries = 0;
  const supabase = createQualificationMockSupabase({
    accounts: MOCK_ACCOUNTS,
    influencers: MOCK_INFLUENCERS,
    onAccountQuery: () => {
      queries += 1;
    },
    onInfluencerQuery: () => {
      queries += 1;
    },
  });
  const ids = await qualifyBrowseCandidateIds(
    supabase as never,
    { platform: "instagram", creatorCountries: ["EG"] },
    []
  );
  assert.deepEqual(ids, []);
  assert.equal(queries, 0);
});
