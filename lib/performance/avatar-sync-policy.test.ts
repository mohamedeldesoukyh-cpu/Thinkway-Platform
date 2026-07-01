import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  AVATAR_SYNC_STALE_MS,
  isAvatarSyncStale,
  isBrokenAvatarUrl,
  isInstagramCdnUrlExpired,
  isPlaceholderAvatarUrl,
  isSameProviderAvatarUrl,
  resolvePersistedAvatarSource,
  shouldPersistPlatformAvatar,
  shouldPreserveUploadedAvatarSource,
  shouldSyncPlatformAvatar,
} from "@/lib/performance/avatar-sync-policy";
import {
  isExpiredSignedAvatarUrl,
  rejectProviderAvatarUrlSync,
  validateProviderAvatarUrl,
} from "@/lib/performance/provider-avatar-validation";
import {
  parseCreatorAvatarStoragePathFromUrl,
  resolveCreatorAvatarPublicUrl,
} from "@/lib/discovery-import/import-avatar-storage";
import { persistInfluencerPlatformAvatarDetailed } from "@/lib/performance/metrics-collector/persist";

assert.equal(isPlaceholderAvatarUrl("https://ui-avatars.com/api/?name=AB"), true);
assert.equal(
  isPlaceholderAvatarUrl("https://cdn.example.com/default-avatar.png"),
  true
);
assert.equal(
  isPlaceholderAvatarUrl("https://p16-sign-va.tiktokcdn.com/avatar.jpg"),
  false
);

assert.equal(isBrokenAvatarUrl(""), true);
assert.equal(isBrokenAvatarUrl("not-a-url"), true);
assert.equal(isBrokenAvatarUrl("https://p16-sign-va.tiktokcdn.com/avatar.jpg"), false);

const expiredIg =
  "https://scontent-ord5-1.cdninstagram.com/v/t51.2885-19/abc.jpg?oe=6A415820";
assert.equal(isBrokenAvatarUrl(expiredIg), true, "expired Instagram oe= URL is broken");
assert.equal(
  isInstagramCdnUrlExpired(expiredIg, Date.parse("2026-06-29T00:00:00.000Z")),
  true
);
assert.equal(
  isInstagramCdnUrlExpired(expiredIg, Date.parse("2026-06-28T00:00:00.000Z")),
  false
);

const now = Date.parse("2026-06-24T12:00:00.000Z");
const fresh = new Date(now - AVATAR_SYNC_STALE_MS + 60_000).toISOString();
const stale = new Date(now - AVATAR_SYNC_STALE_MS - 60_000).toISOString();

assert.equal(isAvatarSyncStale(fresh, now), false);
assert.equal(isAvatarSyncStale(stale, now), true);
assert.equal(isAvatarSyncStale(null, now), true);

assert.equal(
  shouldSyncPlatformAvatar(
    {
      profile_picture_url: "https://cdn.example.com/photo.jpg",
      avatar_source: "manual",
      avatar_last_synced_at: stale,
    },
    now
  ),
  false,
  "manual never auto-syncs"
);

assert.equal(
  shouldSyncPlatformAvatar(
    {
      profile_picture_url: null,
      avatar_source: "manual",
      avatar_last_synced_at: null,
    },
    now
  ),
  true,
  "manual with empty url may receive first automated fill"
);

assert.equal(
  shouldSyncPlatformAvatar(
    {
      profile_picture_url: null,
      avatar_source: "apify",
      avatar_last_synced_at: null,
    },
    now
  ),
  true
);

assert.equal(
  shouldSyncPlatformAvatar(
    {
      profile_picture_url: "https://cdn.example.com/photo.jpg",
      avatar_source: "apify",
      avatar_last_synced_at: stale,
    },
    now
  ),
  true,
  "stale apify may refresh"
);

assert.equal(
  shouldSyncPlatformAvatar(
    {
      profile_picture_url: "https://cdn.example.com/photo.jpg",
      avatar_source: "apify",
      avatar_last_synced_at: fresh,
    },
    now
  ),
  false,
  "fresh apify kept"
);

assert.equal(
  shouldSyncPlatformAvatar(
    {
      profile_picture_url: "https://ui-avatars.com/api/?name=X",
      avatar_source: "discovery",
      avatar_last_synced_at: fresh,
    },
    now
  ),
  true,
  "placeholder triggers refresh even when fresh"
);

