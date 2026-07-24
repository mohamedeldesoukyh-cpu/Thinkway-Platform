import assert from "node:assert/strict";
import test from "node:test";

import {
  aiChatBodySchema,
  createCreditNoteSchema,
  discoverySearchQuerySchema,
  inviteUserSchema,
  mfaVerifyEnrollmentSchema,
  operationsCampaignsQuerySchema,
  updateVendorIoSchema,
} from "./schemas";

test("aiChatBodySchema enforces message bounds and uuid optional fields", () => {
  assert.equal(aiChatBodySchema.safeParse({ message: "" }).success, false);
  assert.equal(
    aiChatBodySchema.safeParse({ message: "hi", conversationId: "not-uuid" }).success,
    false
  );
  assert.equal(
    aiChatBodySchema.safeParse({
      message: "Plan a campaign",
      conversationId: "11111111-1111-4111-8111-111111111111",
    }).success,
    true
  );
});

test("updateVendorIoSchema requires uuids and status enum", () => {
  assert.equal(
    updateVendorIoSchema.safeParse({
      id: "bad",
      campaign_header_id: "11111111-1111-4111-8111-111111111111",
    }).success,
    false
  );
  const ok = updateVendorIoSchema.safeParse({
    id: "11111111-1111-4111-8111-111111111111",
    campaign_header_id: "22222222-2222-4222-8222-222222222222",
    status: "draft",
    terms_html: "<p>ok</p><script>x</script>",
  });
  assert.equal(ok.success, true);
});

test("inviteUserSchema requires client_id for client portal", () => {
  const missing = inviteUserSchema.safeParse({
    email: "a@b.com",
    role_id: "11111111-1111-4111-8111-111111111111",
    portal_type: "client",
  });
  assert.equal(missing.success, false);

  const ok = inviteUserSchema.safeParse({
    email: "a@b.com",
    role_id: "11111111-1111-4111-8111-111111111111",
    portal_type: "client",
    client_id: "22222222-2222-4222-8222-222222222222",
  });
  assert.equal(ok.success, true);
});

test("mfaVerifyEnrollmentSchema requires 6-digit code", () => {
  assert.equal(
    mfaVerifyEnrollmentSchema.safeParse({ factor_id: "f1", code: "12345" }).success,
    false
  );
  assert.equal(
    mfaVerifyEnrollmentSchema.safeParse({ factor_id: "f1", code: "123456" }).success,
    true
  );
});

test("createCreditNoteSchema requires positive amount", () => {
  assert.equal(
    createCreditNoteSchema.safeParse({
      invoice_id: "11111111-1111-4111-8111-111111111111",
      issue_date: "2026-07-01",
      reason: "Adjustment",
      amount_before_vat: 0,
      vat_affected: false,
    }).success,
    false
  );
});

test("discoverySearchQuerySchema clamps pageSize and accepts empty filters", () => {
  const parsed = discoverySearchQuerySchema.safeParse({});
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.page, 1);
    assert.equal(parsed.data.pageSize, 24);
  }
  assert.equal(
    discoverySearchQuerySchema.safeParse({ pageSize: "999" }).success,
    false
  );
});

test("operationsCampaignsQuerySchema validates movementType and optional UUIDs", () => {
  assert.equal(
    operationsCampaignsQuerySchema.safeParse({
      movementType: "not-real",
    }).success,
    false
  );
  const ok = operationsCampaignsQuerySchema.safeParse({
    movementType: "brand_to_brand",
    groupId: "",
    page: "2",
  });
  assert.equal(ok.success, true);
  if (ok.success) {
    assert.equal(ok.data.page, 2);
    assert.equal(ok.data.groupId, undefined);
  }
});
