import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { CampaignStrategyDocument } from "@/features/campaign-director/types";

import { buildVendorDiscoveryFunnel } from "./vendor-discovery-funnel";

const facts: CampaignFacts = {
  extractedAt: new Date().toISOString(),
  confidence: {},
  sources: {},
  brandName: "e&",
  objective: "Brand awareness",
  geography: ["Egypt"],
  platforms: ["instagram", "tiktok"],
  audience: "Lifestyle consumers in Egypt",
};

const strategy = {
  narrative: "Test",
  understanding: {
    brand: "e&",
    objective: "Brand awareness",
    geography: "Egypt",
    audience: "Lifestyle consumers in Egypt",
    platforms: ["instagram", "tiktok"],
    industry: "Telecom",
    constraints: [],
    risks: [],
  },
  creatorTierStrategy: [
    { tier: "Macro", allocationPercent: 50, rationale: "Reach" },
    { tier: "Micro", allocationPercent: 50, rationale: "Authenticity" },
  ],
  pillars: [],
} as unknown as CampaignStrategyDocument;

test("funnel does not invent upstream pool sizes from approved count", () => {
  const stages = buildVendorDiscoveryFunnel(facts, strategy, 2, false);
  const database = stages.find((s) => s.id === "database");
  const approved = stages.find((s) => s.id === "approved");
  assert.equal(database?.count, 2);
  assert.equal(approved?.count, 2);
  assert.ok(stages.every((s) => s.removedCount === 0));
});

test("funnel attributes measured pool reduction once at director review", () => {
  const stages = buildVendorDiscoveryFunnel(facts, strategy, 2, false, {
    initialPoolCount: 17,
  });
  assert.equal(stages.find((s) => s.id === "database")?.count, 17);
  assert.equal(stages.find((s) => s.id === "approved")?.count, 2);
  assert.equal(stages.find((s) => s.id === "director_review")?.removedCount, 15);
  assert.ok(
    !stages.some((s) => s.id !== "director_review" && s.removedCount > 0)
  );
});
