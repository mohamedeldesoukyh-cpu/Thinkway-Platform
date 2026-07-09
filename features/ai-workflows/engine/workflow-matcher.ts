import {
  createAgentRegistry,
  createAgentRouter,
  generalAgent,
  plannerAgent,
  strategistAgent,
  scoutAgent,
  analystAgent,
} from "@/features/ai";
import type { AiContext, AiRequest } from "@/features/ai";
import type { IntentType } from "@/features/ai/routing/types";
import {
  isOperationalCampaignBrief,
  META_HELP_PATTERN,
} from "@/features/ai/routing/operational-detection";

import { WORKFLOW_DEFINITIONS, getWorkflowById } from "../definitions";
import type { WorkflowDefinition, WorkflowId, WorkflowMatchResult } from "../types";

let cachedRouter: ReturnType<typeof createAgentRouter> | undefined;

function getRouter() {
  if (!cachedRouter) {
    const registry = createAgentRegistry([
      generalAgent,
      plannerAgent,
      strategistAgent,
      scoutAgent,
      analystAgent,
    ]);
    cachedRouter = createAgentRouter(registry);
  }
  return cachedRouter;
}

export function resetWorkflowMatcherCache(): void {
  cachedRouter = undefined;
}

type MatchScore = {
  workflow: WorkflowDefinition;
  score: number;
  matchedPattern?: string;
  routingBoost: number;
};

/** Maps operational routing intents to default workflows when regex patterns miss. */
const ROUTING_INTENT_WORKFLOW: Partial<Record<IntentType, WorkflowId>> = {
  strategy: "create-campaign",
  discovery: "find-creators",
  shortlist: "build-shortlist",
  reporting: "generate-brief",
};

function matchOperationalCampaignBrief(): MatchScore | null {
  const workflow = getWorkflowById("create-campaign");
  if (!workflow) {
    return null;
  }

  return {
    workflow,
    score: 92,
    matchedPattern: "operational:campaign-brief",
    routingBoost: 0,
  };
}

function matchByRoutingIntent(
  request: AiRequest,
  context?: AiContext
): MatchScore | null {
  const message = request.message.trim();
  if (META_HELP_PATTERN.test(message)) {
    return null;
  }
  if (request.intent === "general" && !isOperationalCampaignBrief(message)) {
    return null;
  }

  const router = getRouter();
  const decision = router.route(request, context ?? { workspace: { type: "general" } });
  const { primaryIntent } = decision.analysis;

  if (primaryIntent === "general" || primaryIntent === "unknown") {
    return null;
  }

  const workflowId = ROUTING_INTENT_WORKFLOW[primaryIntent];
  if (!workflowId) {
    return null;
  }

  const workflow = getWorkflowById(workflowId);
  if (!workflow) {
    return null;
  }

  const agentMatch = workflow.tasks.some((task) =>
    decision.selectedAgentIds.includes(task.agent)
  );
  if (!agentMatch) {
    return null;
  }

  const topScore = decision.confidence.highestScore;
  if (topScore < 70) {
    return null;
  }

  return {
    workflow,
    score: Math.max(72, Math.min(topScore, 85)),
    matchedPattern: `routing:${primaryIntent}`,
    routingBoost: topScore,
  };
}

/**
 * Match user goal to a workflow definition.
 * Combines regex pattern matching with routing confidence boost.
 */
export function matchWorkflow(
  request: AiRequest,
  context?: AiContext
): WorkflowMatchResult {
  const message = request.message.trim();
  const scores: MatchScore[] = [];

  for (const workflow of WORKFLOW_DEFINITIONS) {
    let patternScore = 0;
    let matchedPattern: string | undefined;

    for (const pattern of workflow.triggerPatterns) {
      if (pattern.test(message)) {
        patternScore = Math.max(patternScore, 85);
        matchedPattern = pattern.source;
        break;
      }
    }

    if (patternScore === 0) continue;

    let routingBoost = 0;
    try {
      const router = getRouter();
      const decision = router.route(request, context ?? { workspace: { type: "general" } });
      const agentMatch = workflow.tasks.some((t) =>
        decision.selectedAgentIds.includes(t.agent)
      );
      if (agentMatch) routingBoost = 10;
      if (decision.analysis.isCompoundRequest) routingBoost += 5;
    } catch {
      // Routing unavailable — pattern match only
    }

    if (request.intent) {
      const intentAgents: Record<string, string[]> = {
        strategize: ["strategist"],
        scout: ["scout"],
        analyze: ["analyst"],
        plan: ["planner"],
        general: ["general"],
      };
      const expectedAgents = intentAgents[request.intent] ?? [];
      const intentMatch = workflow.tasks.some((t) =>
        expectedAgents.includes(t.agent)
      );
      if (intentMatch) routingBoost += 15;
    }

    scores.push({
      workflow,
      score: patternScore + routingBoost,
      matchedPattern,
      routingBoost,
    });
  }

  if (scores.length === 0) {
    if (isOperationalCampaignBrief(message)) {
      const operationalMatch = matchOperationalCampaignBrief();
      if (operationalMatch) {
        scores.push(operationalMatch);
      }
    }

    if (scores.length === 0) {
      const routingMatch = matchByRoutingIntent(request, context);
      if (routingMatch) {
        scores.push(routingMatch);
      }
    }
  }

  scores.sort((a, b) => b.score - a.score);

  if (scores.length === 0) {
    return {
      matched: false,
      confidence: 0,
      reason: "No workflow patterns matched",
    };
  }

  const best = scores[0];

  if (best.score < best.workflow.minConfidence) {
    return {
      matched: false,
      confidence: best.score,
      reason: `Best match "${best.workflow.name}" below threshold (${best.score} < ${best.workflow.minConfidence})`,
    };
  }

  if (scores.length > 1 && scores[0].score - scores[1].score < 5) {
    return {
      matched: true,
      workflow: best.workflow,
      confidence: best.score,
      reason: `Matched "${best.workflow.name}" (pattern: ${best.matchedPattern}, close second: "${scores[1].workflow.name}")`,
    };
  }

  return {
    matched: true,
    workflow: best.workflow,
    confidence: best.score,
    reason: `Matched "${best.workflow.name}" via pattern ${best.matchedPattern} (score: ${best.score})`,
  };
}

/** Check if a message likely triggers a workflow (fast pre-check). */
export function isLikelyWorkflowRequest(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (isOperationalCampaignBrief(message)) {
    return true;
  }
  const keywords = [
    "create campaign",
    "create a",
    "build campaign",
    "launch ",
    "find creator",
    "search creator",
    "analyze campaign",
    "generate brief",
    "generate proposal",
    "build shortlist",
    "health check",
    "campaign health",
  ];
  return keywords.some((kw) => normalized.includes(kw));
}
