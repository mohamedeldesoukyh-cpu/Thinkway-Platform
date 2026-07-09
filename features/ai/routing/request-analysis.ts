import type { AiContext, AiRequest } from "../types";

import { isOperationalCampaignBrief } from "./operational-detection";
import type {
  ContextSignals,
  IntentType,
  MessageSignal,
  RequestAnalysisResult,
} from "./types";

const COMPOUND_CONNECTORS = /\b(then|and then|after that|followed by|also|plus)\b/i;

const INTENT_PATTERNS: Array<{
  intent: IntentType;
  patterns: RegExp[];
  weight: number;
  label: string;
}> = [
  {
    intent: "general",
    patterns: [
      /^(hi|hello|hey|good morning|good afternoon|good evening)\b/i,
      /\b(help|what can you|what can thinkway|how do i|how to|navigate|explain thinkway|what is thinkway)\b/i,
      /\b(thanks|thank you|bye|goodbye)\b/i,
    ],
    weight: 75,
    label: "general-conversation",
  },
  {
    intent: "strategy",
    patterns: [
      /\b(create|build|develop|design)\s+(a\s+)?(campaign|strategy|influencer strategy)\b/i,
      /\blaunch(?:ing)?\s+\w/i,
      /\blaunch(?:ing)?\s+[\w-]+(?:\s+[\w-]+){0,8}\s+in\s+[\w-]+/i,
      /\bbudget\b[\s\S]{0,220}\b(?:duration|weeks|months|objective)\b/i,
      /\b(generate|create|write)\s+(?:a\s+)?proposal\b/i,
      /\b(strateg(y|ize|ic)|positioning|creator mix|brand awareness|platform strategy)\b/i,
      /\b(budget allocation|commercial positioning)\b/i,
    ],
    weight: 85,
    label: "strategy-request",
  },
  {
    intent: "planning",
    patterns: [
      /\b(plan|planning|timeline|milestone|schedule|roadmap|gantt)\b/i,
      /\b(campaign timeline|resource allocation|deliverable plan)\b/i,
    ],
    weight: 80,
    label: "planning-request",
  },
  {
    intent: "discovery",
    patterns: [
      /\b(find|search|discover|scout|source)\s+(?:\w+\s+){0,4}(creators?|influencers?|vendors?)\b/i,
      /\b(creator search|influencer search|shortlist candidates)\b/i,
      /\b(match\s+(my\s+)?(audience|campaign))\b/i,
    ],
    weight: 85,
    label: "discovery-request",
  },
  {
    intent: "analysis",
    patterns: [
      /\b(analy[sz]e|analysis|insight|diagnos[ei]s|optimi[sz]e)\b/i,
      /\b(why did|what caused|engagement drop|performance drop|underperform)\b/i,
      /\b(risk|opportunit(y|ies)|bottleneck)\b/i,
    ],
    weight: 85,
    label: "analysis-request",
  },
  {
    intent: "reporting",
    patterns: [
      /\b(report|summary report|stakeholder report|generate report|dashboard)\b/i,
      /\b(kpi report|performance report|executive summary)\b/i,
    ],
    weight: 80,
    label: "reporting-request",
  },
  {
    intent: "creator",
    patterns: [/\b(creator|influencer|vendor)\b/i],
    weight: 40,
    label: "creator-context",
  },
  {
    intent: "campaign",
    patterns: [/\b(campaign|campaign line|po)\b/i],
    weight: 45,
    label: "campaign-context",
  },
  {
    intent: "client",
    patterns: [/\b(client|legal entity|brand)\b/i],
    weight: 35,
    label: "client-context",
  },
  {
    intent: "shortlist",
    patterns: [/\b(shortlist|short-list)\b/i],
    weight: 70,
    label: "shortlist-request",
  },
];

const EXPLICIT_INTENT_MAP: Record<
  NonNullable<AiRequest["intent"]>,
  IntentType
> = {
  plan: "planning",
  strategize: "strategy",
  scout: "discovery",
  analyze: "analysis",
  general: "general",
};

