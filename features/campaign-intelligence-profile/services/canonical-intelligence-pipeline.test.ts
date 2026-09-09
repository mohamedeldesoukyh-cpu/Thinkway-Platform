/**
 * Canonical Campaign Intelligence pipeline — integration regression.
 *
 * Exercises the real production chain on a faithful Tafareeh Tea brief:
 *
 *   brief → runCampaignIntelligencePipeline() → normalized profile
 *         → validatedIntelligence → profileToCampaignFacts() → Intake rows
 *
 * Guards the audit findings: no synthetic KPIs, no bare audience labels, no
 * invented demographics, and campaign intent kept out of Discovery-shaped
 * validated intelligence.
 */

import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import { extractCampaignFacts } from "@/features/campaign-director/facts/extract-campaign-facts";
import {
  campaignFactsFromIntakeEdit,
  requiredIntakeFacts,
} from "@/features/campaign-studio/services/studio-intake-facts";

import { profileToCampaignFacts } from "./profile-to-facts";
import { runCampaignIntelligencePipeline } from "./run-intelligence-pipeline";

/** Faithful reconstruction of the Tafareeh Tea brief. Contains no budget. */
const TAFAREEH_BRIEF = `Tafareeh Tea Campaign Brief

Brand: Tafareeh Tea
Market: Egypt
Duration: 2 weeks

Objective: build awareness and encourage people to try and buy the product.

Target Audience:
Egyptian tea drinkers, mainly young adults and families.

Key message: rich, strong tea integrated naturally into everyday Egyptian life.

Tone: natural, relatable, positive, Egyptian, not overly scripted.

Call to action: Try Tafareeh Tea.

Deliverables: 1 Instagram Reel + 1 Instagram Story, and mirror the Reel to TikTok.

Campaign goal: Awareness -> Interest -> Trial.
`;

async function tafareeh() {
  const { profile } = await runCampaignIntelligencePipeline({
    briefText: TAFAREEH_BRIEF,
    briefTextSource: "upload",
  });
  return { profile, facts: profileToCampaignFacts(profile) };
}

function intakeRow(facts: CampaignFacts, key: string) {
  return requiredIntakeFacts(facts).rows.find((row) => row.key === key);
}

// A — audience -----------------------------------------------------------

test("A: block-form 'Target Audience:' yields prose, never the bare label", async () => {
  const { facts } = await tafareeh();
  assert.equal(facts.audience, "Egyptian tea drinkers, mainly young adults and families.");
  assert.notEqual(facts.audience, "Audience:");
  assert.doesNotMatch(facts.audience ?? "", /^audience:?$/i);
  assert.equal(intakeRow(facts, "audience")?.state, "confirmed");
});

test("A2: a label with no value never becomes the audience", () => {
  const facts = extractCampaignFacts({ rawMessage: "Target Audience:\nBrand: Acme\nMarket: Egypt" });
  assert.equal(facts.audience, undefined);
});

// B — creator categories --------------------------------------------------

test("B: a tea brief resolves canonical Food and survives to facts and Intake", async () => {
  const { profile, facts } = await tafareeh();
  assert.ok(profile.creatorCategories?.includes("Food"), "profile holds canonical Food");
  assert.ok(facts.creatorCategories?.includes("Food"), "Campaign Facts carries it");
  assert.equal(intakeRow(facts, "creatorCategories")?.state, "confirmed");
  assert.match(intakeRow(facts, "creatorCategories")?.value ?? "", /Food/);
});

test("B2: derived categories are marked inferred, never as stated fact", async () => {
  const { profile } = await tafareeh();
  assert.equal(profile.sources?.creatorCategories, "inferred");
});

// C — deliverables --------------------------------------------------------

test("C: explicit deliverables survive extraction → profile → facts → Intake", async () => {
  const { profile, facts } = await tafareeh();
  assert.ok((profile.deliverables?.length ?? 0) > 0, "profile keeps deliverables");
  assert.ok((facts.deliverables?.length ?? 0) > 0, "facts keep deliverables");
  assert.match(facts.deliverables?.join(" ") ?? "", /Instagram Reel/i);
  assert.match(facts.deliverables?.join(" ") ?? "", /Story/i);
  assert.match(facts.deliverables?.join(" ") ?? "", /TikTok/i);
  assert.equal(intakeRow(facts, "deliverables")?.state, "confirmed");
});

// D / E — KPIs ------------------------------------------------------------

test("D: a brief with no KPI produces no KPI — nothing is fabricated", async () => {
  const { facts } = await tafareeh();
  assert.deepEqual(facts.kpis ?? [], []);
  assert.equal(intakeRow(facts, "kpis")?.state, "missing");
});

test("D2: an awareness objective no longer injects a synthetic reach KPI", () => {
  const facts = extractCampaignFacts({
    rawMessage: "Brand: Acme\nObjective: build awareness and encourage trial.",
  });
  assert.deepEqual(facts.kpis ?? [], []);
  assert.equal(
    JSON.stringify(facts.kpis ?? []).includes("confirm target with brand"),
    false
  );
});

test("E: explicit KPIs are captured with their real values", () => {
  const valueFirst = extractCampaignFacts({
    rawMessage: "Brand: Acme\nKPIs: 5M reach, 3% engagement rate.",
  });
  assert.deepEqual(valueFirst.kpis, ["Reach: 5M", "Engagement rate: 3%"]);

  const labelFirst = extractCampaignFacts({
    rawMessage: "Brand: Acme\nKPIs: Reach: 5M, Engagement rate: 3%.",
  });
  assert.deepEqual(labelFirst.kpis, ["Reach: 5M", "Engagement rate: 3%"]);
});

// F / G / H / I / J — campaign intent -------------------------------------

