import assert from "node:assert/strict";
import { test } from "node:test";

import { createEmptyCampaignObject } from "@/features/campaign-intelligence/services/section-updaters";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";
import type { AiActionCard, AiMessage } from "@/features/ai-workspace/types";

import { buildCampaignStudioState } from "../hooks/use-campaign-studio";
import { resolveStudioDiscoverySufficiency } from "./studio-discovery-sufficiency";
import {
  creatorSearchActionCardsFromMessages,
  ingestSearchPoolIfNeeded,
  mergeActionCards,
  searchPoolFromActionCards,
} from "./studio-search-pool";

function searchCard(overrides?: Partial<AiActionCard>): AiActionCard {
  return {
    id: "creator_search_1",
    type: "creator_search",
    title: "Creator matches",
    description: "82 match(es). Review details or add to shortlist.",
    payload: {
      creators: [
        {
          id: "inf:rooh",
          handle: "rooh_hassann",
          displayName: "rooh_hassann",
          platform: "instagram",
          categories: ["Sports"],
        },
        {
          id: "inf:zeina",
          handle: "zeina_sherif",
          displayName: "Zeina Sherif",
          platform: "instagram",
          categories: ["Travel"],
        },
      ],
      creatorIds: ["inf:rooh", "inf:zeina"],
      total: 82,
    },
    requiresApproval: false,
    status: "executed",
    ...overrides,
  };
}

function emptyObject() {
  const object = createEmptyCampaignObject({
    id: "co-arab-bank",
    conversationId: "conv-1",
    workflowId: "create-campaign",
  });
  object.meta.status = "complete";
  object.meta.factsConfirmedAt = "2026-08-16T00:00:00.000Z";
  object.meta.campaignFacts = {
    extractedAt: "2026-08-16T00:00:00.000Z",
    confidence: {},
    sources: {},
    objective: "Acquisition",
    geography: ["Egypt"],
    platforms: ["Instagram", "TikTok", "Facebook"],
    budget: { amount: 3_000_000, currency: "EGP" },
    durationWeeks: 4,
  };
  object.sections.creators.data = {
    lastDiscoveryAt: "2026-08-16T12:00:00.000Z",
    slateProposalStatus: {
      status: "blocked",
      reason: "no_discovery_results",
      message: "No discovery results",
      updatedAt: "2026-08-16T12:00:00.000Z",
    },
  } satisfies CreatorsSectionData as unknown as Record<string, unknown>;
  return object;
}

test("searchPoolFromActionCards reads Creator Match IDs and the reported total", () => {
  const pool = searchPoolFromActionCards([searchCard()]);
  assert.deepEqual(pool.creatorIds, ["inf:rooh", "inf:zeina"]);
  assert.equal(pool.total, 82);
  assert.equal(pool.creators[0]?.handle, "rooh_hassann");
});

test("ingestSearchPoolIfNeeded copies Creator Match IDs onto empty discovery", () => {
  const result = ingestSearchPoolIfNeeded(emptyObject(), [searchCard()]);
  assert.equal(result.ingested, true);
  const data = result.campaignObject.sections.creators.data as CreatorsSectionData;
  assert.deepEqual(data.discovery?.creatorIds, ["inf:rooh", "inf:zeina"]);
  assert.equal(data.discovery?.total, 82);
  assert.equal(data.slateProposalStatus, undefined);
});

test("ingestSearchPoolIfNeeded does not replace an existing discovery pool", () => {
  const object = emptyObject();
  object.sections.creators.data = {
    discovery: { creatorIds: ["inf:keep"], total: 1 },
  } satisfies CreatorsSectionData as unknown as Record<string, unknown>;
  const result = ingestSearchPoolIfNeeded(object, [searchCard()]);
  assert.equal(result.ingested, false);
  const data = result.campaignObject.sections.creators.data as CreatorsSectionData;
  assert.deepEqual(data.discovery?.creatorIds, ["inf:keep"]);
});

test("Studio sufficiency is not no_inventory after ingesting Creator Match", () => {
  const ingested = ingestSearchPoolIfNeeded(emptyObject(), [searchCard()]).campaignObject;
  const before = resolveStudioDiscoverySufficiency(emptyObject(), false);
  const after = resolveStudioDiscoverySufficiency(ingested, false);
  assert.equal(before.state, "no_inventory");
  assert.equal(before.inventoryCount, 0);
  assert.notEqual(after.state, "no_inventory");
  assert.equal(after.inventoryCount, 82);
  assert.ok(after.qualifiedCount >= 2);
});

test("buildCampaignStudioState ingests action-card matches into the campaign object", () => {
  const studio = buildCampaignStudioState({
    workflowId: "create-campaign",
    campaignObject: emptyObject(),
    actionCards: [searchCard()],
  });
  assert.ok(studio?.campaignObject);
  const data = studio.campaignObject.sections.creators.data as CreatorsSectionData;
  assert.deepEqual(data.discovery?.creatorIds, ["inf:rooh", "inf:zeina"]);
  const sufficiency = resolveStudioDiscoverySufficiency(studio.campaignObject, false);
  assert.notEqual(sufficiency.state, "no_inventory");
});

test("creatorSearchActionCardsFromMessages recovers cards from earlier Copilot turns", () => {
  const messages = [
    {
      id: "m1",
      conversationId: "c1",
      role: "assistant",
      content: "",
      createdAt: "2026-08-16T12:00:00.000Z",
      metadata: { actionCards: [searchCard()] },
    },
    {
      id: "m2",
      conversationId: "c1",
      role: "assistant",
      content: "Done.",
      createdAt: "2026-08-16T12:01:00.000Z",
      metadata: { actionCards: [] },
    },
  ] as AiMessage[];
  const cards = creatorSearchActionCardsFromMessages(messages);
  assert.equal(cards.length, 1);
  assert.equal(mergeActionCards(cards, []).length, 1);
});
