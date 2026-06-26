import assert from "node:assert/strict";

import {
  buildPromoteReviewSummary,
  canAdvancePromoteStep,
  promoteMasterDataSchema,
  resolvePromoteCase,
} from "@/features/quotations/promote-master-data-schema";

const quotationId = "00000000-0000-4000-8000-000000000001";
const clientId = "00000000-0000-4000-8000-000000000002";
const brandId = "00000000-0000-4000-8000-000000000003";
const groupId = "00000000-0000-4000-8000-000000000004";

// create new client
assert.equal(
  canAdvancePromoteStep("client", { clientMode: "create", clientName: "Unilever" }).ok,
  true
);
assert.equal(
  canAdvancePromoteStep("client", { clientMode: "create", clientName: "  " }).ok,
  false
);

// link existing client
assert.equal(
  canAdvancePromoteStep("client", {
    clientMode: "link",
    existingClientId: clientId,
  }).ok,
  true
);
assert.equal(
  canAdvancePromoteStep("client", { clientMode: "link" }).ok,
  false
);

// create brand under existing client
assert.equal(
  canAdvancePromoteStep("brand", {
    clientMode: "link",
    existingClientId: clientId,
    brandMode: "create",
    brandName: "Dove",
  }).ok,
  true
);

// new client + new brand requires group
assert.equal(
  canAdvancePromoteStep("brand", {
    clientMode: "create",
    clientName: "Acme",
    brandMode: "create",
    brandName: "Acme Brand",
    groupId: null,
  }).ok,
  false
);
assert.equal(
  canAdvancePromoteStep("brand", {
    clientMode: "create",
    clientName: "Acme",
    brandMode: "create",
    brandName: "Acme Brand",
    groupId,
  }).ok,
  true
);

// onboarding acknowledgement
assert.equal(canAdvancePromoteStep("checklist", { acknowledged: false }).ok, false);
assert.equal(canAdvancePromoteStep("checklist", { acknowledged: true }).ok, true);

// promotion cases
assert.equal(
  resolvePromoteCase({
    clientMode: "create",
    brandMode: "create",
  }),
  "new_client_new_brand"
);
assert.equal(
  resolvePromoteCase({
    clientMode: "create",
    brandMode: "skip",
  }),
  "new_client_no_brand"
);
assert.equal(
  resolvePromoteCase({
    clientMode: "link",
    brandMode: "link",
  }),
  "existing_client_existing_brand"
);

// schema requires acknowledgement on promote payload
const parsed = promoteMasterDataSchema.safeParse({
  quotationId,
  clientMode: "create",
  clientName: "L'Oreal Middle East",
  brandMode: "skip",
  acknowledged: true,
  agencyOrDirect: "agency",
});
assert.equal(parsed.success, true);

const missingAck = promoteMasterDataSchema.safeParse({
  quotationId,
  clientMode: "create",
  clientName: "Test",
  brandMode: "skip",
  acknowledged: false,
  agencyOrDirect: "agency",
});
assert.equal(missingAck.success, false);

const summary = buildPromoteReviewSummary({
  clientMode: "create",
  clientName: "Unilever",
  brandMode: "create",
  brandName: "Dove",
  groupId,
  clientOwnerId: null,
  countryManagerId: null,
  commercialOwnerId: null,
});
assert.match(summary.caseLabel, /New legal entity/);
assert.equal(summary.statusLabel, "Draft (prospect)");

console.log("promote-master-data.test.ts: all assertions passed");
