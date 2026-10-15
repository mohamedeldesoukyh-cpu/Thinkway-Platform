import assert from "node:assert/strict";
import { test } from "node:test";
import { applyQuotationWorkspacePhotos, quotationWorkspacePhotoAliases } from "./quotation-workspace-photos";
import { readQuotationTemplatePhotos } from "./quotation-template-photos";
import { clientReviewAvatarUrl } from "../../features/client-workspace/review-media";

const photo = "data:image/webp;base64,UklGRg==";
const base = { id: "line", unified_id: null, influencer_id: null, profile_id: null, creator_name: "Same name", handle: "same" };

test("quotation portraits match actual identities, options and roster without changing financial or approval state", () => {
  const items = [
    { ...base, id: "one", unified_id: "unified", influencer_id: "influencer", profile_id: "profile", source_shortlist_item_id: "shortlist" },
    { ...base, id: "two", unified_id: "unified" },
    { ...base, id: "manual", creator_name: "Manual", handle: null },
  ];
  const photos = readQuotationTemplatePhotos({ templateCreatorPhotos: { "u:unified": photo, "m:manual": photo, "u:outsider": photo } });
  const aliases = quotationWorkspacePhotoAliases(items, photos);
  const creators = [
    { creatorId: "unified" }, { creatorId: "inf:influencer" }, { creatorId: "dis:profile" },
    { creatorId: "sl:shortlist" }, { creatorId: "manual" },
    { creatorId: "other-id", quotationOptions: [{ itemId: "old", memberItemIds: ["two"] }] },
    { creatorId: "campaign-id", influencerId: "influencer" },
  ].map(c => ({ ...c, avatarUrl: "https://original.test/photo.jpg", selection: "approved", selectedQuotationItemIds: ["two"], commercial: { amount: 1500, agencyFee: 150, total: 1650, currency: "EGP" } }));
  const before = structuredClone(creators);
  const result = applyQuotationWorkspacePhotos(creators, aliases);
  assert.ok(result.every(c => c.avatarUrl === photo));
  assert.deepEqual(result.map(({ avatarUrl, ...rest }) => rest), creators.map(({ avatarUrl, ...rest }) => rest));
  assert.deepEqual(creators, before);
  assert.equal(result[0].commercial, creators[0].commercial);
  assert.equal(applyQuotationWorkspacePhotos(creators, {})[0].avatarUrl, "https://original.test/photo.jpg");
});

test("same-name creators and orphan metadata from another quotation cannot receive the photo", () => {
  const aliases = quotationWorkspacePhotoAliases([{ ...base, unified_id: "one" }], { "u:one": photo, "u:outsider": photo });
  const unrelated = [{ creatorId: "outsider", displayName: "Same name", handle: "same" }, { creatorId: "unknown" }];
  assert.equal(applyQuotationWorkspacePhotos(unrelated, aliases)[0], unrelated[0]);
  assert.equal(applyQuotationWorkspacePhotos(unrelated, aliases)[1], unrelated[1]);
  assert.equal(applyQuotationWorkspacePhotos(unrelated, {}), unrelated);
});

test("only bounded normalized raster overrides are rendered directly; social avatars keep authenticated proxy routing", () => {
  const profile = "https://www.instagram.com/example/";
  assert.equal(clientReviewAvatarUrl("token", photo, profile), photo);
  const remote = clientReviewAvatarUrl("token", "https://cdninstagram.com/photo.jpg", profile)!;
  assert.ok(remote.startsWith("/api/review/media?"));
  assert.equal(new URL(remote, "https://example.test").searchParams.get("sign"), "token");
  for (const value of ["data:image/svg+xml;base64,PHN2Zz4=", "data:image/webp;base64," + "A".repeat(180000), "javascript:alert(1)"]) {
    assert.deepEqual(readQuotationTemplatePhotos({ templateCreatorPhotos: { "u:one": value } }), {});
    assert.deepEqual(quotationWorkspacePhotoAliases([{ ...base, unified_id: "one" }], { "u:one": value }), {});
  }
});
