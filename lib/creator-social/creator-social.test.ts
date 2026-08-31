import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { classifyOAuthState } from "@/lib/creator-social/oauth/state";
import { hashOAuthState } from "@/lib/creator-social/oauth/pkce";
import { matchPublicationInsight } from "@/lib/creator-social/insights/match-publication";
import { createEmptyInsight, normalizeProviderInsight } from "@/lib/creator-social/insights/normalize";
import { creatorSocialSyncJobId } from "@/lib/creator-social/sync/queue";
import { listSocialProviders, getSocialProvider } from "@/lib/creator-social/providers/registry";
import { buildCreatorSocialProviderViews } from "@/lib/creator-social/views";
import { CREATOR_SOCIAL_OPTIONAL_INTRO } from "@/lib/creator-social/copy";
import { creatorFacingConnectionLabel } from "@/lib/creator-social/connections/status";
import type { CreatorSocialConnectionRow } from "@/lib/creator-social/connections/service";

describe("Provider registry", () => {
  it("lists multiple platforms without Instagram-only branching in views", () => {
    const ids = listSocialProviders().map((provider) => provider.id);
    assert.ok(ids.includes("instagram"));
    assert.ok(ids.includes("tiktok"));
    assert.ok(ids.includes("youtube"));
    assert.ok(ids.includes("facebook"));
    assert.ok(ids.includes("twitter"));
    assert.equal(ids.length >= 7, true);
    for (const provider of listSocialProviders()) {
      assert.equal(typeof provider.isConfigured, "function");
      assert.equal(typeof provider.buildAuthorizationUrl, "function");
    }
  });

  it("keeps unready adapters Available soon even if env might exist later", () => {
    assert.equal(getSocialProvider("tiktok").isConfigured(), false);
    assert.equal(getSocialProvider("youtube").isConfigured(), false);
  });
});

describe("OAuth state", () => {
  it("hashes state and classifies invalid, expired, replay, and provider mismatch", () => {
    const a = hashOAuthState("abc");
    const b = hashOAuthState("abc");
    const c = hashOAuthState("xyz");
    assert.equal(a, b);
    assert.notEqual(a, c);
    assert.equal(classifyOAuthState({ found: false, consumedAt: null, expiresAt: "", provider: "instagram" }), "invalid");
    assert.equal(
      classifyOAuthState({
        found: true,
        consumedAt: "2026-08-30T00:00:00.000Z",
        expiresAt: "2099-01-01T00:00:00.000Z",
        provider: "instagram",
      }),
      "replay"
    );
    assert.equal(
      classifyOAuthState({
        found: true,
        consumedAt: null,
        expiresAt: "2020-01-01T00:00:00.000Z",
        provider: "instagram",
        now: new Date("2026-08-30T00:00:00.000Z"),
      }),
      "expired"
    );
    assert.equal(
      classifyOAuthState({
        found: true,
        consumedAt: null,
        expiresAt: "2099-01-01T00:00:00.000Z",
        provider: "instagram",
        expectedProvider: "tiktok",
      }),
      "provider_mismatch"
    );
    assert.equal(
      classifyOAuthState({
        found: true,
        consumedAt: null,
        expiresAt: "2099-01-01T00:00:00.000Z",
        provider: "instagram",
        expectedProvider: "instagram",
      }),
      null
    );
  });
});

describe("Normalized insights", () => {
  it("leaves unsupported metrics null instead of fabricating zeros", () => {
    const empty = createEmptyInsight("instagram", "content");
    assert.equal(empty.views, null);
    assert.equal(empty.reach, null);
    assert.equal(empty.followers, null);
    const normalized = normalizeProviderInsight("instagram", "content", {
      externalContentId: "media-1",
      likes: 12,
    });
    assert.equal(normalized.likes, 12);
    assert.equal(normalized.views, null);
    assert.equal(normalized.impressions, null);
  });
});

describe("Publication matching", () => {
  const insight = {
    provider: "instagram" as const,
    canonicalUrl: "https://www.instagram.com/reel/ABC123/",
    externalContentId: "ABC123",
  };

  it("matches the owning creator by URL or media id", () => {
    const result = matchPublicationInsight({
      ownerInfluencerId: "inf-a",
      insight,
      publications: [
        {
          id: "pub-1",
          influencerId: "inf-a",
          platform: "instagram",
          contentUrl: "https://instagram.com/reel/ABC123",
          externalMediaId: "ABC123",
        },
      ],
    });
    assert.equal(result.matchStatus, "matched");
    assert.equal(result.publicationId, "pub-1");
  });

  it("does not attach Creator A content to Creator B", () => {
    const result = matchPublicationInsight({
      ownerInfluencerId: "inf-a",
      insight,
      publications: [
        {
          id: "pub-b",
          influencerId: "inf-b",
          platform: "instagram",
          contentUrl: "https://instagram.com/reel/ABC123",
          externalMediaId: "ABC123",
        },
      ],
    });
    assert.equal(result.matchStatus, "unmatched");
    assert.equal(result.publicationId, null);
  });

  it("keeps uncertain matches unmatched", () => {
    const result = matchPublicationInsight({
      ownerInfluencerId: "inf-a",
      insight: {
        provider: "instagram",
        canonicalUrl: "https://instagram.com/reel/ABC",
        externalContentId: null,
      },
      publications: [
        {
          id: "pub-1",
          influencerId: "inf-a",
          platform: "instagram",
          contentUrl: "https://instagram.com/reel/ABCDEF",
          externalMediaId: null,
        },
      ],
    });
    assert.equal(result.matchStatus, "uncertain");
    assert.equal(result.publicationId, null);
  });
});

describe("Sync jobs and copy", () => {
  it("uses a stable idempotent job id", () => {
    assert.equal(
      creatorSocialSyncJobId("conn-1"),
      creatorSocialSyncJobId("conn-1")
    );
    assert.equal(creatorSocialSyncJobId("conn-1"), "creator-social-sync-conn-1");
  });

  it("keeps connecting optional in creator-facing copy", () => {
    assert.match(CREATOR_SOCIAL_OPTIONAL_INTRO, /without connecting/i);
    assert.doesNotMatch(CREATOR_SOCIAL_OPTIONAL_INTRO, /required|mandatory|you must/i);
    assert.equal(creatorFacingConnectionLabel("needs_attention", null), "Connection needs attention");
    assert.equal(creatorFacingConnectionLabel("syncing", null), "Syncing");
  });

  it("does not invent a connection row when none exists", () => {
    const views = buildCreatorSocialProviderViews([]);
    assert.ok(views.every((row) => row.connection === null));
    const connected: CreatorSocialConnectionRow = {
      id: "c1",
      influencer_id: "inf-a",
      provider: "instagram",
      external_account_id: "ig-1",
      external_username: "amina",
      external_display_name: "Amina",
      status: "connected",
      scopes: [],
      capabilities: ["account_identity"],
      connected_at: "2026-08-30T00:00:00.000Z",
      last_synced_at: "2026-08-30T00:05:00.000Z",
      disconnected_at: null,
      last_error_code: null,
    };
    const withConnection = buildCreatorSocialProviderViews([connected]);
    const instagram = withConnection.find((row) => row.providerId === "instagram");
    assert.equal(instagram?.connection?.handle, "@amina");
    assert.equal(instagram?.connection?.statusLabel, "Connected");
  });
});
