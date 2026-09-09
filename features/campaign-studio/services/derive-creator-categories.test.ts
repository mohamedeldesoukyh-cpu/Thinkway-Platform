import assert from "node:assert/strict";
import { test } from "node:test";

import {
  deriveCreatorCategoriesFromBrief,
  isClientIndustryCategory,
  isMassAwarenessCreatorBrief,
} from "./derive-creator-categories";

const ARAB_BANK_BRIEF = `Hi Team,
Hope all is well.
We have an upcoming campaign for Arab Bank new credit card instant issuance feature and would appreciate your support in sharing an Influencers proposal.
Campaign Overview:
Campaign: Credit Card Instant Issuance
Duration: 1 month (TBA)
Campaign Highlights:
This new feature allows customers to apply for a credit card through Arabi Mobile, receive instant approval, and get their credit card with just one visit to the branch, significantly saving them time and effort while providing a seamless customer experience.
The campaign is targeting a mass audience, with the objective of driving awareness of the new Credit Card Instant Issuance feature and acquiring new bank customers. So accordingly, we would appreciate your recommendation for the most effective approach.
Objective:
Arab Bank will provide a credit card instant issuance service. This allows customers to apply for a credit card through their application Arabi Mobile, receive instant approval, and get their credit card with just one visit to the branch
They client needs an influencers proposal that will help drive awareness of the new Credit Card Instant Issuance feature and acquiring new bank customers.
At this stage, the client has not shared a specific budget. However, appreciate receiving cost-efficient recommendations given her budgets.
This proposal should follow a similar approach and utilize as strong mix as the previous LaLiga event, while tailoring the messaging to this campaign's objectives.
Awaiting your feedback.`;

test("client industry labels are not creator categories", () => {
  assert.equal(isClientIndustryCategory("Finance"), true);
  assert.equal(isClientIndustryCategory("Finance & Banking"), true);
  assert.equal(isClientIndustryCategory("Banking"), true);
  assert.equal(isClientIndustryCategory("Sports"), false);
  assert.equal(isClientIndustryCategory("Lifestyle"), false);
});

test("Arab Bank instant-issuance brief is a mass mix, not Finance-only", () => {
  assert.equal(isMassAwarenessCreatorBrief(ARAB_BANK_BRIEF), true);

  const categories = deriveCreatorCategoriesFromBrief({
    briefText: ARAB_BANK_BRIEF,
    objective: "Drive awareness of Credit Card Instant Issuance and acquire new bank customers",
    audience: "mass audience",
    campaignName: "Credit Card Instant Issuance",
    existingCategories: ["Finance"],
  });

  assert.ok(categories.includes("Sports"), `expected Sports, got ${categories.join(", ")}`);
  assert.ok(categories.includes("Lifestyle"), `expected Lifestyle, got ${categories.join(", ")}`);
  assert.ok(
    categories.includes("Entertainment"),
    `expected Entertainment, got ${categories.join(", ")}`
  );
  assert.ok(!categories.includes("Finance"));
  assert.ok(!categories.every((category) => /finance|bank/i.test(category)));
});

test("beauty briefs still resolve to Beauty, not a mass sports mix", () => {
  const categories = deriveCreatorCategoriesFromBrief({
    briefText: "L'Oréal Paris Beauty Launch in Egypt. Instagram and TikTok beauty creators, skincare category.",
    existingCategories: ["Beauty"],
  });
  assert.ok(categories.includes("Beauty"));
  assert.ok(!categories.includes("Sports"));
});

/**
 * Audience prose is not a creator strategy.
 *
 * CREATOR_CATEGORY_KEYWORDS maps `family → Parenting`, and that is correct where
 * it is used: classifying a CREATOR from their own bio and tags. Reading a BRIEF
 * is the opposite direction — a campaign whose audience happens to include
 * families is saying who should SEE the work, not who should MAKE it. Because
 * these categories become preferred Discovery category filters, the brief must
 * name a parenting/family creator strategy before Parenting is inferred.
 */
test("a family audience alone does not become a Parenting creator category", () => {
  const categories = deriveCreatorCategoriesFromBrief({
    briefText:
      "Tafareeh Tea, Egypt. Target Audience: Egyptian tea drinkers, mainly young adults and families.",
  });

  assert.ok(categories.includes("Food"), `expected Food, got ${categories.join(", ")}`);
  assert.ok(
    !categories.includes("Parenting"),
    `audience families must not infer Parenting, got ${categories.join(", ")}`
  );
});

test("singular 'family' in audience prose also does not infer Parenting", () => {
  const categories = deriveCreatorCategoriesFromBrief({
    briefText: "Audience: family time in Egypt",
  });
  assert.ok(!categories.includes("Parenting"), `got ${categories.join(", ")}`);
});

test("an explicit parenting/family creator strategy does infer Parenting", () => {
  const explicit = deriveCreatorCategoriesFromBrief({
    briefText: "Target Egyptian parents and family/parenting creators",
  });
  assert.ok(
    explicit.includes("Parenting"),
    `expected Parenting, got ${explicit.join(", ")}`
  );

  for (const briefText of [
    "We want family creators in Egypt",
    "Brief calls for family influencers",
    "family content on Instagram",
    "creators for families in Cairo",
    "family-focused creators",
    "mom creators and parenting influencers",
    "motherhood creators for the launch",
  ]) {
    const categories = deriveCreatorCategoriesFromBrief({ briefText });
    assert.ok(
      categories.includes("Parenting"),
      `expected Parenting for "${briefText}", got ${categories.join(", ")}`
    );
  }
});

test("Food/Beverage detection is unaffected by the Parenting narrowing", () => {
  for (const briefText of [
    "Tafareeh Tea campaign in Egypt",
    "a coffee brand launch",
    "beverage campaign for a juice brand",
    "cooking and recipe content",
  ]) {
    const categories = deriveCreatorCategoriesFromBrief({ briefText });
    assert.ok(
      categories.includes("Food"),
      `expected Food for "${briefText}", got ${categories.join(", ")}`
    );
  }
});
