import assert from "node:assert/strict";

import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import { createEmptyCampaignObject } from "@/features/campaign-intelligence/services/section-updaters";
import { enrichCampaignObjectWithStudioData } from "@/features/campaign-intelligence/services/studio-section-data-builders";
import type { CampaignObject } from "@/features/campaign-intelligence/types/campaign-object";
import {
  estimateSlateReach,
  type SlateCreatorInput,
} from "../services/campaign-render-model";
import {
  resolveCampaignObjectDurationWeeks,
  resolveCampaignSummary,
  resolveCreativeConcepts,
  resolveCreatorMix,
  resolveExecutiveSummaryData,
  resolveTimelineData,
} from "../services/section-data-resolver";
import { buildCampaignProposalModel } from "./campaign-proposal-model";
import {
  buildCampaignProposalDocumentHtml,
  buildCampaignProposalDocumentHtmlFromModel,
} from "./campaign-proposal-document";
import { buildProposalSlides } from "./campaign-proposal-pptx";

/**
 * Regression suite for the Campaign Intelligence consistency remediation:
 * Studio, Presentation, PDF, and PowerPoint must render identical campaign
 * facts from the Campaign Object, with no demo templates, hardcoded reach
 * ranges, celebrity leaks, or internal AI reasoning in client exports.
 */

const FACTS: CampaignFacts = {
  clientName: "Nile Fresh",
  brandName: "Nile Fresh",
  industry: "beverage",
  campaignType: "Product launch",
  objective: "Drive awareness and trial for Nile Fresh sparkling water",
  budget: { amount: 2_000_000, currency: "EGP" },
  durationWeeks: 8,
  geography: ["Egypt"],
  audience: "Health-conscious young adults (20-35)",
  platforms: ["Instagram", "TikTok"],
  kpis: ["Engagement rate: 5%+ blended", "UGC volume: 60+ creator posts"],
  extractedAt: "2026-07-14T00:00:00.000Z",
  confidence: { budget: 95, durationWeeks: 95, kpis: 90 },
  sources: { budget: "brief", durationWeeks: "brief", kpis: "brief" },
};

// The summary narrative deliberately mentions a conflicting "10 weeks" to
// prove the facts SSOT wins on every surface.
const SUMMARY_TEXT = [
  "Brand: Nile Fresh",
  "Objective: Drive awareness and trial for Nile Fresh sparkling water",
  "Budget: EGP 2,000,000",
  "Audience: Health-conscious young adults (20-35) in Egypt",
  "An early beverage planning note mentioned 10 weeks before the brief confirmed the final duration.",
].join("\n");

const STRATEGY_TEXT =
  "Creator-led launch strategy for Nile Fresh focused on authentic trial moments across Instagram and TikTok.";

const VENDORS: SlateCreatorInput[] = [
  { displayName: "Laila Hassan", handle: "@laila", platform: "instagram", followers: 800_000, engagementRate: 0.045 },
  { displayName: "Omar Fit", handle: "@omarfit", platform: "tiktok", followers: 450_000, engagementRate: 0.06 },
  { displayName: "Sara Says", handle: "@sarasays", platform: "instagram", followers: 120_000, engagementRate: 0.052 },
];

/** Strings that must never appear in a client deliverable. */
const BANNED_EXPORT_TOKENS = [
  "TBD",
  "Verification required",
  "verification pending",
  "CampaignFacts",
  "SSOT",
  "Brand Client",
  "historical campaigns",
  "BabyJoy",
  "Adidas",
  "prepared by Thinkway AI",
  "run discovery",
  "Lorem",
  "placeholder",
];

/** Retired industry demo-template artifacts that must never render anywhere. */
const BANNED_TEMPLATE_ARTIFACTS = [
  "Timeless Heritage",
  "Real Mom Moments",
  "Street to Stadium",
  "Ancient Wonders Reimagined",
  "Smart Money Moves",
  "Brand Story",
  "2.5M–4M qualified impressions",
  "5M–12M cross-platform views",
  "3M–6M parents reached",
  "8M–15M campaign impressions",
  "1.5M–3M qualified reach",
  "2M–5M estimated reach",
];

function buildFixtureCampaign(): CampaignObject {
  const object = createEmptyCampaignObject({
    id: "consistency-test",
    conversationId: "conv-1",
    workflowId: "create-campaign",
  });
  object.meta.status = "complete";
  object.meta.campaignFacts = FACTS;
  object.sections.summary = { content: SUMMARY_TEXT, status: "complete" };
  object.sections.strategy = { content: STRATEGY_TEXT, status: "complete" };
  return enrichCampaignObjectWithStudioData(object);
}

