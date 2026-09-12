import type {
  CampaignConstraint,
  CampaignUnderstanding,
  CampaignUnderstandingStage,
  FactOrigin,
  FactScope,
  RequirementCondition,
  SemanticFact,
  StageQualityGateResult,
} from "../../types/campaign-understanding";
import { evaluateCampaignUnderstandingQualityGate } from "./quality-gate";

export type StrategyDecisionBasis = {
  factIds: string[];
  origin: FactOrigin;
  confidence?: number;
  evidence: SemanticFact["evidence"];
  scope?: FactScope;
  condition?: RequirementCondition;
  disclosure?: string;
  derivation?: SemanticFact["derivation"];
};

export type StrategyPlatformDirective = {
  platform: string;
  priority: "primary" | "secondary" | "optional" | "conditional" | "excluded";
  basis: StrategyDecisionBasis;
};

export type StrategyContext = {
  campaignUnderstandingRef: {
    schemaVersion: number;
    confirmationStatus: CampaignUnderstanding["confirmation"]["status"];
    confirmedAt?: string;
    confirmedFactIds: string[];
  };
  coreFacts: SemanticFact[];
  scopedRequirements: SemanticFact[];
  creatorRequirements: SemanticFact[];
  platformDirectives: StrategyPlatformDirective[];
  constraints: CampaignConstraint[];
  resolvedConflicts: CampaignUnderstanding["conflicts"];
  openQuestions: CampaignUnderstanding["questions"];
  openConflicts: CampaignUnderstanding["conflicts"];
  readiness: Record<"strategy" | "creatorPlanning" | "discovery", StageQualityGateResult>;
};

const CORE_CONCEPTS = new Set([
  "brand", "client", "campaign_name", "market", "campaign_objective", "audience",
  "platforms", "deliverables", "performance_kpi", "budget", "creator_strategy",
  "creator_tier_count", "creator_count", "creator_count_range",
]);

function isCreatorRequirement(fact: SemanticFact): boolean {
  return /creator|tier|mandatory|excluded|language|brand_safety|commercial_rights|rights/i.test(fact.concept);
}

function applies(fact: SemanticFact): boolean {
  return !fact.appliesToStages || fact.appliesToStages.includes("strategy") || fact.appliesToStages.includes("creator_planning") || fact.appliesToStages.includes("discovery");
}

function precedence(origin: FactOrigin): number {
  if (origin === "OPERATOR_STATED") return 5;
  if (origin === "SOURCE_STATED") return 4;
  if (origin === "AI_RECOMMENDED") return 3;
  if (origin === "DERIVED") return 2;
  if (origin === "HEURISTIC_DEFAULT") return 1;
  return 0;
}

function basis(fact: SemanticFact): StrategyDecisionBasis {
  return {
    factIds: [fact.id], origin: fact.origin, confidence: fact.confidence,
    evidence: fact.evidence, scope: fact.scope, condition: fact.condition,
    disclosure: fact.disclosure, derivation: fact.derivation,
  };
}

function platformPriority(fact: SemanticFact): StrategyPlatformDirective["priority"] {
  const text = `${fact.concept} ${String(fact.value)}`.toLowerCase();
  if (/exclude|not_in/.test(text)) return "excluded";
  if (fact.condition) return "conditional";
  if (/optional/.test(text)) return "optional";
  if (/secondary|support/.test(text)) return "secondary";
  return "primary";
}

function platformValues(fact: SemanticFact): string[] {
  if (Array.isArray(fact.value)) return fact.value.filter((item): item is string => typeof item === "string");
  return typeof fact.value === "string" ? [fact.value] : [];
}

function normalizedJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(normalizedJson).sort().join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${key}:${normalizedJson(item)}`).join(",")}}`;
  }
  return String(value).trim().toLowerCase();
}

function requirementIdentity(fact: SemanticFact): string {
  // A requirement is only a duplicate when its decision target and all material
  // qualifiers agree. Same concept/scope alone is not enough: a campaign can
  // legitimately carry Instagram primary and TikTok conditional directives.
  return [
    fact.concept.trim().toLowerCase(),
    normalizedJson(fact.value),
    normalizedJson(fact.scope ?? null),
    normalizedJson(fact.condition ?? null),
    fact.status,
  ].join("|");
}

/**
 * Bounded projection of confirmed/reviewable Campaign Understanding. It retains
 * fact identity and scope, never source documents or arbitrary raw text.
 */
export function buildStrategyContext(understanding: CampaignUnderstanding | null | undefined): StrategyContext | undefined {
  if (!understanding || understanding.confirmation.status === "unconfirmed") return undefined;
  const facts = understanding.facts.filter((fact) => applies(fact) && fact.status !== "unsupported");
  const byIdentity = new Map<string, SemanticFact>();
  for (const fact of facts) {
    const key = requirementIdentity(fact);
    const prior = byIdentity.get(key);
    if (!prior || precedence(fact.origin) > precedence(prior.origin)) byIdentity.set(key, fact);
  }
  const selected = [...byIdentity.values()];
  const platformDirectives = selected
    .filter((fact) => /platform/i.test(fact.concept))
    .flatMap((fact) => platformValues(fact).map((platform) => ({ platform, priority: platformPriority(fact), basis: basis(fact) })));
  const activeConstraints = understanding.constraints.filter((constraint) =>
    constraint.status !== "resolved" && (!constraint.appliesToStages || constraint.appliesToStages.some((stage) => ["strategy", "creator_planning", "discovery"].includes(stage)))
  );
  return {
    campaignUnderstandingRef: {
      schemaVersion: understanding.schemaVersion,
      confirmationStatus: understanding.confirmation.status,
      confirmedAt: understanding.confirmation.confirmedAt,
      confirmedFactIds: understanding.confirmation.confirmedFactIds,
    },
    coreFacts: selected.filter((fact) => CORE_CONCEPTS.has(fact.concept)),
    scopedRequirements: selected.filter((fact) => Boolean(fact.scope)),
    creatorRequirements: selected.filter(isCreatorRequirement),
    platformDirectives,
    constraints: activeConstraints,
    resolvedConflicts: understanding.conflicts.filter((conflict) => conflict.status === "resolved"),
    openQuestions: understanding.questions.filter((question) => question.status === "open"),
    openConflicts: understanding.conflicts.filter((conflict) => conflict.status === "open"),
    readiness: {
      strategy: evaluateCampaignUnderstandingQualityGate(understanding, { stage: "strategy", requiresConfirmation: true }),
      creatorPlanning: evaluateCampaignUnderstandingQualityGate(understanding, { stage: "creator_planning", requiresConfirmation: true }),
      discovery: evaluateCampaignUnderstandingQualityGate(understanding, { stage: "discovery", requiresConfirmation: true }),
    },
  };
}
