import { sumAllocationPercents } from "@/features/campaign-studio/services/budget-allocation";
import { buildExecutiveStrategyReasoning } from "@/features/campaign-intelligence/services/reasoning/executive-strategy-reasoning";
import { buildCreatorMixReasoning } from "@/features/campaign-intelligence/services/reasoning/creator-mix-reasoning";
import { buildKpiForecastReasoning } from "@/features/campaign-intelligence/services/reasoning/kpi-reasoning";
import { buildCreatorActivationTimeline } from "@/features/campaign-intelligence/services/reasoning/creator-activation-timeline";
import { buildBudgetPlannerReasoning } from "@/features/campaign-intelligence/services/reasoning/budget-planner-reasoning";
import { buildDirectorDecisionMinutes } from "@/features/campaign-intelligence/services/reasoning/director-decision-minutes";

import type { CampaignFacts } from "../facts/campaign-facts-types";
import type {
  CampaignStrategyDocument,
  DirectorSpecialistId,
  SpecialistOutput,
} from "../types";
import { buildDirectorBudgetFromStrategy } from "./budget-rules";
import { CLIENT_FACING_TIMELINE_PHASES, buildClientTimelineFromStrategy } from "./timeline-rules";

export type SpecialistTaskContext = {
  taskId?: string;
  taskContent?: string;
  stateData?: Record<string, unknown>;
};

const SPECIALIST_DOMAINS: Record<DirectorSpecialistId, string> = {
  strategy: "Campaign Strategy & Objectives",
  creative: "Creative Direction & Content Pillars",
  creator_intelligence: "Creator Discovery & Mix",
  media_planner: "Media Planning & Publishing Calendar",
  finance: "Budget Allocation & Commercial Model",
  risk: "Risk Assessment & Compliance",
  performance: "KPI Forecasting & Measurement",
  presentation: "Executive Presentation & Narrative",
};

const TASK_TO_SPECIALIST: Record<string, DirectorSpecialistId> = {
  "analyze-request": "strategy",
  "build-strategy": "strategy",
  "estimate-budget": "finance",
  "search-creators": "creator_intelligence",
  "build-shortlist": "creator_intelligence",
  "generate-brief": "creative",
  "generate-timeline": "media_planner",
  "prepare-approval": "presentation",
};

export function resolveSpecialistForTask(taskId: string): DirectorSpecialistId | undefined {
  return TASK_TO_SPECIALIST[taskId];
}

function buildFinanceOutput(
  strategy: CampaignStrategyDocument,
  briefText: string,
  taskContent?: string,
  campaignFacts?: CampaignFacts
): SpecialistOutput {
  const budget = buildDirectorBudgetFromStrategy(strategy, briefText, campaignFacts);
  const plannerReasoning = campaignFacts
    ? buildBudgetPlannerReasoning(campaignFacts, strategy, briefText)
    : null;
  const allocationSummary = budget.allocations
    .map((a) => {
      const line = plannerReasoning?.allocations.find((r) => r.category === a.category);
      return `${a.category}: ${a.percent}% — ${line?.reason ?? a.notes ?? "Director allocation"}`;
    })
    .join("\n");

  return {
    specialistId: "finance",
    domain: SPECIALIST_DOMAINS.finance,
    what: budget.total
      ? `Influencer budget ${budget.currency} ${budget.total.toLocaleString()} — ${budget.allocations.length} categories, no paid media buying`
      : `Influencer marketing budget framework in ${budget.currency}`,
    why: plannerReasoning?.directorRationale ??
      `Influencer-only model for ${strategy.understanding.brand} — creator fees include production unless CampaignFacts constraints require split`,
    evidence: [
      strategy.understanding.budget?.rationale ?? "CampaignFacts + Director Strategy SSOT",
      `Allocation sum: ${sumAllocationPercents(budget.allocations)}%`,
      allocationSummary,
      ...(plannerReasoning?.allocations.map((a) => `${a.category}: ${a.tradeoff}`) ?? []),
      taskContent?.slice(0, 200) ?? "",
    ].filter(Boolean),
    sections: ["budget", "operations"],
    status: "draft",
    revisionRound: 0,
  };
}