assert.equal(
  shouldSyncPlatformAvatar(
    {
      profile_picture_url: "https://ui-avatars.com/api/?name=X",
      avatar_source: "manual",
      avatar_last_synced_at: stale,
    },
    now
  ),
  true,
  "manual placeholder may refresh"
);

assert.equal(
  shouldSyncPlatformAvatar(
    {
      profile_picture_url: "https://cdn.example.com/photo.jpg",
      avatar_source: "manual",
      avatar_last_synced_at: stale,
    },
    now,
    { allowManualCrossPlatformRefresh: true }
  ),
  true,
  "manual with cross-platform blocked URL may refresh"
);

assert.equal(
  shouldSyncPlatformAvatar(
    {
      profile_picture_url: "https://static.cdninstagram.com/rsrc.php/v4/yD/r/R0fBIMurK8v.png",
      avatar_source: "manual",
      avatar_last_synced_at: fresh,
    },
    now
  ),
  true,
  "Instagram static default placeholder may refresh"
);

assert.equal(
  isPlaceholderAvatarUrl("https://static.cdninstagram.com/rsrc.php/v4/yD/r/R0fBIMurK8v.png"),
  true
);

assert.equal(
  shouldSyncPlatformAvatar(
    {
      profile_picture_url: "https://cdn.example.com/photo.jpg",
      avatar_source: "apify",
      avatar_last_synced_at: fresh,
    },
    now
  ),
  false,
  "fresh apify blocked without force"
);

const oldApifyUrl =
  "https://scontent.cdninstagram.com/v/t51.2885-19/old.jpg?oe=AA000001";
const newApifyUrl =
  "https://scontent.cdninstagram.com/v/t51.2885-19/new.jpg?oe=BB000002";
assert.equal(isSameProviderAvatarUrl(oldApifyUrl, newApifyUrl), false);
assert.equal(
  isSameProviderAvatarUrl(
    "https://scontent.cdninstagram.com/v/t51.2885-19/same.jpg?oe=AA",
    "https://scontent.cdninstagram.com/v/t51.2885-19/same.jpg?oe=BB"
  ),
  true,
  "same CDN path with different signing params is the same asset"
);

assert.equal(
  shouldSyncPlatformAvatar(
    {
      profile_picture_url: oldApifyUrl,
      avatar_source: "apify",
      avatar_last_synced_at: fresh,
    },
    now,
    { incomingProfilePictureUrl: newApifyUrl }
  ),
  true,
  "metrics refresh syncs when Apify returns a different profile photo"
);

const staleIgCdn =
  "https://scontent-ord5-1.cdninstagram.com/v/t51.2885-19/stale.jpg?oe=6A415820";
assert.equal(
  shouldSyncPlatformAvatar(
    {
      profile_picture_url: staleIgCdn,
      avatar_source: "apify",
      avatar_last_synced_at: fresh,
    },
    now,
    { incomingProfilePictureUrl: newApifyUrl }
  ),
  true,
  "stale IG CDN allows refresh when provider returns new URL"
);

assert.equal(
  shouldSyncPlatformAvatar(
    {
      profile_picture_url: "https://cdn.example.com/imported-from-pdf.jpg",
      avatar_source: "uploaded",
      avatar_last_synced_at: fresh,
    },
    now,
    {
      incomingProfilePictureUrl: newApifyUrl,
      allowUploadedProviderReplace: true,
    }
  ),
  true,
  "manual metrics refresh replaces uploaded import when Apify URL differs"
);

assert.equal(
  shouldPersistPlatformAvatar(
    {
      profile_picture_url: "https://cdn.example.com/photo.jpg",
      avatar_source: "apify",
      avatar_last_synced_at: fresh,
    },
    now,
    { forceSync: true }
  ),
  true,
  "Discovery Refresh Metrics forceSync overwrites fresh apify avatar"
);

assert.equal(
  shouldPersistPlatformAvatar(
    {
      profile_picture_url: "https://cdn.example.com/photo.jpg",
      avatar_source: "manual",
      avatar_last_synced_at: fresh,
    },
    now,
    { forceSync: true }
  ),
  false,
  "forceSync still protects valid manual avatar"
);

assert.equal(
  shouldPersistPlatformAvatar(
    {
      profile_picture_url: "https://cdn.example.com/uploaded.jpg",
      avatar_source: "uploaded",
      avatar_last_synced_at: fresh,
    },
    now,
    { forceSync: true }
  ),
  false,
  "forceSync protects valid uploaded avatar without forceAvatarReplace"
);

