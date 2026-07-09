#!/usr/bin/env npx tsx
/**
 * Manual validation for Campaign Strategist Agent (Sprint 3).
 * Run: npx tsx features/ai/strategist/validate-strategist.ts
 */
import "@/lib/performance/script-env-preload";

import { createToolRegistry } from "@/features/ai/tools/registry";
import { DEFAULT_TOOLS } from "@/features/ai/tools/definitions";
import { getDefaultPromptLibrary } from "@/features/ai/prompts";
import {
  strategistAgent,
  type StrategySections,
} from "@/features/ai/strategist";
import type { AiContext, AiRequest } from "@/features/ai/types";

type Scenario = {
  name: string;
  request: AiRequest;
  context: AiContext;
  expectMode: "clarification" | "strategy";
};

const MOCK_BRAND_ID = "11111111-1111-4111-8111-111111111111";
const MOCK_CLIENT_ID = "22222222-2222-4222-8222-222222222222";
const MOCK_CAMPAIGN_ID = "33333333-3333-4333-8333-333333333333";

function createRequest(message: string): AiRequest {
  return {
    id: `req_validate_${Date.now()}`,
    message,
    intent: "strategize",
  };
}

const scenarios: Scenario[] = [
  {
    name: "BabyJoy",
    request: createRequest(
      "Build an influencer strategy for BabyJoy diaper brand awareness among new parents in Saudi Arabia. Budget SAR 250,000 on Instagram and TikTok for Q3 2026."
    ),
    context: {
      workspace: { type: "general", brandId: MOCK_BRAND_ID },
    },
    expectMode: "strategy",
  },
  {
    name: "Coca-Cola",
    request: createRequest(
      "Strategize a Coca-Cola summer engagement campaign targeting Gen Z. Budget $500k across Instagram and TikTok for 8 weeks."
    ),
    context: {
      workspace: { type: "general", brandId: MOCK_BRAND_ID, clientId: MOCK_CLIENT_ID },
      client: { id: MOCK_CLIENT_ID, name: "Coca-Cola Middle East", country: "AE" },
    },
    expectMode: "strategy",
  },
  {
    name: "L'Oréal",
    request: createRequest(
      "Create a campaign strategy for L'Oréal beauty launch focused on skincare enthusiasts. Budget EUR 180,000, timeline March 2026."
    ),
    context: {
      workspace: { type: "brand", brandId: MOCK_BRAND_ID },
    },
    expectMode: "strategy",
  },
  {
    name: "Tourism campaign",
    request: createRequest(
      "Develop a tourism promotion strategy for Visit Riyadh targeting travel-minded tourists. Budget $300k, Instagram and YouTube, 3 months."
    ),
    context: {
      workspace: { type: "general" },
    },
    expectMode: "strategy",
  },
  {
    name: "Restaurant campaign",
    request: createRequest(
      "Plan a restaurant promotion campaign for local diners and food enthusiasts. Budget $75k on Instagram for 6 weeks."
    ),
    context: {
      workspace: { type: "general" },
    },
    expectMode: "strategy",
  },
  {
    name: "Missing info (clarification)",
    request: createRequest("Help me with a campaign strategy."),
    context: { workspace: { type: "general" } },
    expectMode: "clarification",
  },
];

function logSections(sections: StrategySections | undefined): void {
  if (!sections) {
    console.log("  (no structured sections)");
    return;
  }

  const keys: (keyof StrategySections)[] = [
    "campaignSummary",
    "targetAudience",
    "creatorStrategy",
    "budgetAllocation",
    "kpis",
    "timeline",
    "risks",
    "recommendedNextActions",
  ];

  for (const key of keys) {
    console.log(`  • ${key}: ${sections[key].slice(0, 140).replace(/\n/g, " ")}…`);
  }
}

async function runScenario(scenario: Scenario): Promise<boolean> {
  console.log(`\n=== Scenario: ${scenario.name} ===`);

  const toolNames = await strategistAgent.selectTools(
    scenario.request,
    scenario.context
  );
  const prompt = await strategistAgent.buildPrompt(
    scenario.request,
    scenario.context
  );

  const result = await strategistAgent.execute({
    request: scenario.request,
    context: scenario.context,
    prompt,
    toolNames,
  });

  const mode = result.structured?.mode;
  const toolsUsed = result.toolResults
    .filter((entry) => entry.success)
    .map((entry) => entry.toolName);
  const toolErrors = result.toolResults
    .filter((entry) => !entry.success)
    .map((entry) => `${entry.toolName}: ${entry.error}`);

  console.log(`Mode: ${mode}`);
  console.log(`Tools attempted: ${toolNames.join(", ") || "(none)"}`);
  console.log(`Tools succeeded: ${toolsUsed.join(", ") || "(none)"}`);
  if (toolErrors.length > 0) {
    console.log(`Tool errors (expected without auth/DB): ${toolErrors.join(" | ")}`);
  }

  logSections(result.structured?.sections as StrategySections | undefined);

  const pass = mode === scenario.expectMode;
  console.log(pass ? "RESULT: PASS" : `RESULT: FAIL (expected ${scenario.expectMode})`);
  return pass;
}

async function main(): Promise<void> {
  getDefaultPromptLibrary();
  createToolRegistry(DEFAULT_TOOLS);

  let passed = 0;
  for (const scenario of scenarios) {
    if (await runScenario(scenario)) {
      passed += 1;
    }
  }

  console.log(`\n=== Validation summary: ${passed}/${scenarios.length} scenarios passed ===`);

  if (passed !== scenarios.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
