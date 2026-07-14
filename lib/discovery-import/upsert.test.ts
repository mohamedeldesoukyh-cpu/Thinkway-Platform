import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  mergeCreatorImportMetadata,
  mergeImportedStringArrays,
  resolveInfluencerImportCategories,
} from "./normalize";
import type { ParsedCreatorRow } from "./types";
import { upsertImportedCreators } from "./upsert";

function sampleRow(overrides: Partial<ParsedCreatorRow> = {}): ParsedCreatorRow {
  return {
    username: "creator_one",
    display_name: null,
    platform: "instagram",
    followers: 10_000,
    engagement_rate: 2.5,
    country: "Jordan",
    source: "indaHash",
    categories: ["Beauty"],
    audience_interests: ["Camera & Photography"],
    relevance_score: 85,
    profile_picture_url: null,
    role: null,
    appearances: null,
    contact_email: null,
    contact_phone: null,
    contact_links: [],
    ...overrides,
  };
}

function testResolveInfluencerImportCategories() {
  assert.deepEqual(
    resolveInfluencerImportCategories([], {
      categories: [],
    }),
    []
  );
  assert.deepEqual(
    resolveInfluencerImportCategories(["Beauty"], {
      categories: ["Fashion"],
    }),
    ["Beauty", "Fashion"]
  );
}

function testMergeBackfillsEmptyExisting() {
  assert.deepEqual(
    mergeImportedStringArrays([], ["Camera & Photography"]),
    ["Camera & Photography"]
  );
  assert.deepEqual(
    mergeImportedStringArrays(undefined, ["Fashion"]),
    ["Fashion"]
  );
}

function testMergeUnionsWithDedupPreservingOrder() {
  assert.deepEqual(
    mergeImportedStringArrays(["Beauty"], ["Beauty", "Fashion"]),
    ["Beauty", "Fashion"]
  );
  assert.deepEqual(
    mergeImportedStringArrays(["Beauty"], ["beauty", "Fashion"]),
    ["Beauty", "Fashion"]
  );
}

function testMergePreservesExistingWhenImportEmpty() {
  assert.deepEqual(
    mergeImportedStringArrays(["Beauty", "Fashion"], []),
    ["Beauty", "Fashion"]
  );
}

function testMergeCreatorImportMetadata() {
  const existing = {
    audience_interests: [],
    categories: ["Beauty"],
    relevance_score: 70,
    import_source: "old-source",
    imported_at: "2026-01-01T00:00:00.000Z",
    custom_field: "keep-me",
  };

  const merged = mergeCreatorImportMetadata(
    existing,
    sampleRow({
      categories: ["Beauty", "Fashion"],
      audience_interests: [
        "Camera & Photography",
        "Clothes, Shoes, Handbags & Accessories",
      ],
      relevance_score: 92,
      source: "indaHash",
    })
  );

  assert.deepEqual(merged.categories, ["Beauty", "Fashion"]);
  assert.deepEqual(merged.audience_interests, [
    "Camera & Photography",
    "Clothes, Shoes, Handbags & Accessories",
  ]);
  assert.equal(merged.relevance_score, 92);
  assert.equal(merged.import_source, "indaHash");
  assert.equal(merged.custom_field, "keep-me");
  assert.notEqual(merged.imported_at, existing.imported_at);
}

function testMergeCreatorImportMetadataPreservesRelevanceWhenImportNull() {
  const merged = mergeCreatorImportMetadata(
    { relevance_score: 77 },
    sampleRow({ relevance_score: null })
  );
  assert.equal(merged.relevance_score, 77);
}

type PlatformAccount = {
  id: string;
  influencer_id: string;
  platform: string;
  handle: string;
  username: string;
  normalized_username: string;
  follower_count: number;
  engagement_rate: number | null;
  metadata: Record<string, unknown>;
  profile_picture_url?: string | null;
  avatar_source?: string | null;
  avatar_last_synced_at?: string | null;
};

type Influencer = {
  id: string;
  display_name: string;
  country_code: string | null;
  categories: string[];
  status: string;
};

type CreatorSource = {
  id: string;
  influencer_id: string;
  source_name: string;
  source_file_id: string;
  imported_at: string;
};