function testDurationSingleAuthority(campaign: CampaignObject) {
  assert.equal(resolveCampaignObjectDurationWeeks(campaign), 8, "canonical duration must come from facts");

  const summary = resolveCampaignSummary(campaign);
  assert.equal(summary?.duration, "8 weeks", "summary card duration must match facts");

  const timeline = resolveTimelineData(campaign);
  assert.equal(timeline?.durationWeeks, 8, "timeline duration must match facts");

  const executive = resolveExecutiveSummaryData(campaign);
  assert.ok(
    executive?.keyDecisions.some((d) => d.includes("8 weeks")),
    "executive summary must state the facts duration"
  );
  assert.ok(
    !executive?.summary.includes("10-week") && !executive?.summary.includes("10 weeks"),
    "executive summary must not pick up the conflicting narrative duration"
  );

  const contentPlan = (campaign.sections.timeline.data as { contentPlan?: Array<{ postingDate: string }> })
    ?.contentPlan;
  for (const item of contentPlan ?? []) {
    const week = parseInt(item.postingDate.replace(/\D/g, ""), 10);
    assert.ok(week >= 1 && week <= 8, `content plan week ${week} must fit the 8-week duration`);
  }
  console.log("✓ duration comes from one authoritative field on every surface");
}

function testCreativeConceptsAreCampaignSpecific(campaign: CampaignObject) {
  const concepts = resolveCreativeConcepts(campaign);
  assert.ok(concepts.length >= 3, "campaign must render proposed creative concepts");
  for (const concept of concepts) {
    assert.ok(
      concept.name.includes("Nile Fresh"),
      `concept "${concept.name}" must reference the actual campaign brand`
    );
  }
  const conceptBlob = JSON.stringify(concepts);
  for (const artifact of BANNED_TEMPLATE_ARTIFACTS) {
    assert.ok(!conceptBlob.includes(artifact), `template artifact leaked into concepts: ${artifact}`);
  }
  console.log("✓ creative concepts render the actual campaign, not demo templates");
}

function testReachFromSlate(campaign: CampaignObject) {
  const reach = estimateSlateReach(VENDORS);
  assert.ok(reach, "reach must be computable from the fixture slate");
  assert.equal(reach.formattedRange, "297K–547K estimated reach");

  const summary = resolveCampaignSummary(campaign);
  assert.equal(summary?.estimatedReach, undefined, "no templated reach on summary cards");

  const model = buildCampaignProposalModel(campaign, VENDORS, { dateLabel: "14 July 2026" });
  const overview = model.sections.find((s) => s.id === "overview");
  assert.ok(overview && overview.kind === "keyValue");
  const reachItem = overview.items.find((i) => i.label === "Estimated Reach");
  assert.equal(reachItem?.value, reach.formattedRange, "export reach must equal the slate model");

  const reachSection = model.sections.find((s) => s.id === "reach");
  assert.ok(reachSection && reachSection.kind === "text");
  assert.ok(
    (reachSection.bullets ?? []).some((b) => b.includes("combined follower base")),
    "export must document reach assumptions"
  );

  const emptyModel = buildCampaignProposalModel(campaign, [], { dateLabel: "14 July 2026" });
  const emptyReach = emptyModel.sections.find((s) => s.id === "reach");
  assert.ok(emptyReach && emptyReach.kind === "text");
  assert.ok(
    emptyReach.paragraphs[0].includes("once the creator slate is confirmed"),
    "without a slate the export must state the estimate is pending, not fabricate a range"
  );
  console.log("✓ reach is calculated from the selected creator slate with documented assumptions");
}

function testCelebrityGating(campaign: CampaignObject) {
  const mix = resolveCreatorMix(campaign);
  assert.ok(mix.length > 0, "creator mix must resolve");
  assert.ok(mix.every((t) => t.tier !== "Celebrity"), "no Celebrity tier without selection");
  assert.equal(mix.reduce((sum, t) => sum + t.percent, 0), 100, "mix must renormalize to 100%");

  const model = buildCampaignProposalModel(campaign, VENDORS, { dateLabel: "14 July 2026" });
  const html = buildCampaignProposalDocumentHtmlFromModel(model);
  const slides = JSON.stringify(buildProposalSlides(model));
  assert.ok(!/celebrit/i.test(html), "PDF must not reference celebrity creators");
  assert.ok(!/celebrit/i.test(slides), "PPTX must not reference celebrity creators");
  const summary = resolveCampaignSummary(campaign);
  assert.ok(!/celebrit/i.test(summary?.creatorMix ?? ""), "summary card must not reference celebrity");

  // Legacy luxury campaign without facts: industry template proposes a
  // Celebrity tier — the gate must remove it unless the brief asks for one.
  const luxury = createEmptyCampaignObject({ id: "lux-test" });
  luxury.sections.summary = {
    content: "Brand: Aurum\nRolex-style luxury watch launch in UAE over 6 weeks",
    status: "complete",
  };
  luxury.sections.strategy = { content: "Prestige-led creator strategy.", status: "complete" };
  const enrichedLuxury = enrichCampaignObjectWithStudioData(luxury);
  const luxuryMix = resolveCreatorMix(enrichedLuxury);
  assert.ok(
    luxuryMix.every((t) => t.tier !== "Celebrity"),
    "luxury template Celebrity tier must be gated when the brief never requests one"
  );

  const luxuryWithAsk = createEmptyCampaignObject({ id: "lux-ask-test" });
  luxuryWithAsk.sections.summary = {
    content: "Brand: Aurum\nLuxury watch launch with a celebrity brand ambassador over 6 weeks",
    status: "complete",
  };
  luxuryWithAsk.sections.strategy = { content: "Prestige-led creator strategy.", status: "complete" };
  const enrichedAsk = enrichCampaignObjectWithStudioData(luxuryWithAsk);
  const askMix = resolveCreatorMix(enrichedAsk);
  assert.ok(
    askMix.some((t) => t.tier === "Celebrity"),
    "Celebrity tier allowed when the brief explicitly requests one"
  );
  console.log("✓ celebrity references are gated on actual selection/brief request");
}

