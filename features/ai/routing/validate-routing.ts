#!/usr/bin/env npx tsx
/**
 * Validation for Sprint 4.5 Intent Intelligence & Agent Routing.
 * Run: npx tsx features/ai/routing/validate-routing.ts
 */
import "@/lib/performance/script-env-preload";

import {
  createAgentRegistry,
  createAgentRouter,
  generalAgent,
  plannerAgent,
  strategistAgent,
  scoutAgent,
  analystAgent,
} from "@/features/ai";
import type { AiContext, AiRequest } from "@/features/ai/types";

type Scenario = {
  name: string;
  request: AiRequest;
  context?: AiContext;
  expectedAgents: string[];
  allowMulti?: boolean;
};

const baseContext: AiContext = {
  workspace: { type: "general" },
};

function createRequest(
  message: string,
  intent?: AiRequest["intent"]
): AiRequest {
  return {
    id: `req_route_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    message,
    intent,
  };
}

const scenarios: Scenario[] = [
  {
    name: "Hello → General Assistant",
    request: createRequest("Hello"),
    expectedAgents: ["general"],
  },
  {
    name: "Create campaign for BabyJoy → Strategist",
    request: createRequest("Create campaign for BabyJoy"),
    expectedAgents: ["strategist"],
  },
  {
    name: "Find luxury creators → Scout",
    request: createRequest("Find luxury creators"),
    expectedAgents: ["scout"],
  },
  {
    name: "Why did engagement drop? → Analyst",
    request: createRequest("Why did engagement drop?"),
    expectedAgents: ["analyst"],
  },
  {
    name: "Plan campaign timeline → Planner",
    request: createRequest("Plan campaign timeline"),
    expectedAgents: ["planner"],
  },
  {
    name: "Build campaign then find creators → Strategist + Scout",
    request: createRequest("Build campaign then find creators"),
    expectedAgents: ["strategist", "scout"],
    allowMulti: true,
  },
  {
    name: "Explicit intent strategize → Strategist",
    request: createRequest("Help me with this", "strategize"),
    expectedAgents: ["strategist"],
  },
  {
    name: "Explicit intent scout → Scout",
    request: createRequest("Help me with this", "scout"),
    expectedAgents: ["scout"],
  },
  {
    name: "Explicit intent plan → Planner",
    request: createRequest("Help me with this", "plan"),
    expectedAgents: ["planner"],
  },
  {
    name: "Explicit intent analyze → Analyst",
    request: createRequest("Help me with this", "analyze"),
    expectedAgents: ["analyst"],
  },
  {
    name: "Explicit intent general → General Assistant",
    request: createRequest("Help me with this", "general"),
    expectedAgents: ["general"],
  },
  {
    name: "Unknown vague request → General fallback",
    request: createRequest("???"),
    expectedAgents: ["general"],
  },
  {
    name: "Launch BabyJoy product → Strategist (Create Campaign)",
    request: createRequest("Launch BabyJoy Premium Diapers in Egypt"),
    expectedAgents: ["strategist"],
  },
  {
    name: "Launch BabyJoy full brief → Strategist (Create Campaign)",
    request: createRequest(
      "Launch BabyJoy Premium Diapers in Egypt. Target mothers with babies 0–3 years. Budget EGP 2,000,000. Campaign duration 6 weeks. Objective: Awareness and UGC."
    ),
    expectedAgents: ["strategist"],
  },
  {
    name: "Find travel creators in Egypt → Scout",
    request: createRequest("Find travel creators in Egypt"),
    expectedAgents: ["scout"],
  },
  {
    name: "What can Thinkway do? → General Assistant",
    request: createRequest("What can Thinkway do?"),
    expectedAgents: ["general"],
  },
];

function formatScores(scores: Array<{ agentId: string; score: number }>): string {
  return scores.map((entry) => `${entry.agentId}=${entry.score}`).join(", ");
}

function runScenario(
  router: ReturnType<typeof createAgentRouter>,
  scenario: Scenario
): boolean {
  console.log(`\n=== ${scenario.name} ===`);

  const decision = router.route(
    scenario.request,
    scenario.context ?? baseContext
  );

  console.log(`Message: "${scenario.request.message}"`);
  if (scenario.request.intent) {
    console.log(`Explicit intent: ${scenario.request.intent}`);
  }
  console.log(`Primary intent: ${decision.analysis.primaryIntent}`);
  console.log(`Confidence: ${formatScores(decision.confidence.scores)}`);
  console.log(`Selected: [${decision.selectedAgentIds.join(", ")}]`);
  console.log(`Reason: ${decision.reason}`);

  const pass = scenario.allowMulti
    ? scenario.expectedAgents.every((agentId) =>
        decision.selectedAgentIds.includes(agentId as (typeof decision.selectedAgentIds)[number])
      ) && decision.selectedAgentIds.length === scenario.expectedAgents.length
    : decision.selectedAgentIds.length === 1 &&
      decision.selectedAgentIds[0] === scenario.expectedAgents[0];

  console.log(pass ? "RESULT: PASS" : `RESULT: FAIL (expected [${scenario.expectedAgents.join(", ")}])`);
  return pass;
}

function main(): void {
  const registry = createAgentRegistry([
    generalAgent,
    plannerAgent,
    strategistAgent,
    scoutAgent,
    analystAgent,
  ]);
  const router = createAgentRouter(registry);

  let passed = 0;
  for (const scenario of scenarios) {
    if (runScenario(router, scenario)) {
      passed += 1;
    }
  }

  console.log(`\n=== Validation summary: ${passed}/${scenarios.length} scenarios passed ===`);

  if (passed !== scenarios.length) {
    process.exitCode = 1;
  }
}

main();