assert.equal(
  shouldPersistPlatformAvatar(
    {
      profile_picture_url: "https://cdn.example.com/uploaded.jpg",
      avatar_source: "uploaded",
      avatar_last_synced_at: fresh,
    },
    now,
    { forceSync: true, forceAvatarReplace: true }
  ),
  true,
  "forceAvatarReplace overwrites valid uploaded avatar URL"
);

assert.equal(
  shouldSyncPlatformAvatar(
    {
      profile_picture_url: "https://cdn.example.com/uploaded.jpg",
      avatar_source: "uploaded",
      avatar_last_synced_at: stale,
    },
    now
  ),
  false,
  "stale uploaded avatar is not auto-synced without forceAvatarReplace"
);

assert.equal(
  shouldPreserveUploadedAvatarSource({
    profile_picture_url: "https://cdn.example.com/uploaded.jpg",
    avatar_source: "uploaded",
    avatar_last_synced_at: fresh,
  }),
  true
);

assert.equal(
  shouldPreserveUploadedAvatarSource({
    profile_picture_url: null,
    avatar_source: "uploaded",
    avatar_last_synced_at: null,
  }),
  false
);

assert.equal(
  resolvePersistedAvatarSource(
    {
      profile_picture_url: "https://cdn.example.com/uploaded.jpg",
      avatar_source: "uploaded",
      avatar_last_synced_at: fresh,
    },
    "apify"
  ),
  "uploaded",
  "uploaded avatar_source is never changed when URL is present"
);

assert.equal(
  resolvePersistedAvatarSource(
    {
      profile_picture_url: "https://cdn.example.com/uploaded.jpg",
      avatar_source: "uploaded",
      avatar_last_synced_at: fresh,
    },
    "apify",
    { allowUploadedProviderReplace: true }
  ),
  "apify",
  "manual refresh with provider URL change switches avatar_source to apify"
);

assert.equal(
  resolvePersistedAvatarSource(
    {
      profile_picture_url: null,
      avatar_source: "uploaded",
      avatar_last_synced_at: null,
    },
    "apify"
  ),
  "apify",
  "empty uploaded URL may receive apify source on first fill"
);

assert.deepEqual(rejectProviderAvatarUrlSync(null), { ok: false, reason: "empty" });
assert.deepEqual(rejectProviderAvatarUrlSync(""), { ok: false, reason: "empty" });
assert.deepEqual(rejectProviderAvatarUrlSync("data:image/png;base64,abc"), {
  ok: false,
  reason: "data_uri",
});
assert.deepEqual(rejectProviderAvatarUrlSync("https://ui-avatars.com/api/?name=X"), {
  ok: false,
  reason: "placeholder",
});

assert.equal(
  isExpiredSignedAvatarUrl(
    "https://p16-sign-va.tiktokcdn.com/avatar.webp?x-expires=1661893200&x-signature=abc",
    Date.parse("2026-06-24T12:00:00.000Z")
  ),
  true
);

assert.equal(
  parseCreatorAvatarStoragePathFromUrl(
    resolveCreatorAvatarPublicUrl(
      "https://example.supabase.co",
      "imports/file-1/instagram/jumana.mourad.png"
    )
  ),
  "imports/file-1/instagram/jumana.mourad.png"
);

/*
 * SQL validation (prod check — do not run in CI):
 *
 * SELECT ipa.handle, ipa.profile_picture_url, ipa.avatar_source
 * FROM influencer_platform_accounts ipa
 * JOIN influencers i ON i.id = ipa.influencer_id
 * WHERE ipa.handle ILIKE 'jumana.mourad'
 *   AND ipa.platform = 'instagram';
 *
 * After enrichment with failed Apify, expect avatar_source = 'uploaded'
 * and profile_picture_url unchanged (creator-avatars imports/... path).
 */

type PlatformAccountRow = {
  id: string;
  influencer_id: string;
  platform: string;
  profile_picture_url: string | null;
  avatar_source: string | null;
  avatar_last_synced_at: string | null;
};

