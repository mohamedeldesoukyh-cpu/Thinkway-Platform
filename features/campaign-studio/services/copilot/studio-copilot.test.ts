import assert from "node:assert/strict";
import test from "node:test";

import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";

import {
  buildCampaignContextDigest,
  buildChangeSummary,
  planRemovalChanges,
  renderChangeSummary,
  renderDigestForPrompt,
  resolveCampaignSlate,
  resolveRemovalTargets,
} from "./studio-copilot-intents";
import { parseStudioIntentFallback, parseToolCallIntent } from "./studio-copilot-parse";

const NOW = new Date().toISOString();

function reasoning(creatorId: string, displayName: string, tier: string) {
  return {
    creatorId,
    displayName,
    whySelected: "strong fit",
    expectedRole: tier,
    audienceMatch: "",
    risk: "",
    alternative: "",
    confidence: 1,
    evidence: "",
    tradeoff: "",
  };
}

function campaignObject(creators: CreatorsSectionData["recommendations"]): CampaignObject {
  return {
    id: "co-1",
    conversationId: "conv-1",
    workflowId: "create-campaign",
    updatedAt: NOW,
    sections: {
      creators: { status: "complete", content: "", data: { recommendations: creators } },
      presentation: { status: "complete", content: "", data: { campaignName: "e& Summer Sound" } },
      strategy: { status: "complete", content: "Own the summer sound on TikTok." },
      performance: { status: "complete", content: "", data: { campaignScores: { overall: 82 } } },
    },
    meta: {
      status: "complete",
      specialistProgress: [],
      campaignFacts: {
        clientName: "e&",
        brandName: "e&",
        objective: "Activate the campaign song on TikTok",
        budget: { amount: 1_000_000, currency: "EGP" },
        durationWeeks: 6,
        platforms: ["TikTok"],
        geography: ["Egypt"],
        audience: "Gen Z",
        deliverables: ["Influencer list", "Content concepts"],
        kpis: ["8M reach"],
        extractedAt: NOW,
        confidence: {},
        sources: {},
      },
    },
  } as unknown as CampaignObject;
}

const SLATE = {
  creatorIds: ["inf:a", "inf:b", "inf:c", "inf:d"],
  selectedReasoning: [
    reasoning("inf:a", "Salma Dance", "Celebrity"),
    reasoning("inf:b", "Omar Laughs", "Macro"),
    reasoning("inf:c", "Nour Beats", "Celebrity"),
    reasoning("inf:d", "Yara Style", "Micro"),
  ],
};

test("digest carries campaign identity, slate, and tier counts — never empty", () => {
  const digest = buildCampaignContextDigest(campaignObject(SLATE));
  assert.equal(digest.campaignName, "e& Summer Sound");
  assert.equal(digest.client, "e&");
  assert.deepEqual(digest.platforms, ["TikTok"]);
  assert.equal(digest.budget?.amount, 1_000_000);
  assert.equal(digest.slate.length, 4);
  assert.equal(digest.tierCounts["Celebrity"], 2);
  assert.equal(digest.overallScore, 82);

  const prompt = renderDigestForPrompt(digest);
  assert.match(prompt, /Salma Dance \(Celebrity\)/);
  assert.match(prompt, /Budget: 1,000,000 EGP/);
});

test("resolveRemovalTargets matches a whole tier (celebrities)", () => {
  const { targets } = resolveRemovalTargets(campaignObject(SLATE), { tier: "Celebrity" });
  assert.deepEqual(
    targets.map((t) => t.displayName).sort(),
    ["Nour Beats", "Salma Dance"]
  );
});

test("resolveRemovalTargets matches specific names and reports unmatched", () => {
  const { targets, unmatchedNames } = resolveRemovalTargets(campaignObject(SLATE), {
    names: ["Omar Laughs", "Nonexistent Creator"],
  });
  assert.deepEqual(targets.map((t) => t.creatorId), ["inf:b"]);
  assert.deepEqual(unmatchedNames, ["Nonexistent Creator"]);
});

test("planRemovalChanges produces one remove_creator change per target", () => {
  const slate = resolveCampaignSlate(campaignObject(SLATE));
  const changes = planRemovalChanges(slate.slice(0, 2));
  assert.equal(changes.length, 2);
  assert.ok(changes.every((c) => c.kind === "remove_creator"));
});

test("fallback parser routes remove/undo/question/clarify correctly", () => {
  assert.equal(
    parseStudioIntentFallback("remove celebrities as the client will handle it").kind,
    "remove_creators"
  );
  const removeIntent = parseStudioIntentFallback("remove the celebrities");
  assert.equal(removeIntent.kind === "remove_creators" ? removeIntent.tier : null, "Celebrity");

  assert.equal(parseStudioIntentFallback("undo the last change").kind, "undo_last_change");
  assert.equal(parseStudioIntentFallback("why did you choose these creators?").kind, "answer_question");
  assert.equal(parseStudioIntentFallback("make it better somehow").kind, "clarify");
});