function extractMessageSignals(message: string): MessageSignal[] {
  const signals: MessageSignal[] = [];

  for (const entry of INTENT_PATTERNS) {
    for (const pattern of entry.patterns) {
      if (pattern.test(message)) {
        signals.push({
          id: entry.label,
          weight: entry.weight,
          label: `${entry.intent}:${entry.label}`,
        });
        break;
      }
    }
  }

  if (COMPOUND_CONNECTORS.test(message)) {
    signals.push({
      id: "compound-request",
      weight: 60,
      label: "compound:multi-step-request",
    });
  }

  if (isOperationalCampaignBrief(message)) {
    signals.push({
      id: "operational-campaign-brief",
      weight: 92,
      label: "strategy:operational-campaign-brief",
    });
  }

  return signals;
}

function extractContextSignals(
  context: AiContext,
  request: AiRequest
): ContextSignals {
  const snapshot = request.context ?? {};
  const merged: AiContext = { ...context, ...snapshot };

  return {
    hasCampaign: Boolean(merged.campaign?.id ?? merged.workspace.campaignId),
    hasClient: Boolean(merged.client?.id ?? merged.workspace.clientId),
    hasShortlist: Boolean(merged.shortlist?.id),
    hasSelectedCreators: (merged.selectedCreators?.length ?? 0) > 0,
    hasFilters: Boolean(merged.filters?.query ?? merged.filters?.platforms?.length),
    workspaceType: merged.workspace.type,
    conversationTurns: merged.conversation?.messages.length ?? 0,
    urlContextPresent: Boolean(
      merged.workspace.campaignId ||
        merged.workspace.clientId ||
        merged.workspace.brandId ||
        merged.workspace.groupId
    ),
  };
}

function resolvePrimaryIntent(
  signals: MessageSignal[],
  explicitIntent?: AiRequest["intent"]
): IntentType {
  if (explicitIntent) {
    return EXPLICIT_INTENT_MAP[explicitIntent];
  }

  const intentScores = new Map<IntentType, number>();

  for (const signal of signals) {
    const intent = signal.label.split(":")[0] as IntentType;
    const current = intentScores.get(intent) ?? 0;
    intentScores.set(intent, Math.max(current, signal.weight));
  }

  if (intentScores.size === 0) {
    return "unknown";
  }

  let best: IntentType = "unknown";
  let bestScore = -1;

  for (const [intent, score] of intentScores) {
    if (score > bestScore) {
      best = intent;
      bestScore = score;
    }
  }

  return best;
}

function resolveSecondaryIntents(
  signals: MessageSignal[],
  primary: IntentType
): IntentType[] {
  const intents = new Set<IntentType>();

  for (const signal of signals) {
    const intent = signal.label.split(":")[0] as IntentType;
    if (intent !== primary && intent !== "unknown") {
      intents.add(intent);
    }
  }

  return Array.from(intents);
}

/**
 * Structured request analysis using workspace, conversation, entity, and URL context.
 * Produces intent signals — not routing decisions (those live in confidence.ts).
 */
export function analyzeRequest(
  request: AiRequest,
  context: AiContext
): RequestAnalysisResult {
  const normalizedMessage = request.message.trim().toLowerCase();
  const signals = extractMessageSignals(normalizedMessage);
  const contextSignals = extractContextSignals(context, request);
  const explicitIntent = request.intent;

  if (explicitIntent) {
    signals.unshift({
      id: "explicit-intent",
      weight: 98,
      label: `${EXPLICIT_INTENT_MAP[explicitIntent]}:explicit-intent`,
    });
  }

  if (contextSignals.workspaceType === "discovery") {
    signals.push({
      id: "workspace-discovery",
      weight: 55,
      label: "discovery:workspace-discovery",
    });
  }

  if (contextSignals.workspaceType === "campaign") {
    signals.push({
      id: "workspace-campaign",
      weight: 50,
      label: "campaign:workspace-campaign",
    });
  }

  if (contextSignals.hasSelectedCreators) {
    signals.push({
      id: "selected-creators",
      weight: 45,
      label: "creator:selected-creators",
    });
  }

  const primaryIntent = resolvePrimaryIntent(signals, explicitIntent);
  const secondaryIntents = resolveSecondaryIntents(signals, primaryIntent);
  const isCompoundRequest =
    COMPOUND_CONNECTORS.test(normalizedMessage) ||
    (secondaryIntents.length > 0 &&
      secondaryIntents.some((intent) =>
        ["strategy", "planning", "discovery", "analysis"].includes(intent)
      ));

  return {
    request,
    context,
    normalizedMessage,
    primaryIntent,
    secondaryIntents,
    signals,
    contextSignals,
    isCompoundRequest,
    explicitIntent,
  };
}