function createUploadedAvatarPersistMock(initial: PlatformAccountRow) {
  const accounts = [{ ...initial }];
  let storageExists = true;

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
        async maybeSingle() {
          if (table === "influencer_platform_accounts") {
            const match = accounts.find((row) => row.influencer_id === filters.influencer_id);
            return { data: match ?? null, error: null };
          }
          return { data: null, error: null };
        },
        then(
          resolve: (value: { data: PlatformAccountRow[]; error: null }) => void,
          reject?: (reason: unknown) => void
        ) {
          try {
            if (table === "influencer_platform_accounts") {
              const rows = accounts.filter((row) => row.influencer_id === filters.influencer_id);
              resolve({ data: rows, error: null });
              return;
            }
            resolve({ data: [], error: null });
          } catch (error) {
            reject?.(error);
          }
        },
        update(patch: Record<string, unknown>) {
          return {
            eq(_column: string, id: unknown) {
              const index = accounts.findIndex((row) => row.id === id);
              if (index >= 0) {
                accounts[index] = { ...accounts[index], ...patch } as PlatformAccountRow;
              }
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
      };
      return builder;
    },
    storage: {
      from(_bucket: string) {
        return {
          async download(_path: string) {
            return storageExists
              ? { data: new Blob(["x".repeat(4096)]), error: null }
              : { data: null, error: { message: "not found" } };
          },
        };
      },
    },
  };

  return {
    supabase: supabase as unknown as SupabaseClient,
    accounts,
    setStorageExists(value: boolean) {
      storageExists = value;
    },
  };
}

async function testUploadedAvatarSurvivesRefreshMetricsWithApifyFailure() {
  const uploadedUrl = resolveCreatorAvatarPublicUrl(
    "https://example.supabase.co",
    "imports/file-1/instagram/jumana.mourad.png"
  );
  const mock = createUploadedAvatarPersistMock({
    id: "acct-1",
    influencer_id: "inf-1",
    platform: "instagram",
    profile_picture_url: uploadedUrl,
    avatar_source: "uploaded",
    avatar_last_synced_at: "2026-01-01T00:00:00.000Z",
  });

  // Apify failure path: no provider URL — persist is not invoked; account unchanged.
  assert.equal(mock.accounts[0]!.profile_picture_url, uploadedUrl);
  assert.equal(mock.accounts[0]!.avatar_source, "uploaded");

  // Refresh Metrics with forceSync but Apify returns a provider photo — must not overwrite.
  const blocked = await persistInfluencerPlatformAvatarDetailed(mock.supabase, {
    influencerId: "inf-1",
    platform: "instagram",
    profilePictureUrl: "https://scontent.cdninstagram.com/v/new-apify-photo.jpg",
    source: "apify",
    forceSync: true,
    logSkips: false,
    skipProviderAvatarNetworkValidation: true,
  });

  assert.equal(blocked.saved, false);
  assert.equal(blocked.reason, "policy_blocked");
  assert.equal(mock.accounts[0]!.profile_picture_url, uploadedUrl);
  assert.equal(mock.accounts[0]!.avatar_source, "uploaded");
}

async function testUploadedAvatarBlockedWhenStorageObjectExists() {
  const uploadedUrl = resolveCreatorAvatarPublicUrl(
    "https://example.supabase.co",
    "imports/file-1/instagram/creator_one.png"
  );
  const mock = createUploadedAvatarPersistMock({
    id: "acct-2",
    influencer_id: "inf-2",
    platform: "instagram",
    profile_picture_url: uploadedUrl,
    avatar_source: "uploaded",
    avatar_last_synced_at: "2026-01-01T00:00:00.000Z",
  });

  const result = await persistInfluencerPlatformAvatarDetailed(mock.supabase, {
    influencerId: "inf-2",
    platform: "instagram",
    profilePictureUrl: "https://scontent.cdninstagram.com/v/provider.jpg",
    source: "apify",
    forceSync: true,
    forceAvatarReplace: true,
    logSkips: false,
    skipProviderAvatarNetworkValidation: true,
  });

  assert.equal(result.saved, false);
  assert.equal(result.detail, "uploaded_avatar_in_storage");
  assert.equal(mock.accounts[0]!.profile_picture_url, uploadedUrl);
  assert.equal(mock.accounts[0]!.avatar_source, "uploaded");
}

