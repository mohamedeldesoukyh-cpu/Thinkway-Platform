import assert from "node:assert/strict";
import test from "node:test";
import { collectAvatarCandidates, resolvePrimaryAvatar } from "./creator-centric";
import { hydrateCreatorsWithDna } from "./dna-browse-hydration";
import { createEmptyCreatorDNADocument } from "@/features/creator-dna/services/document-factory";
import { wrapValue } from "@/features/creator-dna/services/field-envelope";
import type { UnifiedCreatorResult } from "./types";

test("reset identity does not restore removed account photos from DNA or metadata", () => {
  const candidates = collectAvatarCandidates({ influencerMetadata: { identity_linked_accounts_only: true, avatar_source: "manual", avatar_url: "https://example.com/wrong.jpg" }, dnaAvatarUrl: "https://example.com/wrong-dna.jpg", discoveryProfileImageUrl: "https://example.com/wrong-discovery.jpg", accounts: [{ id: "remaining", platform: "tiktok", handle: "right", profile_picture_url: "https://example.com/right.jpg", follower_count: 20 }] });
  assert.equal(resolvePrimaryAvatar(candidates).url, "https://example.com/right.jpg");
  assert.ok(!candidates.some(candidate => candidate.url?.includes("wrong")));
});
test("reset rejects a copied Instagram import image attached to a different TikTok handle", () => {
  const candidates = collectAvatarCandidates({ influencerMetadata: { identity_linked_accounts_only: true }, accounts: [{ id: "remaining", platform: "tiktok", handle: "habibaasadia", profile_picture_url: "https://example.supabase.co/storage/v1/object/public/creator-avatars/imports/batch/instagram/aminaayoub__.jpg", follower_count: 200 }] });
  assert.equal(resolvePrimaryAvatar(candidates).url, null);
});

test("opening full details cannot overwrite restored identity with the removed account's DNA", async () => {
  const document = createEmptyCreatorDNADocument();
  document.identity.displayName = wrapValue("Wrong previous person", "ipl", 0.99);
  document.identity.avatarUrl = wrapValue("https://example.com/wrong.jpg", "ipl", 0.99);
  const creator = { influencer_id: "test", unified_id: "inf:test", display_name: "habibaasadia", primaryAvatarUrl: "https://example.com/right.jpg", identity_linked_accounts_only: true } as UnifiedCreatorResult;
  const db = { from() { const query = { select() { return query; }, in() { return Promise.resolve({ data: [{ influencer_id: "test", document }], error: null }); } }; return query; } };
  const [result] = await hydrateCreatorsWithDna(db as unknown as Parameters<typeof hydrateCreatorsWithDna>[0], [creator]);
  assert.equal(result.display_name, "habibaasadia");
  assert.equal(result.primaryAvatarUrl, "https://example.com/right.jpg");
});
