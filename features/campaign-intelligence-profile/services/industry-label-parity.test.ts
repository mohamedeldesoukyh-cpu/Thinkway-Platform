/**
 * Industry display parity — LLM arm vs heuristic arm.
 *
 * `detectIndustryFromBrief` returns a CampaignIndustry KEY ("general"), while
 * `industry` is contractually the human LABEL everywhere it is read — Intake
 * renders `facts.industry` verbatim in the "Category" row. The LLM arm stored
 * the raw key, so a brief that fell through the taxonomy showed "general"
 * instead of "Brand Campaign", while the same brief in heuristic mode showed
 * the label. Both arms must now agree.
 *
 * This does not change the taxonomy: a tea brand genuinely matches no industry
 * signal, so `general` / "Brand Campaign" remains the correct classification.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { extractCampaignFacts } from "@/features/campaign-director/facts/extract-campaign-facts";
import {
  detectIndustryFromBrief,
  getIndustryProfile,
  type CampaignIndustry,
} from "@/features/campaign-studio/services/industry-intelligence";

import { runCampaignIntelligencePipeline } from "./run-intelligence-pipeline";

const TAFAREEH_BRIEF = [
  "Brand: Tafareeh Tea",
  "",
  "Market: Egypt",
  "",
  "Objective: Build awareness for Tafareeh Tea and encourage people to try the product.",
].join("\n");

/** Every raw key the detector can return — none may reach a persisted profile. */
const RAW_INDUSTRY_KEYS: CampaignIndustry[] = [
  "luxury",
  "tourism",
  "baby",
  "retail",
  "finance",
  "telecom",
  "general",
];

test("the tea brief still classifies as `general` — the taxonomy is unchanged", () => {
  assert.equal(detectIndustryFromBrief(TAFAREEH_BRIEF), "general");
  assert.equal(getIndustryProfile("general").label, "Brand Campaign");
});

test("heuristic arm stores the label, never the raw key", () => {
  const facts = extractCampaignFacts({ rawMessage: TAFAREEH_BRIEF });

  assert.equal(facts.industry, "Brand Campaign");
  assert.notEqual(facts.industry, "general");
});

test("the pipeline stores the label, never the raw key", async () => {
  const { profile } = await runCampaignIntelligencePipeline({
    briefText: TAFAREEH_BRIEF,
    briefTextSource: "upload",
  });

  assert.equal(profile.industry, "Brand Campaign");
  assert.ok(
    !RAW_INDUSTRY_KEYS.includes(profile.industry as CampaignIndustry),
    `industry must be a display label, got the raw key ${JSON.stringify(profile.industry)}`
  );
});

test("every taxonomy entry has a label distinct from its key", () => {
  for (const key of RAW_INDUSTRY_KEYS) {
    const label = getIndustryProfile(key).label;
    assert.ok(label.trim().length > 0, `${key} must have a label`);
    assert.notEqual(label, key, `${key} label must not be the raw key`);
  }
});