async function testProviderAvatarValidationAsync() {
  const valid = await validateProviderAvatarUrl(
    "https://cdn.example.com/avatar.jpg",
    {
      skipNetwork: true,
    }
  );
  assert.deepEqual(valid, { ok: true });

  const rejected = await validateProviderAvatarUrl("data:image/png;base64,abc", {
    skipNetwork: true,
  });
  assert.deepEqual(rejected, { ok: false, reason: "data_uri" });

  const tooSmall = await validateProviderAvatarUrl("https://cdn.example.com/avatar.jpg", {
    fetchFn: async () =>
      new Response(null, {
        status: 200,
        headers: { "content-length": "512" },
      }),
  });
  assert.deepEqual(tooSmall, { ok: false, reason: "image_too_small" });
}

async function testMetricsRefreshPersistsWhenApifyUrlChanged() {
  const oldUrl =
    "https://scontent.cdninstagram.com/v/t51.2885-19/old.jpg?oe=AA000001";
  const newUrl =
    "https://scontent.cdninstagram.com/v/t51.2885-19/new.jpg?oe=BB000002";
  const mock = createUploadedAvatarPersistMock({
    id: "acct-apify",
    influencer_id: "inf-apify",
    platform: "instagram",
    profile_picture_url: oldUrl,
    avatar_source: "apify",
    avatar_last_synced_at: new Date().toISOString(),
  });

  const result = await persistInfluencerPlatformAvatarDetailed(mock.supabase, {
    influencerId: "inf-apify",
    platform: "instagram",
    profilePictureUrl: newUrl,
    source: "apify",
    allowUploadedProviderReplace: true,
    logSkips: false,
    skipProviderAvatarNetworkValidation: true,
  });

  assert.equal(result.saved, true);
  assert.equal(mock.accounts[0]!.profile_picture_url, newUrl);
  assert.equal(mock.accounts[0]!.avatar_source, "apify");
}

async function testManualMetricsRefreshReplacesUploadedImportInStorage() {
  const uploadedUrl = resolveCreatorAvatarPublicUrl(
    "https://example.supabase.co",
    "imports/file-1/instagram/zeinaelfakahany.png"
  );
  const mock = createUploadedAvatarPersistMock({
    id: "acct-3",
    influencer_id: "inf-3",
    platform: "instagram",
    profile_picture_url: uploadedUrl,
    avatar_source: "uploaded",
    avatar_last_synced_at: "2026-01-01T00:00:00.000Z",
  });

  const apifyUrl =
    "https://scontent.cdninstagram.com/v/t51.2885-19/apify.jpg?oe=BB000002";
  const result = await persistInfluencerPlatformAvatarDetailed(mock.supabase, {
    influencerId: "inf-3",
    platform: "instagram",
    profilePictureUrl: apifyUrl,
    source: "apify",
    allowUploadedProviderReplace: true,
    logSkips: false,
    skipProviderAvatarNetworkValidation: true,
  });

  assert.equal(result.saved, true);
  assert.equal(mock.accounts[0]!.profile_picture_url, apifyUrl);
  assert.equal(mock.accounts[0]!.avatar_source, "apify");
}

async function testTikTokApifyAvatarPersistsStabilizedUrl() {
  const signed =
    "https://p16-sign-va.tiktokcdn.com/a.jpg?x-expires=9999999999&x-signature=abc";
  const mock = createUploadedAvatarPersistMock({
    id: "acct-tt",
    influencer_id: "inf-tt",
    platform: "tiktok",
    profile_picture_url: null,
    avatar_source: "manual",
    avatar_last_synced_at: null,
  });

  const result = await persistInfluencerPlatformAvatarDetailed(mock.supabase, {
    influencerId: "inf-tt",
    platform: "tiktok",
    profilePictureUrl: signed,
    source: "apify",
    logSkips: false,
    skipProviderAvatarNetworkValidation: true,
  });

  assert.equal(result.saved, true);
  assert.equal(mock.accounts[0]!.profile_picture_url, "https://p16-va.tiktokcdn.com/a.jpg");
  assert.equal(mock.accounts[0]!.avatar_source, "apify");
}

async function runAsyncTests() {
  await testUploadedAvatarSurvivesRefreshMetricsWithApifyFailure();
  await testUploadedAvatarBlockedWhenStorageObjectExists();
  await testMetricsRefreshPersistsWhenApifyUrlChanged();
  await testManualMetricsRefreshReplacesUploadedImportInStorage();
  await testTikTokApifyAvatarPersistsStabilizedUrl();
  await testProviderAvatarValidationAsync();
}

runAsyncTests()
  .then(() => {
    console.log("avatar-sync-policy tests passed");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
