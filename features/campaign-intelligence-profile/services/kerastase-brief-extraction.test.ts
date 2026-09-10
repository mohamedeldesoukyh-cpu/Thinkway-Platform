/**
 * Kérastase Egypt — canonical Campaign Intelligence regression.
 *
 * The live brief lost five fields that it states plainly, and each had a
 * different cause:
 *
 * - Audience was extracted, then deleted at persistence because the extractor
 *   had marked it inferred (`stripInferredStrictFacts`).
 * - Category classified as "Retail & Sportswear" because the word "fashion" in
 *   "beauty, haircare, lifestyle and fashion creators" matched the retail
 *   signal, and the taxonomy had no beauty bucket at all.
 * - Deliverables, KPIs, key message and CTA were parsed into correctly titled
 *   sections and then dropped, because the structured field mapper read table
 *   cells only and this brief is heading + list throughout.
 * - Budget read 3,000,000,000 EGP: the magnitude suffix pattern crossed a line
 *   break and took the "K" of "Kérastase" as "thousand".
 *
 * These assertions are about values the brief actually contains. Nothing here
 * may pass by synthesizing a default — the negative cases at the end pin that.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { parseBudgetTotalFromText } from "@/features/campaign-studio/components/sections/shared/format-utils";
import {
  detectIndustryFromBrief,
  getIndustryProfile,
} from "@/features/campaign-studio/services/industry-intelligence";
import { requiredIntakeFacts } from "@/features/campaign-studio/services/studio-intake-facts";
import { resolveCreatorTierMixWithBasis } from "@/features/campaign-studio/services/creator-quantity";

import { buildKerastaseEgyptDocx } from "../fixtures/build-kerastase-docx";
import { profileToCampaignFacts } from "./profile-to-facts";
import { runCampaignIntelligencePipeline } from "./run-intelligence-pipeline";
import { parseStructuredBriefDocument } from "./structured-brief-parser";
import type { CampaignIntelligenceProfile } from "../types/profile";

type Extracted = {
  profile: CampaignIntelligenceProfile;
  facts: ReturnType<typeof profileToCampaignFacts>;
  briefText: string;
};

let cached: Promise<Extracted> | undefined;

/** Run the real upload pipeline once: parse → extract → normalize → facts. */
function extractKerastase(): Promise<Extracted> {
  cached ??= (async () => {
    const buffer = await buildKerastaseEgyptDocx();
    const parsed = await parseStructuredBriefDocument(
      buffer,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "kerastase-egypt-brief.docx"
    );

    // Guard: the fixture must reproduce the shape that broke — heading + list,
    // no tables. Without this the assertions below could pass for the wrong reason.
    const blocks = parsed.document.sections.flatMap((section) => section.blocks);
    assert.ok(
      blocks.some((block) => block.type === "list"),
      "fixture must parse list blocks"
    );
    assert.ok(
      !blocks.some((block) => block.type === "table"),
      "fixture must contain no tables — table briefs already worked"
    );

    const { profile } = await runCampaignIntelligencePipeline({
      briefText: parsed.llmText,
      briefTextSource: "upload",
      structuredParserOutput: parsed.document,
    });

    return { profile, facts: profileToCampaignFacts(profile), briefText: parsed.llmText };
  })();
  return cached;
}

function intakeValue(facts: Extracted["facts"], key: string): string | null {
  return requiredIntakeFacts(facts).rows.find((row) => row.key === key)?.value ?? null;
}

// ---------------------------------------------------------------------------
// Audience

test("the brief's stated audience survives to Campaign Facts and renders on Intake", async () => {
  const { profile, facts } = await extractKerastase();

  assert.match(profile.audience ?? "", /Women aged 20[–-]40 in Egypt/i);
  assert.match(facts.audience ?? "", /Women aged 20[–-]40 in Egypt/i);
  assert.equal(
    facts.sources?.audience,
    "brief",
    "a stated audience must be brief-sourced, or persistence strips it"
  );

  const rendered = intakeValue(facts, "audience");
  assert.ok(rendered, "the Intake Audience row must not read Missing");
  assert.match(rendered, /Women aged 20[–-]40 in Egypt/i);
});