function testExportsAreClientReady(campaign: CampaignObject) {
  const model = buildCampaignProposalModel(campaign, VENDORS, { dateLabel: "14 July 2026" });
  const html = buildCampaignProposalDocumentHtmlFromModel(model);
  const slides = buildProposalSlides(model);
  const slidesBlob = JSON.stringify(slides);

  for (const token of [...BANNED_EXPORT_TOKENS, ...BANNED_TEMPLATE_ARTIFACTS]) {
    assert.ok(!html.toLowerCase().includes(token.toLowerCase()), `banned token in PDF: ${token}`);
    assert.ok(!slidesBlob.toLowerCase().includes(token.toLowerCase()), `banned token in PPTX: ${token}`);
  }

  assert.ok(html.includes("Nile Fresh"), "PDF must carry the actual brand");
  assert.ok(html.includes("2,000,000"), "PDF must carry the facts budget");
  assert.ok(html.includes("8 weeks"), "PDF must carry the facts duration");
  console.log("✓ exports contain no internal AI reasoning, placeholders, or demo content");
}

function testKpiFrameworkPage(campaign: CampaignObject) {
  const model = buildCampaignProposalModel(campaign, VENDORS, { dateLabel: "14 July 2026" });
  const kpiSection = model.sections.find((s) => s.id === "kpi-framework");
  assert.ok(kpiSection && kpiSection.kind === "table", "exports must include a KPI framework page");
  assert.deepEqual(kpiSection.headers, ["KPI", "Target", "Why It Matters", "How It Is Measured"]);
  assert.ok(kpiSection.rows.length >= 2, "framework must include the campaign's KPIs");
  const metrics = kpiSection.rows.map((row) => row[0].toLowerCase());
  assert.ok(metrics.some((m) => m.includes("engagement")), "brief KPI (engagement) must be present");
  assert.ok(metrics.some((m) => m.includes("ugc")), "brief KPI (UGC volume) must be present");
  console.log("✓ Success Metrics replaced with a client-ready KPI framework");
}

function testPdfAndPptxRenderIdenticalFacts(campaign: CampaignObject) {
  const model = buildCampaignProposalModel(campaign, VENDORS, { dateLabel: "14 July 2026" });
  const html = buildCampaignProposalDocumentHtmlFromModel(model);
  const slidesBlob = JSON.stringify(buildProposalSlides(model));
  const concepts = resolveCreativeConcepts(campaign);
  const reach = estimateSlateReach(VENDORS)!;

  const sharedFacts = [
    "Nile Fresh",
    "8 weeks",
    "2,000,000",
    reach.formattedRange,
    ...concepts.map((c) => c.name),
    ...VENDORS.map((v) => v.displayName!),
  ];
  for (const fact of sharedFacts) {
    assert.ok(html.includes(fact), `fact missing from PDF: ${fact}`);
    assert.ok(slidesBlob.includes(fact), `fact missing from PPTX: ${fact}`);
  }

  // Wrapper builds the same document from the Campaign Object directly.
  const wrapperHtml = buildCampaignProposalDocumentHtml(campaign, VENDORS);
  assert.ok(wrapperHtml.includes("Nile Fresh Campaign Proposal"));
  console.log("✓ PDF and PPTX render identical campaign facts from one model");
}

const campaign = buildFixtureCampaign();
testDurationSingleAuthority(campaign);
testCreativeConceptsAreCampaignSpecific(campaign);
testReachFromSlate(campaign);
testCelebrityGating(campaign);
testExportsAreClientReady(campaign);
testKpiFrameworkPage(campaign);
testPdfAndPptxRenderIdenticalFacts(campaign);

console.log("\nAll campaign proposal consistency tests passed.");
