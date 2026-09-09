/**
 * Replace/Upload Brief profile continuity.
 *
 * The Intake dropzone sent only `file` + `conversationId` and the upload action
 * finalized with a hard-coded `mode: "create"`, so every brief replacement
 * inserted a SECOND profile row for the same conversation. Because
 * `getCampaignIntelligenceProfileForConversation` orders by `updated_at DESC`,
 * that new row became canonical and every operator-entered value on the
 * previous row was orphaned.
 *
 * These tests pin the two decisions that fix rests on.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  linkRequiresBrandSelection,
  resolveBriefUploadProfileTarget,
} from "./brief-upload-profile-target";

// 1 + 4 — reuse when a conversation profile exists, create when it does not.

test("an existing conversation profile is reused, never duplicated", () => {
  const target = resolveBriefUploadProfileTarget({
    conversationId: "conv-1",
    existingProfileId: "profile-7a9b1208",
  });

  assert.equal(target.mode, "link", "must update the existing row, not insert another");
  assert.equal(target.linkProfileId, "profile-7a9b1208");
});

test("no existing profile keeps the established create behaviour", () => {
  const target = resolveBriefUploadProfileTarget({
    conversationId: "conv-1",
    existingProfileId: null,
  });

  assert.equal(target.mode, "create");
  assert.equal(target.linkProfileId, null);
  assert.equal(target.allowMissingBrand, false, "create must not gain a brand exemption");
});

test("a library upload with no conversation still creates", () => {
  const target = resolveBriefUploadProfileTarget({ existingProfileId: "profile-x" });

  assert.equal(target.mode, "create");
  assert.equal(target.allowMissingBrand, false);
});

// 5 — the brand exemption is scoped to same-conversation reuse only.

test("same-conversation reuse is not blocked by a missing CRM brand", () => {
  const target = resolveBriefUploadProfileTarget({
    conversationId: "conv-1",
    existingProfileId: "profile-7a9b1208",
  });

  assert.equal(target.allowMissingBrand, true);
  assert.equal(
    linkRequiresBrandSelection({ brandId: null, allowMissingBrand: target.allowMissingBrand }),
    false,
    "replacing the brief of a campaign with no catalog brand must succeed"
  );
});

test("linking an unrelated record still requires a brand", () => {
  assert.equal(linkRequiresBrandSelection({ brandId: null }), true);
  assert.equal(linkRequiresBrandSelection({ brandId: "   " }), true);
  assert.equal(
    linkRequiresBrandSelection({ brandId: null, allowMissingBrand: false }),
    true,
    "the general brand-link requirement must not be weakened"
  );
});

test("a brand, when present, always satisfies the gate", () => {
  assert.equal(linkRequiresBrandSelection({ brandId: "brand-1" }), false);
  assert.equal(
    linkRequiresBrandSelection({ brandId: "brand-1", allowMissingBrand: false }),
    false
  );
});