test("F: the campaign funnel survives as intent, not as KPIs", async () => {
  const { profile, facts } = await tafareeh();
  assert.deepEqual(profile.campaignFunnel, ["Awareness", "Interest", "Trial"]);
  assert.deepEqual(facts.campaignFunnel, ["Awareness", "Interest", "Trial"]);
  assert.deepEqual(facts.kpis ?? [], [], "funnel must never become a KPI");
});

test("G: the key message survives", async () => {
  const { facts } = await tafareeh();
  assert.match(facts.keyMessage ?? "", /rich, strong tea/i);
  assert.match(facts.keyMessage ?? "", /everyday Egyptian life/i);
});

test("H: the call to action survives", async () => {
  const { facts } = await tafareeh();
  assert.match(facts.callToAction ?? "", /Try Tafareeh Tea/i);
});

test("I: tone survives with the brief's own words", async () => {
  const { facts } = await tafareeh();
  const tone = facts.toneOfVoice ?? [];
  for (const word of ["natural", "relatable", "positive", "Egyptian"]) {
    assert.ok(
      tone.some((entry) => entry.toLowerCase().includes(word.toLowerCase())),
      `tone should retain "${word}" — got ${JSON.stringify(tone)}`
    );
  }
});

test("J: content formats are not invented when the brief states none", async () => {
  const { facts } = await tafareeh();
  assert.equal(facts.contentFormats, undefined);
});

// K / L / M — provenance --------------------------------------------------

test("K: operator edits are stamped source=operator", async () => {
  const { facts } = await tafareeh();
  const edited = campaignFactsFromIntakeEdit(
    {
      product: "Tafareeh Tea",
      objective: "Build awareness and drive trial",
      budgetAmount: 3_000_000,
      budgetCurrency: "EGP",
    },
    facts
  );

  assert.equal(edited.sources.product, "operator");
  assert.equal(edited.sources.objective, "operator");
  assert.equal(edited.sources.budget, "operator");
  assert.equal(edited.budget?.amount, 3_000_000);
  assert.equal(edited.budget?.currency, "EGP");
});

test("L: untouched brief-sourced fields keep source=brief", async () => {
  const { facts } = await tafareeh();
  assert.equal(facts.sources.audience, "brief");
  assert.equal(facts.sources.brandName, "brief");

  const edited = campaignFactsFromIntakeEdit({ budgetAmount: 3_000_000, budgetCurrency: "EGP" }, facts);
  assert.equal(edited.sources.audience, "brief", "unrelated provenance is untouched");
  assert.equal(edited.sources.brandName, "brief");
  assert.equal(edited.sources.budget, "operator");
});

test("M: inferred values keep source=inferred", async () => {
  const { profile } = await tafareeh();
  assert.equal(profile.sources?.creatorCategories, "inferred");
  assert.equal(profile.sources?.clientName, "inferred");
});

test("K2: budget is absent until an operator supplies it", async () => {
  const { facts } = await tafareeh();
  assert.equal(facts.budget, undefined, "the brief states no budget");
  assert.equal(facts.sources.budget, undefined);
});

// N — demographics --------------------------------------------------------

test("N: 'young adults and families' never becomes gender or age", async () => {
  const { profile } = await tafareeh();
  const validated = profile.validatedIntelligence;
  assert.equal(validated?.audience.gender, undefined);
  assert.equal(validated?.audience.ageMin, undefined);
  assert.equal(validated?.audience.ageMax, undefined);
  assert.equal(profile.audienceDetail?.gender, undefined);
  assert.equal(profile.audienceDetail?.ageMin, undefined);
  assert.equal(profile.audienceDetail?.ageMax, undefined);
});

// Validated-intelligence boundary ----------------------------------------

test("validatedIntelligence stays Discovery-shaped — no campaign intent leaks in", async () => {
  const { profile } = await tafareeh();
  const validated = profile.validatedIntelligence as unknown as Record<string, unknown>;
  for (const field of [
    "objective",
    "kpis",
    "keyMessage",
    "callToAction",
    "campaignFunnel",
    "toneOfVoice",
    "budget",
    "deliverables",
  ]) {
    assert.equal(field in validated, false, `${field} must not be in validatedIntelligence`);
  }
});

test("canonical categories reach Discovery as preferred signals, not mandatory ones", async () => {
  const { profile } = await tafareeh();
  assert.deepEqual(profile.validatedIntelligence?.categories, ["Food", "Parenting"]);
});

// S — backward compatibility ----------------------------------------------

test("S: a legacy profile without the new fields still maps to facts", () => {
  const legacy = {
    schemaVersion: 1 as const,
    status: "saved" as const,
    brandName: "Legacy Co",
    objective: "Awareness",
    extractedAt: "2025-01-01T00:00:00.000Z",
    confidence: {},
    sources: {},
  };
  const facts = profileToCampaignFacts(legacy as never);
  assert.equal(facts.brandName, "Legacy Co");
  assert.equal(facts.creatorCategories, undefined);
  assert.equal(facts.keyMessage, undefined);
  assert.equal(facts.campaignFunnel, undefined);
  assert.equal(requiredIntakeFacts(facts).rows.length > 0, true);
});

test("S2: Intake renders a legacy facts object without re-reading the brief", () => {
  const facts: CampaignFacts = {
    brandName: "Legacy",
    rawBriefExcerpt: "A skincare and beauty launch in Egypt",
    extractedAt: "2025-01-01T00:00:00.000Z",
    confidence: {},
    sources: {},
  };
  // Pre-fix this re-derived "Beauty" from the excerpt at render time.
  assert.equal(intakeRow(facts, "creatorCategories")?.state, "missing");
});
