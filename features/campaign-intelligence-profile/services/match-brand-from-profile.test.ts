import assert from "node:assert/strict";

import { brandMatchesAlias, findKnownBrandsInText, resolveBrandWithAliases } from "./brand-resolution";
import { detectBrandFromProfile, pickBrandIdFromAccessibleList, pickResolvedBrandId } from "./match-brand-from-profile";
import { brandMatchesAlias } from "./brand-resolution";
import { isValidBrandName } from "./normalization/validators";
import type { LiveMasters } from "@/lib/intelligence/entity-resolution/matchers";

// --- brand name validation ---

assert.equal(isValidBrandName("and amplify the Summer 2026"), false);
assert.equal(isValidBrandName("Etisalat"), true);
assert.equal(isValidBrandName("E&"), true);
assert.equal(isValidBrandName("L'Oréal Paris"), true);
assert.equal(isValidBrandName("Drive awareness among Gen Z"), false);
assert.equal(isValidBrandName("The Summer 2026 campaign"), false);

// --- known brand text scanning ---

assert.deepEqual(findKnownBrandsInText("Etisalat E& telecom campaign in UAE"), [
  "Etisalat",
  "E&",
]);
assert.deepEqual(findKnownBrandsInText("Partner with eand for 5G launch"), ["Eand"]);

// --- alias matching ---

assert.equal(brandMatchesAlias("E&", "Etisalat"), true);
assert.equal(brandMatchesAlias("eand", "Etisalat"), true);
assert.equal(brandMatchesAlias("Etisalat", "E&"), true);
assert.equal(brandMatchesAlias("E&", "E& UAE"), true);
assert.equal(brandMatchesAlias("E& / Esalat", "E&"), true);
assert.equal(brandMatchesAlias("Esalat", "Etisalat"), true);
assert.equal(brandMatchesAlias("and amplify", "Etisalat"), false);

// --- resolve brand with aliases (in-memory masters) ---

const etisalatMasters: LiveMasters = {
  groups: [],
  clients: [{ id: "client-1", name: "Etisalat Group", group_id: null }],
  brands: [{ id: "brand-etisalat", name: "Etisalat", client_id: "client-1" }],
  influencers: [],
  handles: [],
  headers: [],
  lines: [],
  overrides: [],
};

const eandBrandMasters: LiveMasters = {
  ...etisalatMasters,
  brands: [{ id: "brand-eand", name: "E&", client_id: "client-1" }],
};

assert.equal(
  resolveBrandWithAliases(etisalatMasters, ["E&"], null).resolvedBrandId,
  "brand-etisalat"
);
assert.equal(
  resolveBrandWithAliases(etisalatMasters, ["eand"], null).resolvedBrandId,
  "brand-etisalat"
);
assert.equal(
  resolveBrandWithAliases(eandBrandMasters, ["Etisalat"], null).resolvedBrandId,
  "brand-eand"
);

const eandUaeBrandMasters: LiveMasters = {
  ...etisalatMasters,
  brands: [{ id: "brand-eand-uae", name: "E& UAE", client_id: "client-1" }],
};

assert.equal(
  resolveBrandWithAliases(eandUaeBrandMasters, ["E&"], null).resolvedBrandId,
  "brand-eand-uae"
);

const wrongClientMasters: LiveMasters = {
  groups: [],
  clients: [
    { id: "client-1", name: "Etisalat Group", group_id: null },
    { id: "client-wrong", name: "Unrelated Holdings", group_id: null },
  ],
  brands: [
    { id: "brand-etisalat", name: "Etisalat", client_id: "client-1" },
    { id: "brand-other", name: "Other Brand", client_id: "client-wrong" },
  ],
  influencers: [],
  handles: [],
  headers: [],
  lines: [],
  overrides: [],
};

assert.equal(
  resolveBrandWithAliases(wrongClientMasters, ["Etisalat"], "client-wrong").resolvedBrandId,
  null
);
assert.equal(
  resolveBrandWithAliases(wrongClientMasters, ["Etisalat"], null).resolvedBrandId,
  "brand-etisalat"
);

// --- detectBrandFromProfile rejects garbage brandName but finds Etisalat in brief ---