function buildCreatorIntelligenceOutput(
  strategy: CampaignStrategyDocument,
  taskContent?: string,
  campaignFacts?: CampaignFacts
): SpecialistOutput {
  const mixReasoning = campaignFacts ? buildCreatorMixReasoning(campaignFacts, strategy) : { whyMix: "", tiers: [] };
  const tiers = strategy.creatorTierStrategy
    .map((t) => `${t.tier} ${t.allocationPercent}%`)
    .join(", ");

  return {
    specialistId: "creator_intelligence",
    domain: SPECIALIST_DOMAINS.creator_intelligence,
    what: `Creator mix for ${strategy.understanding.brand}: ${tiers} on ${strategy.understanding.platforms.join(", ")}`,
    why:
      mixReasoning.whyMix ||
      (mixReasoning.tiers[0]?.whyThisTier ??
        `Tier progression balances reach, authenticity, and ${strategy.understanding.budget?.currency ?? "budget"} efficiency per Director strategy for ${strategy.understanding.objective}`),
    evidence: [
      mixReasoning.whyMix,
      ...strategy.creatorTierStrategy.map((t) => `${t.tier}: ${t.why}`),
      ...mixReasoning.tiers.map((m) => `${m.tier} if-changed: ${m.ifTierChanged}`),
      `CampaignFacts.audience=${strategy.understanding.audience}`,
      taskContent?.slice(0, 200) ?? "Discovery funnel pending workflow execution",
    ],
    sections: ["creators"],
    status: "draft",
    revisionRound: 0,
  };
}

function buildMediaPlannerOutput(
  strategy: CampaignStrategyDocument,
  campaignFacts?: CampaignFacts
): SpecialistOutput {
  const activation = campaignFacts
    ? buildCreatorActivationTimeline(campaignFacts, strategy)
    : null;
  const weeks = buildClientTimelineFromStrategy(strategy);
  const phaseSummary = (activation?.activationWeeks ?? weeks).map((w) => {
    const week = "week" in w ? w.week : (w as { week: number }).week;
    const tier = "tier" in w ? (w as { tier: string }).tier : weeks.find((x) => x.week === week)?.phase;
    const objective = "objective" in w ? (w as { objective: string }).objective : weeks.find((x) => x.week === week)?.phase;
    const reason = "reason" in w ? (w as { reason: string }).reason : weeks.find((x) => x.week === week)?.rationale;
    return `Week ${week}: ${tier} — ${objective} — ${reason}`;
  }).join("\n");

  return {
    specialistId: "media_planner",
    domain: SPECIALIST_DOMAINS.media_planner,
    what: `${strategy.understanding.timeline?.durationWeeks ?? weeks.length}-week creator activation plan (reporting after duration)`,
    why: activation?.reportingPhase.reason ??
      "Creator activation sequencing — not internal agency schedule; reporting separated from live weeks",
    evidence: [
      ...strategy.creatorTierStrategy.map((t) => `Tier ${t.tier} activation rationale: ${t.why}`),
      phaseSummary,
      `CampaignFacts.durationWeeks=${strategy.understanding.timeline?.durationWeeks}`,
    ],
    sections: ["timeline"],
    status: "draft",
    revisionRound: 0,
  };
}

function buildPerformanceOutput(
  strategy: CampaignStrategyDocument,
  campaignFacts?: CampaignFacts
): SpecialistOutput {
  const kpiReasoning = campaignFacts
    ? buildKpiForecastReasoning(campaignFacts, strategy)
    : null;
  const kpiSummary = strategy.understanding.kpis
    .map((k) => `${k.metric}: ${k.target}`)
    .join(", ");

  return {
    specialistId: "performance",
    domain: SPECIALIST_DOMAINS.performance,
    what: `KPI forecast for ${strategy.understanding.brand}: ${kpiSummary}`,
    why: kpiReasoning?.forecastNotes ??
      `Forecasts anchored to ${strategy.understanding.objective} and ${strategy.understanding.platforms.join("/")} mix`,
    evidence: [
      ...(kpiReasoning?.kpis.map((k) => `${k.metric}: ${k.reason} (confidence ${k.confidence}%)`) ??
        strategy.understanding.kpis.map((k) => `${k.metric} — ${k.why}`)),
      `DirectorStrategy.objective=${strategy.understanding.objective}`,
    ],
    sections: ["performance"],
    status: "draft",
    revisionRound: 0,
  };
}

function buildRiskOutput(strategy: CampaignStrategyDocument): SpecialistOutput {
  const risks =
    strategy.understanding.risks.length > 0
      ? strategy.understanding.risks
      : ["Vendor availability variance during outreach window"];

  return {
    specialistId: "risk",
    domain: SPECIALIST_DOMAINS.risk,
    what: `${risks.length} risk flag(s) identified from strategy constraints`,
    why: "Risk assessment validates creator mix, budget buffer, and category compliance",
    evidence: risks,
    sections: ["operations"],
    status: "draft",
    revisionRound: 0,
  };
}

function buildStrategyOutput(
  strategy: CampaignStrategyDocument,
  taskContent?: string,
  campaignFacts?: CampaignFacts
): SpecialistOutput {
  const execReasoning = campaignFacts
    ? buildExecutiveStrategyReasoning(campaignFacts, strategy)
    : null;

  return {
    specialistId: "strategy",
    domain: SPECIALIST_DOMAINS.strategy,
    what: execReasoning?.chosenStrategy ?? strategy.understanding.objective,
    why: execReasoning?.whyThisStrategyWins ??
      "Director-approved strategic direction — SSOT for all downstream specialists",
    evidence: [
      ...(execReasoning?.evidence ?? []),
      ...strategy.pillars.map((p) => `${p.title}: ${p.why}`),
      execReasoning?.directorConclusion ?? "",
      taskContent?.slice(0, 200) ?? "",
    ].filter(Boolean),
    sections: ["strategy", "summary", "audience"],
    status: "draft",
    revisionRound: 0,
  };
}