test("an inferred or default audience is still withheld from Intake", () => {
  // The provenance rule is unchanged: only brief/operator evidence displays.
  for (const source of ["inferred", "default"] as const) {
    const facts = {
      audience: "brand-relevant consumers in primary market",
      confidence: { audience: 0.9 },
      sources: { audience: source },
      extractedAt: "",
    } as unknown as Extracted["facts"];
    assert.equal(
      intakeValue(facts, "audience"),
      null,
      `a ${source} audience must not display as a campaign fact`
    );
  }
});

// ---------------------------------------------------------------------------
// Industry / Category

test("Kérastase resolves to the canonical Beauty category, not Retail & Sportswear", async () => {
  const { profile, facts, briefText } = await extractKerastase();

  assert.equal(detectIndustryFromBrief(briefText), "beauty");
  assert.equal(getIndustryProfile("beauty").label, "Beauty & Personal Care");
  assert.equal(profile.industry, "Beauty & Personal Care");
  assert.equal(facts.industry, "Beauty & Personal Care");
  assert.equal(intakeValue(facts, "category"), "Beauty & Personal Care");
  assert.notEqual(profile.industry, "Retail & Sportswear");
});

test("a creator brief naming fashion creators does not classify the client as retail", () => {
  // The exact sentence from the live brief that caused the misclassification.
  const creatorBrief = "Follow beauty, haircare, lifestyle and fashion creators.";
  assert.notEqual(detectIndustryFromBrief(creatorBrief), "retail");

  // Withholding the vertical list must not swallow the rest of the sentence:
  // a real client signal on the same line still classifies.
  assert.equal(
    detectIndustryFromBrief(
      "We are planning an influencer campaign for e& across TikTok with lifestyle and comedy creators."
    ),
    "telecom"
  );
  // A client that genuinely sells fashion is still retail.
  assert.equal(detectIndustryFromBrief("Adidas sportswear launch in Egypt."), "retail");
});

test("creator categories stay creator verticals, not the client industry", async () => {
  const { profile } = await extractKerastase();

  assert.ok((profile.creatorCategories ?? []).includes("Beauty"));
  assert.ok(
    !(profile.creatorCategories ?? []).some((category) => /retail|sportswear/i.test(category)),
    "the client industry must never leak into creator categories"
  );
});

// ---------------------------------------------------------------------------
// Deliverables · KPIs · key message · CTA

test("deliverables stated as a list under a heading reach Campaign Facts", async () => {
  const { profile, facts } = await extractKerastase();

  const deliverables = profile.deliverables ?? [];
  assert.ok(
    deliverables.some((item) => /Instagram Reel \/ TikTok video/i.test(item)),
    `expected the Reel/TikTok deliverable, got ${JSON.stringify(deliverables)}`
  );
  assert.ok(deliverables.some((item) => /Instagram Stories/i.test(item)));
  assert.deepEqual(facts.deliverables, deliverables);
  assert.ok(intakeValue(facts, "deliverables"));
});

test("KPIs from the primary and secondary KPI sections both survive", async () => {
  const { profile, facts } = await extractKerastase();

  const kpis = profile.kpis ?? [];
  for (const expected of ["Engagement Rate", "Conversion Rate", "Video Views"]) {
    assert.ok(
      kpis.some((kpi) => kpi.toLowerCase() === expected.toLowerCase()),
      `expected KPI ${expected}, got ${JSON.stringify(kpis)}`
    );
  }
  assert.deepEqual(facts.kpis, kpis);
  assert.ok(intakeValue(facts, "kpis"));

  // Every KPI must be a phrase the brief actually contains.
  const { briefText } = await extractKerastase();
  for (const kpi of kpis) {
    assert.ok(
      briefText.toLowerCase().includes(kpi.toLowerCase()),
      `KPI ${JSON.stringify(kpi)} is not present in the brief`
    );
  }
});

