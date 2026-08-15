import assert from "node:assert/strict";
import test from "node:test";

import {
  createEmptyCampaignIntelligenceProfile,
  type CampaignIntelligenceProfile,
} from "../types/profile";
import { createEmptyValidatedIntelligence } from "../types/validated-intelligence";

import { profileToCampaignFacts } from "./profile-to-facts";

function profileWith(
  overrides: Partial<CampaignIntelligenceProfile>
): CampaignIntelligenceProfile {
  return { ...createEmptyCampaignIntelligenceProfile(), ...overrides };
}

test("validated brand/client win over raw extraction fields", () => {
  const validated = createEmptyValidatedIntelligence();
  validated.brand = { brandName: "Nido", clientName: "Nestlé Egypt" };

  const facts = profileToCampaignFacts(
    profileWith({
      brandName: "Nido Fortified Milk Table Row", // raw extraction glitch
      clientName: "NidoMarket", // merged-cell extraction glitch
      validatedIntelligence: validated,
    })
  );

  assert.equal(facts.brandName, "Nido");
  assert.equal(facts.clientName, "Nestlé Egypt");
});

test("raw fields remain the fallback for legacy rows without validation", () => {
  const facts = profileToCampaignFacts(
    profileWith({ brandName: "Nido", clientName: "Nestlé Egypt" })
  );
  assert.equal(facts.brandName, "Nido");
  assert.equal(facts.clientName, "Nestlé Egypt");
});

test("validated market country label leads geography", () => {
  const validated = createEmptyValidatedIntelligence();
  validated.market = { countryCode: "EG", countryLabel: "Egypt", cities: ["Cairo"] };

  const facts = profileToCampaignFacts(
    profileWith({
      geography: ["MENA region focus"],
      validatedIntelligence: validated,
    })
  );

  assert.equal(facts.geography?.[0], "Egypt");
  assert.equal(facts.geography?.length, 1);
});

test("market falls back through raw chain when no validation exists", () => {
  const facts = profileToCampaignFacts(profileWith({ market: "Egypt" }));
  assert.deepEqual(facts.geography, ["Egypt"]);

  const factsFromAudience = profileToCampaignFacts(
    profileWith({ audienceDetail: { countries: ["Egypt", "Saudi Arabia"] } })
  );
  assert.deepEqual(factsFromAudience.geography, ["Egypt", "Saudi Arabia"]);
});

test("audience composes from structured detail when prose audience is missing", () => {
  const facts = profileToCampaignFacts(
    profileWith({
      audienceDetail: {
        gender: "female",
        ageMin: 20,
        ageMax: 35,
        countries: ["Egypt"],
        languages: ["Arabic"],
      },
    })
  );
  assert.equal(facts.audience, "Female · 20–35 · Egypt · Arabic");

  const prose = profileToCampaignFacts(
    profileWith({
      audience: "Young mothers in Cairo",
      audienceDetail: { gender: "female" },
    })
  );
  assert.equal(prose.audience, "Young mothers in Cairo");
});

test("campaignName fills product when products array is empty", () => {
  const facts = profileToCampaignFacts(
    profileWith({ campaignName: "Credit Card Instant Issuance" })
  );
  assert.equal(facts.product, "Credit Card Instant Issuance");
});

test("brand fills client when no separate client is extracted", () => {
  const facts = profileToCampaignFacts(profileWith({ brandName: "Arab Bank" }));
  assert.equal(facts.brandName, "Arab Bank");
  assert.equal(facts.clientName, "Arab Bank");
});

test("deliverables, multiple objectives, and budget flow through to facts", () => {
  const facts = profileToCampaignFacts(
    profileWith({
      deliverables: ["2 reels", "4 stories"],
      objectives: ["Awareness", "UGC volume"],
      budget: { amount: 1_000_000, currency: "EGP" },
    })
  );
  assert.deepEqual(facts.deliverables, ["2 reels", "4 stories"]);
  assert.equal(facts.objective, "Awareness · UGC volume");
  assert.deepEqual(facts.budget, { amount: 1_000_000, currency: "EGP" });
  assert.equal(facts.durationWeeks, undefined);
});
