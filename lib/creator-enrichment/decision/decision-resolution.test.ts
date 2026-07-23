import assert from "node:assert/strict";

import {
  evaluateRulesInPriorityOrder,
  resolveDecisionOutcome,
} from "@/lib/creator-enrichment/decision/decision-resolution";
import type { RuleEvaluation } from "@/lib/creator-enrichment/decision/decision-types";

function testFirstDecisiveRuleWins() {
  const evaluations: RuleEvaluation[] = [
    {
      ruleId: "ForceRule",
      priority: 500,
      opinion: "no_opinion",
      executionTimeMs: 0,
    },
    {
      ruleId: "FreshnessRule",
      priority: 300,
      opinion: "skip",
      reason: "creator_already_fresh",
      executionTimeMs: 1,
    },
  ];
  const resolved = resolveDecisionOutcome(evaluations);
  assert.equal(resolved.decision, "skip");
  assert.equal(resolved.winningRule, "FreshnessRule");
}

function testShortCircuitStopsAfterDecisive() {
  const rules = [
    {
      id: "ForceRule",
      priority: 500,
      description: "test",
      supportedOperations: ["refresh" as const],
      evaluate: () => ({
        ruleId: "ForceRule",
        priority: 500,
        opinion: "no_opinion" as const,
        executionTimeMs: 0,
      }),
    },
    {
      id: "QueueRule",
      priority: 400,
      description: "test",
      supportedOperations: ["refresh" as const],
      evaluate: () => ({
        ruleId: "QueueRule",
        priority: 400,
        opinion: "already_running" as const,
        reason: "enrichment_already_in_progress",
        executionTimeMs: 0,
      }),
    },
    {
      id: "FreshnessRule",
      priority: 300,
      description: "test",
      supportedOperations: ["refresh" as const],
      evaluate: () => {
        throw new Error("FreshnessRule should not run");
      },
    },
  ];

  const evaluations = evaluateRulesInPriorityOrder({
    rules,
    context: {} as never,
    snapshot: {} as never,
  });
  assert.equal(evaluations.length, 2);
  assert.equal(evaluations[1]?.ruleId, "QueueRule");
}

function run() {
  testFirstDecisiveRuleWins();
  testShortCircuitStopsAfterDecisive();
  console.log("decision-resolution.test.ts: all tests passed");
}

run();