test("the key message and CTA are preserved verbatim from their sections", async () => {
  const { profile } = await extractKerastase();

  assert.match(
    profile.keyMessage ?? "",
    /Professional-level haircare designed around your hair needs\./
  );
  assert.ok(
    !/^["“]/.test(profile.keyMessage ?? ""),
    "surrounding quotes are stripped so the message reads as the message"
  );
  assert.match(profile.callToAction ?? "", /Kérastase/);
});

test("a list-introducing line is never captured as a deliverable or KPI", async () => {
  const { profile } = await extractKerastase();

  for (const value of [...(profile.deliverables ?? []), ...(profile.kpis ?? [])]) {
    assert.ok(!value.endsWith(":"), `introducer captured as a value: ${JSON.stringify(value)}`);
  }
  assert.ok(
    !(profile.deliverables ?? []).some((item) => /^Suggested deliverables/i.test(item))
  );
});

// ---------------------------------------------------------------------------
// Budget

test("EGP 3,000,000 followed by an accented word is 3,000,000 — not 3,000,000,000", async () => {
  const { profile, facts } = await extractKerastase();

  assert.deepEqual(profile.budget, { amount: 3_000_000, currency: "EGP" });
  assert.deepEqual(facts.budget, { amount: 3_000_000, currency: "EGP" });
  assert.equal(intakeValue(facts, "budget"), "EGP 3,000,000");
});

test("a magnitude suffix must be on the amount's own line and end on a non-letter", () => {
  // The exact live shape: the brand name begins the next line.
  assert.equal(
    parseBudgetTotalFromText("Total Influencer Budget: EGP 3,000,000\nKérastase is looking to partner"),
    3_000_000
  );
  assert.equal(parseBudgetTotalFromText("Budget: EGP 3,000,000\nKickoff in July"), 3_000_000);
  assert.equal(parseBudgetTotalFromText("Budget: EGP 3,000,000"), 3_000_000);
  // Real suffixes still apply.
  assert.equal(parseBudgetTotalFromText("Budget: EGP 3M"), 3_000_000);
  assert.equal(parseBudgetTotalFromText("budget of 250k AED"), 250_000);
  assert.equal(parseBudgetTotalFromText("budget: 2 million EGP"), 2_000_000);
});

// ---------------------------------------------------------------------------
// Nothing invented

test("fields the brief does not state stay empty", async () => {
  const { facts } = await extractKerastase();

  // The brief names no creator quantity and no campaign name.
  assert.equal(facts.requestedCreatorCount, undefined);
  assert.equal(intakeValue(facts, "requestedCreators"), null);
  // Duration and market are stated, so they must be present — this guards the
  // test itself against passing on an empty extraction.
  assert.equal(facts.durationWeeks, 4);
  assert.deepEqual(facts.geography, ["Egypt"]);
});

test("the brief's preferred creator mix survives the upload path as a stated fact", async () => {
  const { facts } = await extractKerastase();

  // "Preferred Creator Mix: Macro / Mid / Micro" — tier names, no percentages.
  // Nothing captured this before, so Strategy fell back to a generic
  // Macro 40 / Micro 35 / Nano 25 for every campaign in this industry.
  assert.deepEqual(facts.creatorTiers, [{ tier: "Macro" }, { tier: "Mid" }, { tier: "Micro" }]);
  assert.equal(facts.sources.creatorTiers, "brief");
});

test("the tier mix Strategy would use is the brief's tiers, not the generic split", async () => {
  const { facts } = await extractKerastase();
  const { mix, basis } = resolveCreatorTierMixWithBasis(facts);

  assert.deepEqual(mix.map((tier) => tier.tier), ["Macro", "Mid", "Micro"]);
  assert.equal(basis, "brief_tiers_recommended_split");
  assert.notEqual(
    mix.map((tier) => `${tier.tier} ${tier.percent}%`).join(" / "),
    "Macro 40% / Micro 35% / Nano 25%"
  );
});