function buildCreativeOutput(
  strategy: CampaignStrategyDocument,
  taskContent?: string
): SpecialistOutput {
  return {
    specialistId: "creative",
    domain: SPECIALIST_DOMAINS.creative,
    what: `Creative brief for ${strategy.understanding.brand} — ${strategy.understanding.objective}`,
    why: "Content pillars must deliver educational/authentic formats matching creator tier mix",
    evidence: [
      `Platforms: ${strategy.understanding.platforms.join(", ")}`,
      `Audience: ${strategy.understanding.audience}`,
      taskContent?.slice(0, 300) ?? "",
    ].filter(Boolean),
    sections: ["summary"],
    status: "draft",
    revisionRound: 0,
  };
}

function buildPresentationOutput(
  strategy: CampaignStrategyDocument,
  taskContent?: string,
  campaignFacts?: CampaignFacts,
  specialistOutputs?: SpecialistOutput[]
): SpecialistOutput {
  const brand = campaignFacts?.brandName ?? strategy.understanding.brand;
  const minutes = campaignFacts
    ? buildDirectorDecisionMinutes(campaignFacts, strategy, specialistOutputs ?? [])
    : [];

  return {
    specialistId: "presentation",
    domain: SPECIALIST_DOMAINS.presentation,
    what: `Executive campaign presentation for ${brand} — ${minutes.length} Director decision minutes recorded`,
    why: "Unified narrative — all sections align with Director strategy and CampaignFacts before approval",
    evidence: [
      ...strategy.pillars.map((p) => `${p.title}: ${p.what}`),
      ...minutes.slice(0, 3).map((m) => `${m.decision}: ${m.finalApproval}`),
      taskContent?.slice(0, 200) ?? "",
    ].filter(Boolean),
    sections: ["presentation"],
    status: "draft",
    revisionRound: 0,
  };
}

export function dispatchSpecialists(
  strategy: CampaignStrategyDocument,
  briefText: string,
  taskOutputs?: Map<DirectorSpecialistId, string>,
  campaignFacts?: CampaignFacts
): SpecialistOutput[] {
  const coreOutputs: SpecialistOutput[] = [
    buildStrategyOutput(strategy, taskOutputs?.get("strategy"), campaignFacts),
    buildCreativeOutput(strategy, taskOutputs?.get("creative")),
    buildCreatorIntelligenceOutput(strategy, taskOutputs?.get("creator_intelligence"), campaignFacts),
    buildMediaPlannerOutput(strategy, campaignFacts),
    buildFinanceOutput(strategy, briefText, taskOutputs?.get("finance"), campaignFacts),
    buildRiskOutput(strategy),
    buildPerformanceOutput(strategy, campaignFacts),
  ];

  return [
    ...coreOutputs,
    buildPresentationOutput(
      strategy,
      taskOutputs?.get("presentation"),
      campaignFacts,
      coreOutputs
    ),
  ];
}

export function specialistOutputFromTask(
  strategy: CampaignStrategyDocument,
  briefText: string,
  taskId: string,
  content: string,
  campaignFacts?: CampaignFacts
): SpecialistOutput | undefined {
  const specialistId = resolveSpecialistForTask(taskId);
  if (!specialistId) return undefined;

  const outputs = dispatchSpecialists(
    strategy,
    briefText,
    new Map([[specialistId, content]]),
    campaignFacts
  );
  const output = outputs.find((o) => o.specialistId === specialistId);
  return output ? { ...output, status: "reviewed" } : undefined;
}

export function getSpecialistDomain(specialistId: DirectorSpecialistId): string {
  return SPECIALIST_DOMAINS[specialistId];
}

export function mergeTaskOutputsIntoSpecialists(
  strategy: CampaignStrategyDocument,
  briefText: string,
  taskResults: Record<string, { content?: string }>,
  campaignFacts?: CampaignFacts
): SpecialistOutput[] {
  const taskOutputs = new Map<DirectorSpecialistId, string>();

  for (const [taskId, result] of Object.entries(taskResults)) {
    const specialistId = resolveSpecialistForTask(taskId);
    if (!specialistId || !result.content?.trim()) continue;
    const existing = taskOutputs.get(specialistId);
    taskOutputs.set(
      specialistId,
      existing ? `${existing}\n\n${result.content}` : result.content
    );
  }

  return dispatchSpecialists(strategy, briefText, taskOutputs, campaignFacts);
}
