import assert from "node:assert/strict";
import test from "node:test";
import { resolveCreatorPrimaryAvatar } from "./creator-centric";

const ig = { id: "ig", platform: "instagram", follower_count: 404300,
  profile_picture_url: "https://images.example/ig.jpg", avatar_source: "apify" };
const tt = { id: "tt", platform: "tiktok", follower_count: 922300,
  profile_picture_url: "https://images.example/tt.jpg", avatar_source: "apify" };

test("largest platform wins regardless of account order, stored primary or DNA", () => {
  for (const accounts of [[ig, tt], [tt, ig]]) {
    assert.equal(resolveCreatorPrimaryAvatar({ accounts,
      storedPrimaryAvatarUrl: "https://example.supabase.co/storage/v1/object/public/creator-avatars/enrichment/old.jpg",
      storedPrimaryAvatarSource: "uploaded", dnaAvatarUrl: ig.profile_picture_url,
    }).url, tt.profile_picture_url);
  }
});
test("Instagram takes over when its followers overtake TikTok", () => {
  assert.equal(resolveCreatorPrimaryAvatar({ accounts: [tt, { ...ig, follower_count: 1000000 }] }).url,
    ig.profile_picture_url);
});
test("ties use stable platform order and a missing photo falls back", () => {
  assert.equal(resolveCreatorPrimaryAvatar({ accounts: [tt, { ...ig, follower_count: tt.follower_count }] }).url,
    ig.profile_picture_url);
  assert.equal(resolveCreatorPrimaryAvatar({ accounts: [ig, { ...tt, profile_picture_url: null }] }).url,
    ig.profile_picture_url);
});
test("manual portrait is preserved and absent counts retain legacy fallback", () => {
  assert.equal(resolveCreatorPrimaryAvatar({ accounts: [ig, tt],
    storedPrimaryAvatarUrl: "https://images.example/manual.jpg", storedPrimaryAvatarSource: "manual",
  }).url, "https://images.example/manual.jpg");
  assert.equal(resolveCreatorPrimaryAvatar({ accounts: [
    { ...tt, follower_count: null }, { ...ig, follower_count: null },
  ] }).url, ig.profile_picture_url);
});
