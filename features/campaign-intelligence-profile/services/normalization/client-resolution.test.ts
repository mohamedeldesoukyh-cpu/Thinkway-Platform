import assert from "node:assert/strict";
import test from "node:test";

import { createEmptyCampaignIntelligenceProfile } from "../../types/profile";

import { normalizeCampaignIntelligence } from "./normalize-campaign-intelligence";
import {
  isValidClientName,
  recoverLabeledEntityFromText,
  sanitizeBrandName,
} from "./validators";

test("sanitizeBrandName strips glued field labels and leading label text", () => {
  assert.equal(sanitizeBrandName("Nestlé EgyptBrand"), "Nestlé Egypt");
  assert.equal(sanitizeBrandName("L'Oréal ParisMarket"), "L'Oréal Paris");
  assert.equal(sanitizeBrandName("PepsiIndustry"), "Pepsi");
  assert.equal(sanitizeBrandName("Client: Nestlé Egypt"), "Nestlé Egypt");
  assert.equal(sanitizeBrandName("Brand Name: Nido"), "Nido");
  // Legitimate names survive.
  assert.equal(sanitizeBrandName("Emirates NBD"), "Emirates NBD");
  assert.equal(sanitizeBrandName("Coca-Cola"), "Coca-Cola");
});

test("isValidClientName accepts legal entities, rejects fragments and copy", () => {
  assert.equal(isValidClientName("Nestlé Egypt"), true);
  assert.equal(isValidClientName("Landmark Retail Investment Co. L.L.C"), true);
  assert.equal(isValidClientName("and drive awareness among Gen Z"), false);
  assert.equal(isValidClientName("Amplify reach across MENA"), false);
  assert.equal(isValidClientName("Summer 2026"), false);
  assert.equal(isValidClientName(""), false);
});

test("recoverLabeledEntityFromText finds explicitly labeled client/brand rows", () => {
  const brief = [
    "Campaign Brief",
    "Client Name: Nestlé Egypt",
    "Brand: Nido",
    "Market: Egypt",
    "Objective: Drive awareness",
  ].join("\n");

  assert.equal(recoverLabeledEntityFromText(brief, "client"), "Nestlé Egypt");
  assert.equal(recoverLabeledEntityFromText(brief, "brand"), "Nido");
  // Table-flattened variant with pipe separators.
  assert.equal(
    recoverLabeledEntityFromText("| Client | Nestlé Egypt |", "client"),
    "Nestlé Egypt"
  );
  // Never recovers from copy that lacks an explicit label.
  assert.equal(
    recoverLabeledEntityFromText("Our client base loves this product", "client"),
    undefined
  );
});

test("explicit client in the brief wins over mangled extraction", () => {
  const profile = {
    ...createEmptyCampaignIntelligenceProfile(),
    clientName: "and amplify awareness among Gen Z mothers", // extraction glitch
    brandName: "Nido",
    structuredBrief: {
      llmBriefText: "Client: Nestlé Egypt\nBrand: Nido\nMarket: Egypt",
    },
  };

  const { normalizedEntities, extractionIssues } = normalizeCampaignIntelligence(profile);

  assert.equal(normalizedEntities.brand.clientName, "Nestlé Egypt");
  assert.equal(normalizedEntities.brand.brandName, "Nido");
  assert.equal(
    normalizedEntities.fieldEvidence["brand.clientName"]?.sourceField,
    "structuredBrief.client"
  );
  assert.ok(extractionIssues.some((i) => i.field === "clientName"));
});

test("merged-label client is sanitized without needing recovery", () => {
  const profile = {
    ...createEmptyCampaignIntelligenceProfile(),
    clientName: "Nestlé EgyptMarket",
    brandName: "Nido",
  };

  const { normalizedEntities } = normalizeCampaignIntelligence(profile);
  assert.equal(normalizedEntities.brand.clientName, "Nestlé Egypt");
});

test("missing brand is recovered from an explicit Brand row", () => {
  const profile = {
    ...createEmptyCampaignIntelligenceProfile(),
    clientName: "Nestlé Egypt",
    structuredBrief: {
      llmBriefText: "Client: Nestlé Egypt\nBrand: Nido\nBudget: EGP 1M",
    },
  };

  const { normalizedEntities } = normalizeCampaignIntelligence(profile);
  assert.equal(normalizedEntities.brand.brandName, "Nido");
  assert.equal(
    normalizedEntities.fieldEvidence["brand.brandName"]?.sourceField,
    "structuredBrief.brand"
  );
});