test("fallback parser extracts quoted names and handles", () => {
  const intent = parseStudioIntentFallback('remove "Omar Laughs" and @yarastyle');
  assert.equal(intent.kind, "remove_creators");
  if (intent.kind === "remove_creators") {
    assert.deepEqual(intent.names, ["Omar Laughs", "yarastyle"]);
  }
});

test("parseToolCallIntent maps model tool calls to typed intents", () => {
  const intent = parseToolCallIntent({
    id: "c1",
    name: "remove_creators",
    arguments: JSON.stringify({ tier: "Celebrity", reason: "client handles them" }),
  });
  assert.equal(intent?.kind, "remove_creators");
  if (intent?.kind === "remove_creators") assert.equal(intent.tier, "Celebrity");

  const bad = parseToolCallIntent({ id: "c2", name: "answer_question", arguments: "not json" });
  assert.equal(bad?.kind, "answer_question");
});

test("fallback parser reads budget with magnitude + currency", () => {
  const intent = parseStudioIntentFallback("increase the budget to EGP 2M");
  assert.equal(intent.kind, "update_budget");
  if (intent.kind === "update_budget") {
    assert.equal(intent.amount, 2_000_000);
    assert.equal(intent.currency, "EGP");
  }

  const plain = parseStudioIntentFallback("set the budget to 500,000");
  assert.equal(plain.kind === "update_budget" ? plain.amount : null, 500_000);
});

test("fallback parser reads duration in digits and words", () => {
  assert.equal(
    (parseStudioIntentFallback("reduce the campaign duration to four weeks") as { durationWeeks?: number })
      .durationWeeks,
    4
  );
  assert.equal(
    (parseStudioIntentFallback("make the timeline 8 weeks") as { durationWeeks?: number })
      .durationWeeks,
    8
  );
});

test("fallback parser routes slate edits: add / replace / location-remove", () => {
  const add = parseStudioIntentFallback("add parenting creators");
  assert.equal(add.kind, "add_creators");
  if (add.kind === "add_creators") assert.match(add.category ?? "", /parenting/i);

  const addTier = parseStudioIntentFallback("add more micro creators");
  assert.equal(addTier.kind === "add_creators" ? addTier.tier : null, "Micro");

  const replace = parseStudioIntentFallback("replace macro creators with micro creators");
  assert.equal(replace.kind, "replace_creators");
  if (replace.kind === "replace_creators") {
    assert.equal(replace.fromTier, "Macro");
    assert.equal(replace.toTier, "Micro");
  }

  const loc = parseStudioIntentFallback("remove creators from Cairo");
  assert.equal(loc.kind, "remove_creators");
  if (loc.kind === "remove_creators") assert.equal(loc.city, "Cairo");
});

test("tool call maps add_creators and replace_creators intents", () => {
  const add = parseToolCallIntent({
    id: "1",
    name: "add_creators",
    arguments: JSON.stringify({ category: "parenting", count: 4 }),
  });
  assert.equal(add?.kind === "add_creators" ? add.category : null, "parenting");

  const rep = parseToolCallIntent({
    id: "2",
    name: "replace_creators",
    arguments: JSON.stringify({ fromTier: "Macro", toTier: "Micro", higherEngagement: true }),
  });
  assert.equal(rep?.kind === "replace_creators" ? rep.higherEngagement : null, true);
});

test("tool calls map to facts intents (budget, timeline, platforms)", () => {
  const budget = parseToolCallIntent({
    id: "1",
    name: "update_budget",
    arguments: JSON.stringify({ amount: 2000000, currency: "EGP" }),
  });
  assert.equal(budget?.kind === "update_budget" ? budget.amount : null, 2_000_000);

  const platforms = parseToolCallIntent({
    id: "2",
    name: "update_platforms",
    arguments: JSON.stringify({ platforms: ["TikTok", "Instagram"] }),
  });
  assert.deepEqual(
    platforms?.kind === "update_platforms" ? platforms.platforms : null,
    ["TikTok", "Instagram"]
  );
});

test("change summary renders transparent before/after block", () => {
  const summary = buildChangeSummary({
    headline: "Campaign updated successfully.",
    changes: ["Removed all Celebrity creators."],
    scoreBefore: 82,
    scoresAfter: {
      overall: 86,
      brandFit: 0,
      audienceMatch: 0,
      reach: 0,
      engagementForecast: 0,
      budgetEfficiency: 0,
      contentCoverage: 0,
      risk: 0,
      basis: [],
      updatedAt: NOW,
    },
    creatorsRemoved: 2,
  });
  const md = renderChangeSummary(summary);
  assert.match(md, /✅ Campaign updated successfully\./);
  assert.match(md, /Overall Campaign Score: 82 → 86/);
  assert.match(md, /Creators removed: 2/);
});
