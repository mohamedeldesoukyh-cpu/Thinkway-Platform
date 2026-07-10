import assert from "node:assert/strict";
import test from "node:test";

import { parseBudgetTotalFromText } from "@/features/campaign-studio/components/sections/shared/format-utils";
import { resolveClientFromBrief } from "@/features/campaign-studio/services/industry-intelligence";

import { extractCampaignFacts } from "./extract-campaign-facts";

test("budget magnitude suffixes parse to full amounts", () => {
  assert.equal(parseBudgetTotalFromText("Budget: EGP 1M"), 1_000_000);
  assert.equal(parseBudgetTotalFromText("EGP 1M for creators"), 1_000_000);
  assert.equal(parseBudgetTotalFromText("budget of 1.5M USD"), 1_500_000);
  assert.equal(parseBudgetTotalFromText("total 250k AED"), 250_000);
  assert.equal(parseBudgetTotalFromText("budget: 2 million EGP"), 2_000_000);
  assert.equal(parseBudgetTotalFromText("$3.2mn media spend"), 3_200_000);
  // No-suffix amounts keep the legacy behavior.
  assert.equal(parseBudgetTotalFromText("Budget: EGP 1,000,000"), 1_000_000);
  assert.equal(parseBudgetTotalFromText("budget $500"), 500);
  assert.equal(parseBudgetTotalFromText("no numbers here"), undefined);
});

test("EGP 1M brief produces a 1,000,000 EGP budget fact", () => {
  const facts = extractCampaignFacts({
    rawMessage: "Launch a campaign for Koala Snacks in Egypt. Budget: EGP 1M. 6 weeks.",
  });
  assert.deepEqual(facts.budget, { amount: 1_000_000, currency: "EGP" });
});

test("geography only contains known markets, never free-text phrases", () => {
  const facts = extractCampaignFacts({
    rawMessage:
      "Create a campaign for Nova Water targeting families in the first month of summer. Launch in Egypt and Saudi Arabia across MENA. Budget: EGP 2M.",
  });
  assert.ok(facts.geography?.includes("Egypt"));
  assert.ok(facts.geography?.includes("Saudi Arabia"));
  assert.ok(facts.geography?.includes("MENA"));
  for (const region of facts.geography ?? []) {
    assert.ok(
      !/first month|summer|families/i.test(region),
      `junk geography leaked: ${region}`
    );
  }
});

test("brand name never falls back to the 'Brand Client' placeholder", () => {
  const facts = extractCampaignFacts({
    rawMessage: "We need influencers for a product push next quarter.",
  });
  assert.notEqual(facts.brandName, "Brand Client");
});

test("client comes from an explicit Client label — brand lines never leak into client", () => {
  assert.equal(resolveClientFromBrief("Client: Nestlé Egypt\nBrand: Nido"), "Nestlé Egypt");
  // A brand-only line must not be reported as the client.
  assert.equal(resolveClientFromBrief("Brand: Nido\nMarket: Egypt"), "Brand Client");
  // Product phrases must not be reported as the client.
  assert.equal(
    resolveClientFromBrief("We will launch Super Shine Serum in Egypt"),
    "Brand Client"
  );

  const facts = extractCampaignFacts({
    rawMessage: "Client: Nestlé Egypt\nBrand: Nido\nBudget: EGP 1M\nMarket: Egypt",
  });
  assert.equal(facts.clientName, "Nestlé Egypt");
  assert.equal(facts.brandName, "Nido");
});

test("e& trend brief: client, brand, industry, and multi-line deliverables resolve", () => {
  const brief = [
    "We have an upcoming summer campaign for e&, we're planning to launch an influencer campaign across TikTok to encourage audiences to engage with the campaign song and generate maximum buzz.",
    "",
    "Campaign is supposed to launch Mid July, and the budget is EGP 1M.",
    "",
    "Agency Deliverables:",
    "Influencer recommendation list with rationale.",
    "Activation strategy by creator tier and content category.",
    "Content concepts tailored to each creator.",
    "Posting timeline to sustain momentum throughout the campaign.",
    "Amplification recommendations to maximize trend adoption.",
    "Performance measurement report including reach, engagement, video views, sound usage, UGC volume, and trend participation",
    "",
    "Goal: Turn the campaign song into one of the biggest TikTok sounds of Summer 2026",
  ].join("\n");

  const facts = extractCampaignFacts({ rawMessage: brief });
  assert.equal(facts.clientName, "e&");
  assert.equal(facts.brandName, "e&");
  assert.equal(facts.industry, "Telecom");
  assert.deepEqual(facts.budget, { amount: 1_000_000, currency: "EGP" });
  assert.equal(facts.deliverables?.length, 6);
  assert.equal(facts.deliverables?.[0], "Influencer recommendation list with rationale");
  assert.ok(facts.deliverables?.[5]?.startsWith("Performance measurement report"));
  // The old bug: "launch an influencer campaign" must never become the brand.
  assert.notEqual(facts.brandName, "an influencer");
  assert.notEqual(facts.clientName, "an influencer");
});

test("article-led captures never become brand or client", () => {
  const facts = extractCampaignFacts({
    rawMessage: "We're planning to launch an influencer campaign across TikTok this summer.",
  });
  assert.notEqual(facts.brandName, "an influencer");
  assert.notEqual(facts.clientName, "an influencer");
});

test("labeled deliverables are extracted as a list", () => {
  const facts = extractCampaignFacts({
    rawMessage:
      "Campaign for GlowCo in Egypt. Deliverables: 2 reels, 4 stories, 1 static post. Budget EGP 500k.",
  });
  assert.deepEqual(facts.deliverables, ["2 reels", "4 stories", "1 static post"]);
  assert.equal(facts.budget?.amount, 500_000);
});