function createDiscoveryImportMock(initial?: {
  influencers?: Influencer[];
  accounts?: PlatformAccount[];
  sources?: CreatorSource[];
}) {
  const influencers = [...(initial?.influencers ?? [])];
  const accounts = [...(initial?.accounts ?? [])];
  const sources = [...(initial?.sources ?? [])];
  let idCounter = 1;

  const nextId = () => `id-${idCounter++}`;

  const supabase = {
    from(table: string) {
      const filters: Record<string, unknown> = {};

      const builder = {
        select() {
          return builder;
        },
        eq(column: string, value: unknown) {
          filters[column] = value;
          return builder;
        },
        limit() {
          return builder;
        },
        order() {
          return builder;
        },
        // List/count queries are awaited directly (no maybeSingle/single) —
        // e.g. the baseline-DNA populator's account/snapshot reads. Resolve
        // known tables from state; everything else resolves empty.
        then(
          resolve: (value: { data: unknown[]; error: null; count: number }) => void,
          reject?: (reason: unknown) => void
        ) {
          try {
            let data: unknown[] = [];
            if (table === "influencer_platform_accounts") {
              data = accounts.filter(
                (row) =>
                  filters.influencer_id == null ||
                  (row as { influencer_id?: unknown }).influencer_id === filters.influencer_id
              );
            }
            resolve({ data, error: null, count: data.length });
          } catch (error) {
            reject?.(error);
          }
        },
        // Baseline-DNA writes (creator_dna upsert) — accept and discard.
        upsert() {
          return {
            select() {
              return {
                async single() {
                  return { data: null, error: null };
                },
                async maybeSingle() {
                  return { data: null, error: null };
                },
              };
            },
            then(resolve: (value: { data: null; error: null }) => void) {
              resolve({ data: null, error: null });
            },
          };
        },
        async maybeSingle() {
          if (table === "influencer_platform_accounts") {
            const match = accounts.find((row) => {
              if (
                filters.platform != null &&
                row.platform !== filters.platform
              ) {
                return false;
              }
              if (
                filters.normalized_username != null &&
                row.normalized_username !== filters.normalized_username
              ) {
                return false;
              }
              return true;
            });
            return { data: match ?? null, error: null };
          }
          if (table === "influencers") {
            const match = influencers.find((row) => row.id === filters.id);
            return {
              data: match
                ? {
                    display_name: match.display_name,
                    categories: match.categories,
                    country_code: match.country_code,
                  }
                : null,
              error: null,
            };
          }
          if (table === "creator_sources") {
            const match = sources.find(
              (row) =>
                row.influencer_id === filters.influencer_id &&
                row.source_file_id === filters.source_file_id
            );
            return { data: match ? { id: match.id } : null, error: null };
          }
          return { data: null, error: null };
        },
        async single() {
          const result = await builder.maybeSingle();
          if (!result.data) {
            return { data: null, error: { message: "not found" } };
          }
          return result;
        },
        update(patch: Record<string, unknown>) {
          const updatePatch = patch;
          return {
            eq(column: string, value: unknown) {
              filters[column] = value;
              if (table === "influencer_platform_accounts") {
                const index = accounts.findIndex((row) => row.id === filters.id);
                if (index >= 0) {
                  accounts[index] = {
                    ...accounts[index],
                    ...updatePatch,
                  } as PlatformAccount;
                }
              }
              if (table === "influencers") {
                const index = influencers.findIndex((row) => row.id === filters.id);
                if (index >= 0) {
                  influencers[index] = {
                    ...influencers[index],
                    ...updatePatch,
                  } as Influencer;
                }
              }
              if (table === "creator_sources") {
                const index = sources.findIndex((row) => row.id === filters.id);
                if (index >= 0) {
                  sources[index] = {
                    ...sources[index],
                    ...updatePatch,
                  } as CreatorSource;
                }
              }
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
        insert(payload: Record<string, unknown> | Record<string, unknown>[]) {
          const rows = Array.isArray(payload) ? payload : [payload];
          const insertBuilder = {
            select() {
              return {
                async single() {
                  if (table === "influencers") {
                    const row = rows[0] as Omit<Influencer, "id">;
                    const created: Influencer = { id: nextId(), ...row };
                    influencers.push(created);
                    return { data: { id: created.id }, error: null };
                  }
                  if (table === "influencer_platform_accounts") {
                    const row = rows[0] as Omit<PlatformAccount, "id">;
                    const created: PlatformAccount = { id: nextId(), ...row };
                    accounts.push(created);
                    return { data: { id: created.id }, error: null };
                  }
                  if (table === "creator_sources") {
                    const row = rows[0] as Omit<CreatorSource, "id">;
                    const created: CreatorSource = { id: nextId(), ...row };
                    sources.push(created);
                    return { data: created, error: null };
                  }
                  if (table === "audit_logs") {
                    return { data: null, error: null };
                  }
                  return { data: null, error: null };
                },
              };
            },
            then(
              resolve: (value: { data: null; error: null }) => void,
              reject?: (reason: unknown) => void
            ) {
              try {
                if (table === "creator_sources") {
                  const row = rows[0] as Omit<CreatorSource, "id">;
                  sources.push({ id: nextId(), ...row });
                }
                if (table === "audit_logs") {
                  // no-op
                }
                resolve({ data: null, error: null });
              } catch (error) {
                reject?.(error);
              }
            },
          };
          return insertBuilder;
        },
        delete() {
          return {
            eq() {
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
      };

      return builder;
    },
  };

  return {
    supabase: supabase as unknown as SupabaseClient,
    getState: () => ({ influencers, accounts, sources }),
  };
}

async function testFirstImportCreatesRecords() {
  const { supabase, getState } = createDiscoveryImportMock();

  const result = await upsertImportedCreators([sampleRow()], {
    supabase,
    importFileId: "file-1",
    sourceName: "indaHash",
    uploadedBy: "user-1",
    log: () => {},
  });

  const state = getState();
  assert.equal(result.imported, 1);
  assert.equal(result.updated, 0);
  assert.equal(state.influencers.length, 1);
  assert.equal(state.accounts.length, 1);
  assert.equal(state.sources.length, 1);
  assert.deepEqual(state.influencers[0]?.categories, ["Beauty"]);
  assert.deepEqual(state.accounts[0]?.metadata.audience_interests, [
    "Camera & Photography",
  ]);
  assert.equal(state.influencers[0]?.display_name, "creator_one");
}

async function testReimportDoesNotCreateDuplicates() {
  const influencerId = "inf-1";
  const accountId = "acct-1";
  const { supabase, getState } = createDiscoveryImportMock({
    influencers: [
      {
        id: influencerId,
        display_name: "creator_one",
        country_code: "JO",
        categories: [],
        status: "active",
      },
    ],
    accounts: [
      {
        id: accountId,
        influencer_id: influencerId,
        platform: "instagram",
        handle: "creator_one",
        username: "creator_one",
        normalized_username: "creator_one",
        follower_count: 9_000,
        engagement_rate: 2.1,
        metadata: {
          audience_interests: [],
          categories: [],
          relevance_score: 60,
          import_source: "indaHash",
          imported_at: "2026-01-01T00:00:00.000Z",
        },
      },
    ],
    sources: [
      {
        id: "src-1",
        influencer_id: influencerId,
        source_name: "indaHash",
        source_file_id: "file-1",
        imported_at: "2026-01-01T00:00:00.000Z",
      },
    ],
  });

  const result = await upsertImportedCreators(
    [
      sampleRow({
        categories: ["Beauty", "Fashion"],
        audience_interests: [
          "Camera & Photography",
          "Clothes, Shoes, Handbags & Accessories",
        ],
        relevance_score: 95,
      }),
    ],
    {
      supabase,
      importFileId: "file-1",
      sourceName: "indaHash",
      uploadedBy: "user-1",
      log: () => {},
    }
  );

  const state = getState();
  assert.equal(result.imported, 0);
  assert.equal(result.updated, 1);
  assert.equal(state.influencers.length, 1);
  assert.equal(state.accounts.length, 1);
  assert.equal(state.sources.length, 1);
}

async function testReimportAuthoritativeMerge() {
  const influencerId = "inf-2";
  const { supabase, getState } = createDiscoveryImportMock({
    influencers: [
      {
        id: influencerId,
        display_name: "creator_two",
        country_code: "JO",
        categories: ["Beauty"],
        status: "active",
      },
    ],
    accounts: [
      {
        id: "acct-2",
        influencer_id: influencerId,
        platform: "instagram",
        handle: "creator_two",
        username: "creator_two",
        normalized_username: "creator_two",
        follower_count: 5_000,
        engagement_rate: 1.8,
        metadata: {
          audience_interests: [],
          categories: ["Beauty"],
          relevance_score: 60,
          import_source: "indaHash",
          imported_at: "2026-01-01T00:00:00.000Z",
        },
      },
    ],
  });

  const result = await upsertImportedCreators(
    [
      sampleRow({
        username: "creator_two",
        followers: 99_000,
        categories: ["Beauty", "Fashion"],
        audience_interests: [
          "Camera & Photography",
          "Clothes, Shoes, Handbags & Accessories",
        ],
        relevance_score: 88,
      }),
    ],
    {
      supabase,
      importFileId: "file-2",
      sourceName: "indaHash",
      uploadedBy: "user-1",
      log: () => {},
    }
  );

  const state = getState();
  const account = state.accounts[0];
  const influencer = state.influencers[0];
  const metadata = account?.metadata ?? {};

  assert.equal(result.updated, 1);
  assert.equal(account?.follower_count, 99_000, "authoritative merge updates followers");
  assert.deepEqual(influencer?.categories, ["Beauty", "Fashion"], "authoritative merge updates categories");
  assert.deepEqual(metadata.audience_interests, [
    "Camera & Photography",
    "Clothes, Shoes, Handbags & Accessories",
  ], "authoritative merge updates audience_interests");
  assert.equal(metadata.relevance_score, 88, "authoritative merge updates relevance score");
  assert.equal(metadata.import_source, "indaHash");
  assert.notEqual(metadata.imported_at, "2026-01-01T00:00:00.000Z");

  const source = state.sources.find((row) => row.source_file_id === "file-2");
  assert.ok(source);
  assert.equal(source?.influencer_id, influencerId);
}

async function testReimportBackfillsCategoriesFromAudienceInterestsOnly() {
  const influencerId = "inf-audience";
  const { supabase, getState } = createDiscoveryImportMock({
    influencers: [
      {
        id: influencerId,
        display_name: "creator_audience",
        country_code: "EG",
        categories: [],
        status: "active",
      },
    ],
    accounts: [
      {
        id: "acct-audience",
        influencer_id: influencerId,
        platform: "instagram",
        handle: "creator_audience",
        username: "creator_audience",
        normalized_username: "creator_audience",
        follower_count: 1_000_000,
        engagement_rate: 1.2,
        metadata: {
          audience_interests: [],
          categories: [],
        },
      },
    ],
  });

  await upsertImportedCreators(
    [
      sampleRow({
        username: "creator_audience",
        categories: [],
        audience_interests: [
          "Camera & Photography",
          "Clothes, Shoes, Handbags & Accessories",
        ],
      }),
    ],
    {
      supabase,
      importFileId: "file-audience",
      sourceName: "indaHash",
      uploadedBy: "user-1",
      log: () => {},
    }
  );

  const state = getState();
  assert.deepEqual(state.influencers[0]?.categories, []);
  assert.deepEqual(state.accounts[0]?.metadata.audience_interests, [
    "Camera & Photography",
    "Clothes, Shoes, Handbags & Accessories",
  ]);
}

async function testReimportUpdatesExistingSourceProvenance() {
  const influencerId = "inf-3";
  const { supabase, getState } = createDiscoveryImportMock({
    influencers: [
      {
        id: influencerId,
        display_name: "creator_three",
        country_code: "JO",
        categories: [],
        status: "active",
      },
    ],
    accounts: [
      {
        id: "acct-3",
        influencer_id: influencerId,
        platform: "instagram",
        handle: "creator_three",
        username: "creator_three",
        normalized_username: "creator_three",
        follower_count: 5_000,
        engagement_rate: 1.8,
        metadata: {},
      },
    ],
    sources: [
      {
        id: "src-3",
        influencer_id: influencerId,
        source_name: "indaHash",
        source_file_id: "file-3",
        imported_at: "2026-01-01T00:00:00.000Z",
      },
    ],
  });

  await upsertImportedCreators([sampleRow({ username: "creator_three" })], {
    supabase,
    importFileId: "file-3",
    sourceName: "indaHash",
    uploadedBy: "user-1",
    log: () => {},
  });

  const state = getState();
  assert.equal(state.sources.length, 1);
  assert.notEqual(state.sources[0]?.imported_at, "2026-01-01T00:00:00.000Z");
}

async function testImportPersistsProfilePictureFromCsv() {
  const { supabase, getState } = createDiscoveryImportMock();
  const avatarUrl = "https://cdn.example.com/creator-one.jpg";

  const result = await upsertImportedCreators(
    [
      sampleRow({
        profile_picture_url: avatarUrl,
      }),
    ],
    {
      supabase,
      importFileId: "file-avatar",
      sourceName: "agency-export",
      uploadedBy: "user-1",
      log: () => {},
    }
  );

  const account = getState().accounts[0];
  assert.equal(account?.profile_picture_url, avatarUrl);
  assert.equal(account?.avatar_source, "manual");
  assert.ok(account?.avatar_last_synced_at);
}

async function testReimportPreservesAvatarWhenUploadEmpty() {
  const influencerId = "inf-avatar";
  const existingAvatar = "https://cdn.example.com/enriched.jpg";
  const { supabase, getState } = createDiscoveryImportMock({
    influencers: [
      {
        id: influencerId,
        display_name: "creator_avatar",
        country_code: "JO",
        categories: [],
        status: "active",
      },
    ],
    accounts: [
      {
        id: "acct-avatar",
        influencer_id: influencerId,
        platform: "instagram",
        handle: "creator_avatar",
        username: "creator_avatar",
        normalized_username: "creator_avatar",
        follower_count: 50_000,
        engagement_rate: 3.2,
        profile_picture_url: existingAvatar,
        avatar_source: "apify",
        avatar_last_synced_at: "2026-06-01T00:00:00.000Z",
        metadata: {},
      },
    ],
  });

  const result = await upsertImportedCreators(
    [
      sampleRow({
        username: "creator_avatar",
        followers: 10_000,
        profile_picture_url: null,
      }),
    ],
    {
      supabase,
      importFileId: "file-avatar-reimport",
      sourceName: "indaHash",
      uploadedBy: "user-1",
      log: () => {},
    }
  );

  const account = getState().accounts[0];
  assert.equal(account?.profile_picture_url, existingAvatar);
  assert.equal(account?.follower_count, 10_000, "authoritative merge updates followers when provided");
}

async function testReimportBackfillsMissingAvatarFromRow() {
  const influencerId = "inf-missing-avatar";
  const { supabase, getState } = createDiscoveryImportMock({
    influencers: [
      {
        id: influencerId,
        display_name: "creator_missing",
        country_code: "JO",
        categories: [],
        status: "active",
      },
    ],
    accounts: [
      {
        id: "acct-missing-avatar",
        influencer_id: influencerId,
        platform: "instagram",
        handle: "creator_missing",
        username: "creator_missing",
        normalized_username: "creator_missing",
        follower_count: 50_000,
        engagement_rate: 3.2,
        profile_picture_url: null,
        avatar_source: "manual",
        metadata: {},
      },
    ],
  });

  const avatarUrl = "https://cdn.example.com/backfill.jpg";
  await upsertImportedCreators(
    [
      sampleRow({
        username: "creator_missing",
        profile_picture_url: avatarUrl,
      }),
    ],
    {
      supabase,
      importFileId: "file-missing-avatar",
      sourceName: "indaHash",
      uploadedBy: "user-1",
      log: () => {},
    }
  );

  const account = getState().accounts[0];
  assert.equal(account?.profile_picture_url, avatarUrl);
  assert.equal(account?.avatar_source, "manual");
}

async function run() {
  testResolveInfluencerImportCategories();
  testMergeBackfillsEmptyExisting();
  testMergeUnionsWithDedupPreservingOrder();
  testMergePreservesExistingWhenImportEmpty();
  testMergeCreatorImportMetadata();
  testMergeCreatorImportMetadataPreservesRelevanceWhenImportNull();
  await testFirstImportCreatesRecords();
  await testReimportDoesNotCreateDuplicates();
  await testReimportAuthoritativeMerge();
  await testReimportBackfillsCategoriesFromAudienceInterestsOnly();
  await testReimportUpdatesExistingSourceProvenance();
  await testImportPersistsProfilePictureFromCsv();
  await testReimportPreservesAvatarWhenUploadEmpty();
  await testReimportBackfillsMissingAvatarFromRow();

  console.log("lib/discovery-import/upsert.test.ts — all tests passed");
}

run();
