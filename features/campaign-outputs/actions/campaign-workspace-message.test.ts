import { strict as assert } from "node:assert";
import { test } from "node:test";

import { deserializeCampaignObject } from "@/features/campaign-intelligence";
import { isStudioMessage, findLatestStudioMessage } from "@/features/ai-workspace/components/campaign-studio-panel-utils";
import type { AiMessage } from "@/features/ai-workspace/types";

import { buildStudioMessageMetadata, buildCopilotAssistantMetadata, workspaceHref } from "./campaign-workspace-message";
import { hydrateCampaignObject } from "../hydration/hydrate";
import { seedFromQuotation } from "../hydration/seed-adapters";
import { generateCampaignOutput } from "../output-registry";
import { buildCampaignObjectFixture } from "../output-test-fixture";

function quotationFixture() {
  return {
    id: "q1",
    name: "Q",
    client_name: "Acme",
    total_revenue_egp: 2_000_000,
    estimated_reach: 8_000_000,
    estimated_engagement_rate: 4,
    items: [{ id: "i", unified_id: "c1", creator_name: "Nour", platform: "Instagram", followers: 1_500_000, deliverables: [] }],
  } as never;
}

test("a seeded studio message is recognized by the existing Studio", () => {
  const { campaignObject } = hydrateCampaignObject(seedFromQuotation(quotationFixture()));
  const message: AiMessage = {
    id: "m1",
    conversationId: "c1",
    role: "assistant",
    content: "Your campaign workspace is ready.",
    metadata: buildStudioMessageMetadata(campaignObject) as AiMessage["metadata"],
    createdAt: new Date().toISOString(),
  };
  assert.equal(isStudioMessage(message), true);
  assert.equal(findLatestStudioMessage([message])?.id, "m1");
});

test("buildCopilotAssistantMetadata always carries campaignObject for studio sync", () => {
  const withOutput = generateCampaignOutput(buildCampaignObjectFixture(), "kpi_forecast").campaignObject;
  const metadata = buildCopilotAssistantMetadata(withOutput, {
    intentKind: "generate_output",
    changed: false,
  });
  const revived = deserializeCampaignObject(metadata.campaignObject as never);
  assert.equal(metadata.workflow, true);
  assert.equal(metadata.studioSync, true);
  assert.ok(revived.meta.campaignOutputs?.kpi_forecast);
  assert.equal(revived.meta.campaignOutputs?.kpi_forecast?.status, "generated");
});

test("buildCopilotAssistantMetadata marks persisted edits with copilotEdit", () => {
  const obj = buildCampaignObjectFixture();
  const metadata = buildCopilotAssistantMetadata(obj, {
    intentKind: "update_objectives",
    changed: true,
  });
  assert.equal(metadata.copilotEdit, true);
  assert.equal(metadata.studioSync, undefined);
});

test("the seeded message preserves the Campaign Object (incl. generated outputs) through serialization", () => {
  const withOutput = generateCampaignOutput(buildCampaignObjectFixture(), "media_plan").campaignObject;
  const metadata = buildStudioMessageMetadata(withOutput);
  const revived = deserializeCampaignObject(metadata.campaignObject as never);
  // meta.campaignOutputs survives the round-trip → Outputs Center stays in sync.
  assert.ok(revived.meta.campaignOutputs?.media_plan);
  assert.equal(revived.meta.campaignOutputs?.media_plan?.status, "generated");
});

test("workspaceHref deep-links to the mounted tabs", () => {
  assert.equal(workspaceHref("abc"), "/ai/abc");
  assert.equal(workspaceHref("abc", "studio"), "/ai/abc");
  assert.equal(workspaceHref("abc", "outputs"), "/ai/abc?studioTab=outputs");
  assert.equal(workspaceHref("abc", "director"), "/ai/abc?studioTab=director");
});
