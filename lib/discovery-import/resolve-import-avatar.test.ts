import assert from "node:assert/strict";

import type { EnrichmentResult } from "@/lib/social/enrichment/types";

import {
  resolveImportAvatarFields,
  shouldFillImportAvatar,
} from "./resolve-import-avatar";
import type { ParsedCreatorRow } from "./types";

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
    ...overrides,
  };
}

function testShouldFillImportAvatar() {
  assert.equal(shouldFillImportAvatar(null), true);
  assert.equal(shouldFillImportAvatar(""), true);
  assert.equal(shouldFillImportAvatar("https://cdn.example.com/photo.jpg"), false);
}

async function testPrefersParsedRowUrl() {
  const rowUrl = "https://cdn.example.com/from-row.jpg";
  let enrichCalled = false;

  const fields = await resolveImportAvatarFields({
    row: sampleRow({ profile_picture_url: rowUrl }),
    platform: "instagram",
    profileUrl: "https://www.instagram.com/creator_one/",
    enableOpenGraphFallback: true,
    enrichProfile: async () => {
      enrichCalled = true;
      return {} as EnrichmentResult;
    },
  });

  assert.ok(fields);
  assert.equal(fields?.profile_picture_url, rowUrl);
  assert.equal(fields?.avatar_source, "manual");
  assert.equal(enrichCalled, false);
}

async function testOpenGraphFallbackWhenRowMissing() {
  const ogUrl = "https://cdninstagram.example/og-avatar.jpg";
  const logs: string[] = [];

  const fields = await resolveImportAvatarFields({
    row: sampleRow(),
    platform: "instagram",
    profileUrl: "https://www.instagram.com/creator_one/",
    enableOpenGraphFallback: true,
    log: (_level, message) => {
      logs.push(message);
    },
    enrichProfile: async () =>
      ({
        profile_picture_url: ogUrl,
      }) as EnrichmentResult,
  });

  assert.ok(fields);
  assert.equal(fields?.profile_picture_url, ogUrl);
  assert.equal(fields?.avatar_source, "discovery");
  assert.ok(logs.some((message) => message.includes("avatar filled from open-graph")));
}

async function testSkipsOpenGraphWhenDisabled() {
  let enrichCalled = false;

  const fields = await resolveImportAvatarFields({
    row: sampleRow(),
    platform: "instagram",
    profileUrl: "https://www.instagram.com/creator_one/",
    enableOpenGraphFallback: false,
    enrichProfile: async () => {
      enrichCalled = true;
      return {} as EnrichmentResult;
    },
  });

  assert.equal(fields, null);
  assert.equal(enrichCalled, false);
}

async function run() {
  testShouldFillImportAvatar();
  await testPrefersParsedRowUrl();
  await testOpenGraphFallbackWhenRowMissing();
  await testSkipsOpenGraphWhenDisabled();
  console.log("lib/discovery-import/resolve-import-avatar.test.ts — all tests passed");
}

run();
