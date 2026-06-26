import assert from "node:assert/strict";

import {
  buildPromoteReviewSummary,
  canAdvancePromoteStep,
  promoteMasterDataSchema,
  resolvePromoteCase,
} from "@/features/quotations/promote-master-data-schema";
import { DEFAULT_PROMOTED_ONBOARDING_STATUS } from "@/lib/clients/onboarding-status";

const quotationId = "00000000-0000-4000-8000-000000000001";
const clientId = "00000000-0000-4000-8000-000000000002";
const brandId = "00000000-0000-4000-8000-000000000003";
const groupId = "00000000-0000-4000-8000-000000000004";

// 1. New client without group
assert.equal(
  canAdvancePromoteStep("client", { clientMode: "create", clientName: "Unilever" }).ok,
  true
);
assert.equal(
  canAdvancePromoteStep("client", { clientMode: "create", clientName: "  " }).ok,
  false
);

// 2. Existing client without group
assert.equal(
  canAdvancePromoteStep("client", {
    clientMode: "link",
    existingClientId: clientId,
  }).ok,
  true
);

// 3. New brand without group (new client + new brand, no group)
assert.equal(
  canAdvancePromoteStep("brand", {
    clientMode: "create",
    clientName: "Acme",
    brandMode: "create",
    brandName: "Acme Brand",
    groupId: null,
  }).ok,
  true
);

// create brand under existing client without group on draft
assert.equal(
  canAdvancePromoteStep("brand", {
    clientMode: "link",
    existingClientId: clientId,
    brandMode: "create",
    brandName: "Dove",
    groupId: null,
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

const newClientNewBrandNoGroup = promoteMasterDataSchema.safeParse({
  quotationId,
  clientMode: "create",
  clientName: "Standalone Co",
  brandMode: "create",
  brandName: "Standalone Brand",
  groupId: null,
  acknowledged: true,
  agencyOrDirect: "agency",
});
assert.equal(newClientNewBrandNoGroup.success, true);

const missingAck = promoteMasterDataSchema.safeParse({
  quotationId,
  clientMode: "create",
  clientName: "Test",
  brandMode: "skip",
  acknowledged: false,
  agencyOrDirect: "agency",
});
assert.equal(missingAck.success, false);

// wizard submit payload uses null for empty optional strings (not omitted keys)
const wizardNullOptionals = promoteMasterDataSchema.safeParse({
  quotationId,
  clientMode: "create",
  clientName: "Test Client",
  legalName: null,
  agencyOrDirect: "agency",
  industry: null,
  country: null,
  website: null,
  existingClientId: null,
  brandMode: "create",
  brandName: "Test Brand",
  categoryId: null,
  subcategoryId: null,
  existingBrandId: null,
  groupId: null,
  clientOwnerId: null,
  countryManagerId: null,
  commercialOwnerId: null,
  acknowledged: true,
  clientDuplicateOverride: false,
  brandDuplicateOverride: false,
});
assert.equal(wizardNullOptionals.success, true);
if (wizardNullOptionals.success) {
  assert.equal(wizardNullOptionals.data.legalName, null);
  assert.equal(wizardNullOptionals.data.groupId, null);
}

// empty strings from cleared inputs normalize to null (same as wizard || null)
const wizardEmptyStringOptionals = promoteMasterDataSchema.safeParse({
  quotationId,
  clientMode: "create",
  clientName: "Test Client",
  legalName: "",
  agencyOrDirect: "agency",
  industry: "",
  country: "",
  website: "",
  existingClientId: "",
  brandMode: "create",
  brandName: "Test Brand",
  categoryId: "",
  subcategoryId: "",
  existingBrandId: "",
  groupId: "",
  clientOwnerId: "",
  countryManagerId: "",
  commercialOwnerId: "",
  acknowledged: true,
});
assert.equal(wizardEmptyStringOptionals.success, true);
if (wizardEmptyStringOptionals.success) {
  assert.equal(wizardEmptyStringOptionals.data.website, null);
  assert.equal(wizardEmptyStringOptionals.data.categoryId, null);
}

// link existing client + brand with null ownership fields
const linkExistingWithNulls = promoteMasterDataSchema.safeParse({
  quotationId,
  clientMode: "link",
  existingClientId: clientId,
  brandMode: "link",
  existingBrandId: brandId,
  clientName: null,
  legalName: null,
  industry: null,
  country: null,
  website: null,
  brandName: null,
  categoryId: null,
  subcategoryId: null,
  groupId: null,
  clientOwnerId: null,
  countryManagerId: null,
  commercialOwnerId: null,
  acknowledged: true,
  agencyOrDirect: "agency",
});
assert.equal(linkExistingWithNulls.success, true);

// duplicate override flags accepted
const withOverrides = promoteMasterDataSchema.safeParse({
  quotationId,
  clientMode: "create",
  clientName: "Duplicate Inc",
  brandMode: "create",
  brandName: "Duplicate Brand",
  acknowledged: true,
  agencyOrDirect: "agency",
  clientDuplicateOverride: true,
  brandDuplicateOverride: true,
});
assert.equal(withOverrides.success, true);

// 7. onboarding default status in review summary
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
assert.equal(summary.onboardingStatusLabel, "Legal pending");
assert.equal(DEFAULT_PROMOTED_ONBOARDING_STATUS, "legal_pending");

console.log("promote-master-data.test.ts: all assertions passed");
