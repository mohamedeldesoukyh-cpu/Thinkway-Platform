import assert from "node:assert/strict";

import {
  classifyClientCategory,
  getCompanyHintCount,
} from "./classify-client-category";
import { CLASSIFICATION_CONFIDENCE } from "./classify-client-category-types";

async function expectClassification(
  name: string,
  expected: { categorySlug: string; subcategorySlug: string }
) {
  const result = await classifyClientCategory({ name });
  assert.ok(result, `expected classification for "${name}"`);
  assert.equal(result.categorySlug, expected.categorySlug, name);
  assert.equal(result.subcategorySlug, expected.subcategorySlug, name);
}

function assertConfidenceBand(
  result: NonNullable<Awaited<ReturnType<typeof classifyClientCategory>>>,
  source: typeof result.source,
  min: number,
  max: number
) {
  assert.equal(result.source, source);
  assert.ok(
    result.confidence >= min && result.confidence <= max,
    `expected ${source} confidence ${min}-${max}, got ${result.confidence}`
  );
}

async function run() {
  await expectClassification("Nike", {
    categorySlug: "fashion_apparel",
    subcategorySlug: "sportswear",
  });

  const nikeResult = await classifyClientCategory({ name: "Nike" });
  assert.ok(nikeResult);
  assertConfidenceBand(nikeResult, "rule", 95, 100);

  await expectClassification("Omnicom Group", {
    categorySlug: "marketing_advertising_media_agencies",
    subcategorySlug: "advertising_agency",
  });

  await expectClassification("WPP Media", {
    categorySlug: "marketing_advertising_media_agencies",
    subcategorySlug: "advertising_agency",
  });

  await expectClassification("Mind Share Egypt", {
    categorySlug: "marketing_advertising_media_agencies",
    subcategorySlug: "media_agency",
  });

  await expectClassification("Mind Share Egypt LTD", {
    categorySlug: "marketing_advertising_media_agencies",
    subcategorySlug: "media_agency",
  });

  await expectClassification("Mindshare", {
    categorySlug: "marketing_advertising_media_agencies",
    subcategorySlug: "media_agency",
  });

  await expectClassification("GroupM MENA", {
    categorySlug: "marketing_advertising_media_agencies",
    subcategorySlug: "media_investment_management",
  });

  await expectClassification("carrefour", {
    categorySlug: "retail_ecommerce",
    subcategorySlug: "retail_general_merchandise",
  });

  await expectClassification("Carrefour Egypt", {
    categorySlug: "retail_ecommerce",
    subcategorySlug: "retail_general_merchandise",
  });

  await expectClassification("Lulu Hypermarket", {
    categorySlug: "retail_ecommerce",
    subcategorySlug: "retail_general_merchandise",
  });

  await expectClassification("Amazon", {
    categorySlug: "retail_ecommerce",
    subcategorySlug: "online_marketplace",
  });

  await expectClassification("Procter & Gamble", {
    categorySlug: "beauty_personal_care",
    subcategorySlug: "beauty_personal_care",
  });

  await expectClassification("Unilever", {
    categorySlug: "beauty_personal_care",
    subcategorySlug: "beauty_personal_care",
  });

  await expectClassification("Nuqul", {
    categorySlug: "retail_ecommerce",
    subcategorySlug: "general_trading",
  });

  await expectClassification("Nuqul Group", {
    categorySlug: "retail_ecommerce",
    subcategorySlug: "general_trading",
  });

  await expectClassification("Almarai", {
    categorySlug: "retail_ecommerce",
    subcategorySlug: "food_beverages",
  });

  await expectClassification("Memac Ogilvy Egypt", {
    categorySlug: "marketing_advertising_media_agencies",
    subcategorySlug: "advertising_agency",
  });

  await expectClassification("Tarek Nour Communications", {
    categorySlug: "marketing_advertising_media_agencies",
    subcategorySlug: "advertising_agency",
  });

  await expectClassification("Juhayna", {
    categorySlug: "retail_ecommerce",
    subcategorySlug: "food_beverages",
  });

  await expectClassification("Domty Egypt", {
    categorySlug: "retail_ecommerce",
    subcategorySlug: "food_beverages",
  });

  await expectClassification("Eva Cosmetics", {
    categorySlug: "beauty_personal_care",
    subcategorySlug: "cosmetics",
  });

  await expectClassification("Commercial International Bank", {
    categorySlug: "financial_services_banking",
    subcategorySlug: "banking",
  });

  await expectClassification("Fawry", {
    categorySlug: "financial_services_banking",
    subcategorySlug: "financial_services",
  });

  await expectClassification("Vodafone Egypt", {
    categorySlug: "telecommunications",
    subcategorySlug: "mobile_technology",
  });

  await expectClassification("Telecom Egypt", {
    categorySlug: "telecommunications",
    subcategorySlug: "mobile_technology",
  });

  await expectClassification("Swvl", {
    categorySlug: "transportation_delivery",
    subcategorySlug: "ride_hailing_app",
  });

  await expectClassification("Breadfast Egypt", {
    categorySlug: "transportation_delivery",
    subcategorySlug: "delivery_ecommerce_platform",
  });

  await expectClassification("Al Ahly SC", {
    categorySlug: "government_sports_nonprofit",
    subcategorySlug: "sports_federations_leagues",
  });

  await expectClassification("Egyptian Tourism Authority", {
    categorySlug: "government_sports_nonprofit",
    subcategorySlug: "government_authorities",
  });

  await expectClassification("EIPICO", {
    categorySlug: "healthcare_wellness",
    subcategorySlug: "healthcare_products",
  });

  await expectClassification("Concrete Store Egypt", {
    categorySlug: "fashion_apparel",
    subcategorySlug: "fashion",
  });

  await expectClassification("Pet's Land Egypt", {
    categorySlug: "pet_animal_products",
    subcategorySlug: "pet_retail_pet_products",
  });

  await expectClassification("IKEA Egypt", {
    categorySlug: "home_furniture",
    subcategorySlug: "home_furniture_interiors",
  });

  await expectClassification("BYD", {
    categorySlug: "retail_ecommerce",
    subcategorySlug: "general_trading",
  });

  await expectClassification("Tesla", {
    categorySlug: "retail_ecommerce",
    subcategorySlug: "general_trading",
  });

  await expectClassification("Apple", {
    categorySlug: "retail_ecommerce",
    subcategorySlug: "consumer_electronics",
  });

  await expectClassification("Alibaba", {
    categorySlug: "retail_ecommerce",
    subcategorySlug: "online_marketplace",
  });

  await expectClassification("Middle East Communications Network MCN", {
    categorySlug: "marketing_advertising_media_agencies",
    subcategorySlug: "media_agency",
  });

  await expectClassification("MCN", {
    categorySlug: "marketing_advertising_media_agencies",
    subcategorySlug: "media_agency",
  });

  const mcnResult = await classifyClientCategory({ name: "Middle East Communications Network MCN" });
  assert.ok(mcnResult);
  assert.notEqual(mcnResult.categorySlug, "retail_ecommerce", "MCN must not be retail");
  assert.notEqual(mcnResult.subcategorySlug, "home_shopping_network", "MCN must not be home shopping");

  // Priority 1: approved classification short-circuits pipeline
  const approved = await classifyClientCategory({
    name: "Unknown Startup XYZ",
    approvedClassification: {
      categorySlug: "technology_software",
      subcategorySlug: "saas",
      confidence: 100,
      source: "approved",
    },
  });
  assert.ok(approved);
  assertConfidenceBand(approved, "approved", 100, 100);
  assert.equal(approved.categorySlug, "technology_software");

  // Priority 3: historical match before AI/fallback
  const historical = await classifyClientCategory({
    name: "New Brand Inc",
    historicalMatch: {
      categorySlug: "fashion_apparel",
      subcategorySlug: "luxury_fashion",
      matchedName: "Luxury Brand Inc",
      confidence: 95,
    },
  });
  assert.ok(historical);
  assertConfidenceBand(
    historical,
    "historical",
    CLASSIFICATION_CONFIDENCE.historical.min,
    CLASSIFICATION_CONFIDENCE.historical.max
  );
  assert.match(historical.reason ?? "", /Luxury Brand Inc/);

  // Rule beats historical when both would apply (pipeline order)
  const ruleFirst = await classifyClientCategory({
    name: "Nike",
    historicalMatch: {
      categorySlug: "retail_ecommerce",
      subcategorySlug: "retail_general_merchandise",
      matchedName: "Nike Store",
      confidence: 92,
    },
  });
  assert.ok(ruleFirst);
  assert.equal(ruleFirst.source, "rule");
  assert.equal(ruleFirst.categorySlug, "fashion_apparel");

  assert.ok(getCompanyHintCount() > 100, "company hints should be populated");

  console.log("classify-client-category.test.ts: ok");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
