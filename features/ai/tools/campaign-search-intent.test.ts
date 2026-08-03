import assert from "node:assert/strict";

import {
  buildCampaignSearchIntent,
  looksLikeCampaignBrief,
} from "./campaign-search-intent";

function testLooksLikeCampaignBrief(): void {
  assert.equal(
    looksLikeCampaignBrief(
      "Launch BabyJoy Premium Diapers in Egypt. Target mothers with babies 0–3 years. Budget EGP 2,000,000."
    ),
    true
  );
  assert.equal(looksLikeCampaignBrief("Find travel creators in Egypt"), false);
  assert.equal(looksLikeCampaignBrief("Beauty creators in UAE"), false);
}

function testBabyJoyIntent(): void {
  const intent = buildCampaignSearchIntent(
    "Launch BabyJoy Premium Diapers in Egypt. Target mothers with babies 0–3 years. Budget EGP 2,000,000. Campaign duration 6 weeks."
  );
  assert.equal(intent.industryKey, "baby");
  assert.equal(intent.industry, "Baby Care");
  assert.equal(intent.country, "EG");
  assert.ok(intent.categories.some((c) => /parenting|motherhood|baby|family/i.test(c)));
  assert.deepEqual(intent.platforms, ["instagram", "tiktok"]);
  assert.ok(!intent.rawBrief.includes("Budget EGP") || intent.semanticKeywords.length > 0);
  assert.ok(intent.semanticKeywords.every((kw) => !kw.includes("launch")));
}

function testAdidasIntent(): void {
  const intent = buildCampaignSearchIntent(
    "Adidas Egypt sportswear product launch for new running collection. Target active lifestyle 18–35 in Cairo and Alexandria."
  );
  assert.equal(intent.industryKey, "sports_fitness");
  assert.ok(intent.categories.some((c) => /fitness|sports/i.test(c)));
  assert.equal(intent.country, "EG");
}

function testLuxuryHotelIntent(): void {
  const intent = buildCampaignSearchIntent(
    "Find luxury hotel creators in Dubai for a 5-star resort campaign"
  );
  assert.equal(intent.industryKey, "luxury");
  assert.equal(intent.country, "AE");
  assert.ok(intent.categories.some((c) => /travel|luxury|hospitality/i.test(c)));
}

function testFinanceIntent(): void {
  const intent = buildCampaignSearchIntent(
    "Emirates NBD credit card launch campaign in UAE. Target young professionals interested in finance and wealth."
  );
  assert.equal(intent.industryKey, "finance");
  assert.equal(intent.country, "AE");
  assert.ok(intent.categories.some((c) => /finance|business/i.test(c)));
}

function testTourismIntent(): void {
  const intent = buildCampaignSearchIntent(
    "Visit Egypt tourism destination marketing campaign. Promote pyramids and Red Sea resorts to international travelers."
  );
  assert.equal(intent.industryKey, "tourism");
  assert.ok(intent.categories.some((c) => /travel|tourism/i.test(c)));
}

function testBeautyDoesNotPadLifestyle(): void {
  const intent = buildCampaignSearchIntent(
    "Create a new campaign for L'Oréal Paris Beauty Launch. Brand L'Oréal Paris, market Egypt, budget 1500000 EGP, Instagram and TikTok beauty and skincare creators."
  );
  assert.equal(intent.industryKey, "beauty");
  assert.ok(intent.categories.some((c) => /beauty/i.test(c)));
  assert.ok(
    !intent.categories.some((c) => c.trim().toLowerCase() === "lifestyle"),
    `Beauty intent must not pad Lifestyle: ${intent.categories.join(", ")}`
  );
}

function testFashionDoesNotPadLifestyle(): void {
  const intent = buildCampaignSearchIntent(
    "Create a new campaign for Trendyol Fashion Campaign. Brand Trendyol, market Egypt, budget 2000000 EGP, Instagram fashion creators."
  );
  assert.equal(intent.industryKey, "fashion");
  assert.ok(intent.categories.some((c) => /fashion/i.test(c)));
  assert.ok(!intent.categories.some((c) => c.trim().toLowerCase() === "lifestyle"));
}

function testSportsFormulaOne(): void {
  const intent = buildCampaignSearchIntent(
    "Create a new campaign for Formula 1 Abu Dhabi Grand Prix. Brand Formula 1, market UAE, budget 500000 AED, sports and motorsport creators."
  );
  assert.equal(intent.industryKey, "sports_fitness");
  assert.ok(intent.categories.some((c) => /sport|fitness|automotive/i.test(c)));
  assert.ok(!intent.categories.some((c) => c.trim().toLowerCase() === "lifestyle"));
}

function testRetailKeepsLifestylePrimary(): void {
  const intent = buildCampaignSearchIntent(
    "Create a new campaign for Noon Retail Campaign. Brand Noon, market Egypt, budget 1800000 EGP, Instagram and TikTok shopping creators."
  );
  assert.equal(intent.industryKey, "retail");
  assert.ok(intent.categories.some((c) => c.trim().toLowerCase() === "lifestyle"));
  assert.ok(
    !intent.categories.some((c) => c.trim().toLowerCase() === "fashion"),
    "Retail must not collapse to Fashion via Lifestyle sanitization"
  );
}

function run(): void {
  testLooksLikeCampaignBrief();
  testBabyJoyIntent();
  testAdidasIntent();
  testLuxuryHotelIntent();
  testFinanceIntent();
  testTourismIntent();
  testBeautyDoesNotPadLifestyle();
  testFashionDoesNotPadLifestyle();
  testSportsFormulaOne();
  testRetailKeepsLifestylePrimary();
  console.log("campaign-search-intent.test.ts: PASS");
}

run();
