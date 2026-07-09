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

function run(): void {
  testLooksLikeCampaignBrief();
  testBabyJoyIntent();
  testAdidasIntent();
  testLuxuryHotelIntent();
  testFinanceIntent();
  testTourismIntent();
  console.log("campaign-search-intent.test.ts: PASS");
}

run();
