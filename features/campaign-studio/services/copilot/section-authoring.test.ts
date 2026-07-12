import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignObject } from "@/features/campaign-intelligence";
import type { StrategySectionData } from "@/features/campaign-intelligence/types/section-schemas";
import type { LlmProvider } from "@/features/ai/types/llm";

import { authorSection } from "./section-authoring";
import {
  strategyLabelsForInstruction,
  targetForStudioSection,
  studioSectionForTarget,
} from "./section-authoring-types";
import { parseStudioIntentFallback, parseToolCallIntent } from "./studio-copilot-parse";

const NOW = new Date().toISOString();

function groundedField(label: string, value: string) {
  return { label, value, grounding: { source: "AI" as const, confidence: 80, reason: "x" } };
}

function campaignObject(): CampaignObject {
  return {
    id: "co-1",
    conversationId: "conv-1",
    workflowId: "create-campaign",
    updatedAt: NOW,
    sections: {
      summary: { status: "complete", content: "summary", data: { summaryCards: { client: "e&" } } },
      audience: { status: "complete", content: "Gen Z", data: {} },
      strategy: {
        status: "complete",
        content: "own the summer sound",
        data: {
          groundedFields: [
            groundedField("Business Challenge", "Original challenge."),
            groundedField("Key Message", "Original message."),
            groundedField("Creator Strategy", "Original creator strategy."),
          ],
        } satisfies StrategySectionData,
      },
      creators: { status: "complete", content: "", data: { recommendations: { creatorIds: ["inf:a"] } } },
      budget: { status: "complete", content: { currency: "EGP", total: 1_000_000, allocations: [] }, data: {} },
      timeline: { status: "complete", content: "", data: {} },
      performance: { status: "complete", content: "", data: { campaignScores: { overall: 82 } } },
      presentation: { status: "complete", content: "", data: { campaignName: "e& Summer" } },
      operations: { status: "complete", content: "", data: {} },
    },
    meta: {
      status: "complete",
      specialistProgress: [],
      campaignFacts: {
        clientName: "e&", brandName: "e&", objective: "Activate the song",
        platforms: ["TikTok"], budget: { amount: 1_000_000, currency: "EGP" },
        durationWeeks: 6, geography: ["Egypt"], audience: "Gen Z",
        deliverables: [], kpis: [], extractedAt: NOW, confidence: {}, sources: {},
      },
    },
  } as unknown as CampaignObject;
}

function stubProvider(content: string): LlmProvider {
  return {
    identity: { id: "stub", name: "Stub" },
    complete: async () => ({ content, model: "stub", providerId: "stub" }),
  };
}

test("target mapping resolves studio cards to authoring targets and back", () => {
  assert.equal(targetForStudioSection("executive-strategy"), "strategy");
  assert.equal(targetForStudioSection("executive-summary"), "executive_summary");
  assert.equal(targetForStudioSection("unknown-card"), undefined);
  assert.equal(studioSectionForTarget("strategy"), "executive-strategy");
});

test("strategyLabelsForInstruction targets the business case fields", () => {
  assert.deepEqual(strategyLabelsForInstruction("strengthen the business case"), [
    "Business Challenge",
    "Competitive Advantage",
  ]);
  assert.ok(strategyLabelsForInstruction("rewrite the strategy").length > 5);
});

test("authoring the strategy rewrites only strategy fields and preserves every other section", async () => {
  const obj = campaignObject();
  const provider = stubProvider(
    JSON.stringify({
      "Business Challenge": "A sharper, more premium challenge framing.",
      "Key Message": "A bolder key message.",
      "Creator Strategy": "A refined creator strategy.",
    })
  );

  const result = await authorSection(provider, obj, {
    target: "strategy",
    instruction: "make it more premium",
    tone: "premium",
  });

  assert.ok(result.change);
  assert.equal(result.section, "executive-strategy");
  const nextStrategy = result.campaignObject.sections.strategy.data as StrategySectionData;
  assert.match(nextStrategy.groundedFields![0]!.value, /premium challenge/);

  // Every other section is the SAME reference — nothing else regenerated.
  assert.equal(result.campaignObject.sections.budget, obj.sections.budget);
  assert.equal(result.campaignObject.sections.creators, obj.sections.creators);
  assert.equal(result.campaignObject.sections.performance, obj.sections.performance);
  assert.equal(result.campaignObject.sections.timeline, obj.sections.timeline);
});

test("authoring the executive summary patches only presentation.executiveSummary", async () => {
  const obj = campaignObject();
  const provider = stubProvider(
    JSON.stringify({
      summary: "A crisp, CMO-ready executive summary.",
      recommendedActions: ["Approve the slate", "Lock the budget", "Kick off production"],
    })
  );

  const result = await authorSection(provider, obj, {
    target: "executive_summary",
    instruction: "make it CMO-ready",
    tone: "executive",
  });

  assert.ok(result.change);
  const pres = result.campaignObject.sections.presentation.data as {
    executiveSummary: { summary: string; recommendedActions: string[] };
    campaignName: string;
  };
  assert.match(pres.executiveSummary.summary, /CMO-ready/);
  assert.equal(pres.executiveSummary.recommendedActions.length, 3);
  // Existing presentation data preserved.
  assert.equal(pres.campaignName, "e& Summer");
  assert.equal(result.campaignObject.sections.strategy, obj.sections.strategy);
});

test("authoring is a no-op when the model returns unusable content", async () => {
  const obj = campaignObject();
  const result = await authorSection(stubProvider("not json"), obj, {
    target: "strategy",
    instruction: "rewrite it",
  });
  assert.equal(result.change, null);
  assert.equal(result.campaignObject, obj);
});

test("fallback parser routes authoring phrasings with tone + target", () => {
  const premium = parseStudioIntentFallback("make the strategy more premium");
  assert.equal(premium.kind, "author_section");
  if (premium.kind === "author_section") {
    assert.equal(premium.target, "strategy");
    assert.equal(premium.tone, "premium");
  }

  const exec = parseStudioIntentFallback("rewrite the executive summary for a CMO");
  assert.equal(exec.kind === "author_section" ? exec.target : null, "executive_summary");

  const biz = parseStudioIntentFallback("strengthen the business case");
  assert.equal(biz.kind === "author_section" ? biz.target : null, "strategy");

  const thisSection = parseStudioIntentFallback("expand this section");
  assert.equal(thisSection.kind, "author_section");
  assert.equal(thisSection.kind === "author_section" ? thisSection.target : "x", undefined);
});

test("tool call maps author_section with target + tone", () => {
  const intent = parseToolCallIntent({
    id: "1",
    name: "author_section",
    arguments: JSON.stringify({ target: "strategy", instruction: "make it youthful", tone: "youth-focused" }),
  });
  assert.equal(intent?.kind, "author_section");
  if (intent?.kind === "author_section") {
    assert.equal(intent.target, "strategy");
    assert.equal(intent.tone, "youth-focused");
  }
});
