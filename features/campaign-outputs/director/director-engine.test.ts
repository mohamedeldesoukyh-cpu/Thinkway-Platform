import { strict as assert } from "node:assert";
import { test } from "node:test";

import { reviewCampaign } from "./director-engine";
import { runReviewCampaign } from "./director-copilot";
import { buildCampaignObjectFixture } from "../output-test-fixture";
import { parseStudioIntentFallback } from "@/features/campaign-studio/services/copilot/studio-copilot-parse";

test("every recommendation is grounded, reasoned, and confidence-rated", () => {
  const { recommendations } = reviewCampaign(buildCampaignObjectFixture());
  assert.ok(recommendations.length > 0);
  for (const rec of recommendations) {
    assert.ok(rec.title && rec.recommendation);
    assert.ok(rec.reason.length > 0);
    assert.ok(["High", "Medium", "Low"].includes(rec.confidence));
    assert.ok(rec.evidence.length > 0, `evidence for ${rec.id}`);
  }
  // Sorted by confidence (High first).
  const order = { High: 0, Medium: 1, Low: 2 } as const;
  for (let i = 1; i < recommendations.length; i += 1) {
    assert.ok(order[recommendations[i - 1]!.confidence] <= order[recommendations[i]!.confidence]);
  }
});

test("recommends leading with the highest-tier creator", () => {
  const { recommendations } = reviewCampaign(buildCampaignObjectFixture());
  const lead = recommendations.find((r) => r.id === "sequencing-lead");
  assert.ok(lead);
  assert.match(lead!.title, /Nour Star/); // the Celebrity in the fixture
});

test("recommends leading with the higher-engagement platform, with an applicable command", () => {
  // Fixture platforms are ["Instagram","TikTok"] — TikTok has the higher ER benchmark.
  const { recommendations } = reviewCampaign(buildCampaignObjectFixture());
  const platform = recommendations.find((r) => r.id === "platform-priority");
  assert.ok(platform);
  assert.match(platform!.title, /TikTok/);
  assert.ok(platform!.proposedCommand && /TikTok/.test(platform!.proposedCommand));
});

test("flags creator concentration and proposes an applicable diversity command", () => {
  const { recommendations } = reviewCampaign(
    buildCampaignObjectFixture({
      creators: [
        { id: "a", name: "A", tier: "Macro" },
        { id: "b", name: "B", tier: "Macro" },
        { id: "c", name: "C", tier: "Macro" },
      ],
    })
  );
  const diversity = recommendations.find((r) => r.id === "creator-diversity");
  assert.ok(diversity);
  assert.equal(diversity!.confidence, "High");
  // The proposed command routes through the existing Copilot mutation engine.
  const intent = parseStudioIntentFallback(diversity!.proposedCommand!);
  assert.equal(intent.kind, "add_creators");
});

test("recommends extending a compressed timeline, with an applicable command", () => {
  const { recommendations } = reviewCampaign(
    buildCampaignObjectFixture({
      facts: { durationWeeks: 2 },
      creators: Array.from({ length: 6 }, (_, i) => ({ id: `c${i}`, name: `C${i}`, tier: "Micro" })),
    })
  );
  const timeline = recommendations.find((r) => r.id === "timeline-extend");
  assert.ok(timeline);
  const intent = parseStudioIntentFallback(timeline!.proposedCommand!);
  assert.equal(intent.kind, "update_timeline");
});

test("flags missing critical information", () => {
  const { recommendations } = reviewCampaign(
    buildCampaignObjectFixture({ facts: { objective: undefined, budget: undefined } })
  );
  const completeness = recommendations.find((r) => r.id === "completeness");
  assert.ok(completeness);
  assert.match(completeness!.recommendation, /objective|Budget/i);
});

test("runReviewCampaign is read-only and formats reason/confidence/evidence + apply", () => {
  const obj = buildCampaignObjectFixture();
  const result = runReviewCampaign(obj);
  assert.equal(result.changed, false);
  assert.equal(result.campaignObject, obj);
  assert.match(result.reply, /Reason:/);
  assert.match(result.reply, /Evidence:/);
  assert.match(result.reply, /\[High\]|\[Medium\]|\[Low\]/);
});

test("Director requests route through the Copilot fallback parser", () => {
  for (const msg of [
    "Review the campaign.",
    "What do you recommend?",
    "How can I improve the campaign?",
    "Recommend creator publishing order.",
  ]) {
    assert.equal(parseStudioIntentFallback(msg).kind, "review_campaign", msg);
  }
});
