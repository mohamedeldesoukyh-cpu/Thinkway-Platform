import assert from "node:assert/strict";
import test from "node:test";

import { emptyCampaignObject } from "@/features/campaign-outputs/hydration/hydrate";
import { buildCampaignObjectFixture } from "@/features/campaign-outputs/output-test-fixture";

import { projectStudioCampaignHistoryItem } from "./studio-campaign-history";

test("history item uses Campaign Facts name, client, brand, budget, and Intake step", () => {
  const campaignObject = emptyCampaignObject({
    id: "co-1",
    conversationId: "conv-1",
    now: "2026-08-19T10:00:00.000Z",
  });
  campaignObject.meta.campaignFacts = {
    clientName: "Limitless Naturals",
    brandName: "Limitless",
    product: "Gut Health Launch",
    budget: { amount: 500000, currency: "EGP" },
    extractedAt: "2026-08-19T10:00:00.000Z",
    confidence: {},
    sources: {},
  };

  const item = projectStudioCampaignHistoryItem({
    conversationId: "conv-1",
    campaignObjectId: "co-1",
    lifecycleStatus: "draft",
    updatedAt: "2026-08-19T12:00:00.000Z",
    conversationTitle: "New conversation",
    campaignObject,
  });

  assert.equal(item.name, "Gut Health Launch");
  assert.equal(item.clientName, "Limitless Naturals");
  assert.equal(item.brandName, "Limitless");
  assert.equal(item.statusLabel, "Draft");
  assert.equal(item.currentStepId, "intake");
  assert.equal(item.currentStepLabel, "Intake");
  assert.equal(item.creatorCount, 0);
  assert.equal(item.budgetLabel, "EGP 500,000");
  assert.equal(item.href, "/ai/conv-1");
});

test("history item counts recommended creators after Intake is confirmed", () => {
  const campaignObject = buildCampaignObjectFixture({
    facts: { product: "Summer launch" },
  });
  campaignObject.meta.factsConfirmedAt = "2026-01-02T00:00:00.000Z";

  const item = projectStudioCampaignHistoryItem({
    conversationId: "conv_test",
    campaignObjectId: campaignObject.id,
    lifecycleStatus: "in_review",
    updatedAt: campaignObject.updatedAt,
    conversationTitle: "ignored when facts have a product",
    campaignObject,
  });

  assert.equal(item.name, "Summer launch");
  assert.equal(item.creatorCount, 4);
  assert.equal(item.statusLabel, "In Review");
  assert.notEqual(item.currentStepId, "intake");
});

test("history item falls back to the conversation title when facts have no name", () => {
  const campaignObject = emptyCampaignObject({
    id: "co-2",
    conversationId: "conv-2",
  });
  const item = projectStudioCampaignHistoryItem({
    conversationId: "conv-2",
    campaignObjectId: "co-2",
    lifecycleStatus: "draft",
    updatedAt: campaignObject.updatedAt,
    conversationTitle: "Client workshop notes",
    campaignObject,
  });
  assert.equal(item.name, "Client workshop notes");
});
