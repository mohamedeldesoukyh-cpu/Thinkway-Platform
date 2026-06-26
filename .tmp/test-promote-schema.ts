import { promoteMasterDataSchema } from "@/features/quotations/promote-master-data-schema";

const quotationId = "00000000-0000-4000-8000-000000000001";

// Simulate exact wizard payload with nulls for empty optional strings
const wizardPayload = {
  quotationId,
  clientMode: "create" as const,
  clientName: "Test Client",
  legalName: null,
  agencyOrDirect: "agency" as const,
  industry: null,
  country: null,
  website: null,
  existingClientId: null,
  brandMode: "create" as const,
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
};

const result = promoteMasterDataSchema.safeParse(wizardPayload);
console.log("success:", result.success);
if (!result.success) {
  console.log("flatten:", JSON.stringify(result.error.flatten(), null, 2));
  console.log(
    "issues:",
    result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message, code: i.code }))
  );
}

// Test with empty strings instead of null
const wizardPayloadEmptyStrings = {
  ...wizardPayload,
  legalName: "",
  industry: "",
  country: "",
  website: "",
};

const result2 = promoteMasterDataSchema.safeParse(wizardPayloadEmptyStrings);
console.log("\nwith empty strings success:", result2.success);