const mockSupabase = {
  from(table: string) {
    const data =
      table === "clients"
        ? etisalatMasters.clients
        : table === "brands"
          ? etisalatMasters.brands
          : [];
    return {
      select: () => Promise.resolve({ data, error: null }),
    };
  },
  schema: () => ({
    from: () => ({
      select: () => Promise.resolve({ data: [], error: null }),
    }),
  }),
} as unknown as Parameters<typeof detectBrandFromProfile>[0];

void (async () => {
  const garbageResult = await detectBrandFromProfile(mockSupabase, {
    brandName: "and amplify the Summer 2026",
    clientName: null,
    campaignName: "Summer 2026 Youth Push",
    rawBriefExcerpt: "Etisalat E& 5G campaign targeting Gen Z in UAE",
    objectives: ["Drive 5G awareness"],
  });

  assert.equal(garbageResult.extractedBrandName, null);
  assert.equal(garbageResult.hasReliableBrandHint, false);
  assert.equal(garbageResult.bestMatch?.brandId, "brand-etisalat");
  assert.ok(garbageResult.bestMatch!.confidence >= 0.75);

  const validResult = await detectBrandFromProfile(mockSupabase, {
    brandName: "Etisalat",
    clientName: "Etisalat Group",
    campaignName: "E& 5G Youth Launch",
    rawBriefExcerpt: "Etisalat E& telecom campaign",
    objectives: [],
  });

  assert.equal(validResult.extractedBrandName, "Etisalat");
  assert.equal(validResult.hasReliableBrandHint, true);
  assert.equal(validResult.bestMatch?.brandId, "brand-etisalat");

  const wrongClientSupabase = {
    from(table: string) {
      const data =
        table === "clients"
          ? wrongClientMasters.clients
          : table === "brands"
            ? wrongClientMasters.brands
            : [];
      return {
        select: () => Promise.resolve({ data, error: null }),
      };
    },
    schema: () => ({
      from: () => ({
        select: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
  } as unknown as Parameters<typeof detectBrandFromProfile>[0];

  const scopedResult = await detectBrandFromProfile(wrongClientSupabase, {
    brandName: "and amplify the Summer 2026",
    clientName: "Unrelated Holdings",
    campaignName: "Summer 2026 Youth Push",
    rawBriefExcerpt: "Etisalat E& 5G campaign targeting Gen Z in UAE",
    objectives: ["Drive 5G awareness"],
  });

  assert.equal(scopedResult.bestMatch?.brandId, "brand-etisalat");
  assert.ok(scopedResult.bestMatch!.confidence >= 0.65);

  // --- pickResolvedBrandId fallbacks ---

  assert.equal(
    pickResolvedBrandId({
      candidates: [],
      bestMatch: null,
      extractedBrandName: null,
      extractedClientName: null,
      hasReliableBrandHint: false,
    }),
    null
  );

  assert.equal(
    pickResolvedBrandId({
      candidates: [
        {
          brandId: "brand-etisalat",
          brandName: "Etisalat",
          clientId: "client-1",
          clientName: "Etisalat Group",
          confidence: 0.55,
        },
      ],
      bestMatch: null,
      extractedBrandName: "Etisalat",
      extractedClientName: null,
      hasReliableBrandHint: true,
    }),
    "brand-etisalat"
  );

  assert.equal(
    pickBrandIdFromAccessibleList(
      {
        candidates: [],
        bestMatch: null,
        extractedBrandName: "E& / Esalat",
        extractedClientName: null,
        hasReliableBrandHint: true,
      },
      [{ id: "brand-eand", name: "E&", clientId: "client-1", clientName: "Etisalat" }]
    ),
    "brand-eand"
  );

  assert.equal(
    pickResolvedBrandId(
      {
        candidates: [],
        bestMatch: null,
        extractedBrandName: "E& / Esalat",
        extractedClientName: null,
        hasReliableBrandHint: true,
      },
      null,
      [{ id: "brand-eand", name: "E&", clientId: "client-1", clientName: "Etisalat" }]
    ),
    "brand-eand"
  );

  console.log("match-brand-from-profile tests passed");
})();
