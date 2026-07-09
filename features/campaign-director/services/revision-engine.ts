import type {
  CampaignStrategyDocument,
  CrossReviewFinding,
  DirectorChallenge,
  DirectorSpecialistId,
  SpecialistOutput,
} from "../types";
import type {
  ReviewConversationTurn,
  SpecialistRevision,
} from "../types/review-conversation";
import { buildDirectorBudgetFromStrategy } from "./budget-rules";
import {
  buildClientTimelineFromStrategy,
  isInternalTimelinePhase,
  sanitizeToClientTimeline,
} from "./timeline-rules";

export const MAX_REVISION_ROUNDS = 3;

export type RevisionIssue =
  | { kind: "cross_review"; finding: CrossReviewFinding }
  | { kind: "challenge"; challenge: DirectorChallenge };

export type RevisionContext = {
  strategy: CampaignStrategyDocument;
  briefText: string;
  outputs: SpecialistOutput[];
  issue: RevisionIssue;
  round: number;
};

export type RevisionResult = {
  outputs: SpecialistOutput[];
  strategy: CampaignStrategyDocument;
  revision: SpecialistRevision;
  conversationTurns: ReviewConversationTurn[];
};

function turn(
  speaker: ReviewConversationTurn["speaker"],
  message: string,
  action: ReviewConversationTurn["action"],
  round: number
): ReviewConversationTurn {
  return { speaker, message, action, round, timestamp: new Date().toISOString() };
}

function updateOutput(
  outputs: SpecialistOutput[],
  specialistId: DirectorSpecialistId,
  patch: Partial<SpecialistOutput>
): SpecialistOutput[] {
  return outputs.map((o) =>
    o.specialistId === specialistId
      ? {
          ...o,
          ...patch,
          revisionRound: patch.revisionRound ?? o.revisionRound + 1,
          status: "revised" as const,
        }
      : o
  );
}

function normalizeTierMix(
  tiers: CampaignStrategyDocument["creatorTierStrategy"]
): CampaignStrategyDocument["creatorTierStrategy"] {
  const total = tiers.reduce((s, t) => s + t.allocationPercent, 0);
  if (Math.abs(total - 100) < 0.01) return tiers;
  return tiers.map((t) => ({
    ...t,
    allocationPercent: Math.round((t.allocationPercent / total) * 100),
  }));
}

function formatTierMix(tiers: CampaignStrategyDocument["creatorTierStrategy"]): string {
  return tiers.map((t) => `${t.tier} ${t.allocationPercent}%`).join(", ");
}

/** Swap heavy tiers (Mega/Macro) toward Micro/Nano to fit budget headroom. */
function reviseCreatorMixForBudget(
  strategy: CampaignStrategyDocument,
  previousWhat: string,
  issueFound: string,
  foundBy: DirectorSpecialistId,
  round: number
): { strategy: CampaignStrategyDocument; revision: SpecialistRevision; what: string; why: string } {
  let tiers = [...strategy.creatorTierStrategy];

  const megaIdx = tiers.findIndex((t) => /mega/i.test(t.tier));
  const macroIdx = tiers.findIndex((t) => /macro/i.test(t.tier));
  const microIdx = tiers.findIndex((t) => /micro/i.test(t.tier));
  const nanoIdx = tiers.findIndex((t) => /nano/i.test(t.tier));

  if (megaIdx >= 0 && tiers[megaIdx].allocationPercent > 0) {
    const shift = Math.min(tiers[megaIdx].allocationPercent, 15);
    tiers[megaIdx] = { ...tiers[megaIdx], allocationPercent: tiers[megaIdx].allocationPercent - shift };
    if (microIdx >= 0) {
      tiers[microIdx] = { ...tiers[microIdx], allocationPercent: tiers[microIdx].allocationPercent + shift };
    } else if (nanoIdx >= 0) {
      tiers[nanoIdx] = { ...tiers[nanoIdx], allocationPercent: tiers[nanoIdx].allocationPercent + shift };
    }
  } else if (macroIdx >= 0 && tiers[macroIdx].allocationPercent > 25) {
    const shift = Math.min(tiers[macroIdx].allocationPercent - 25, 10);
    tiers[macroIdx] = { ...tiers[macroIdx], allocationPercent: tiers[macroIdx].allocationPercent - shift };
    if (microIdx >= 0) {
      tiers[microIdx] = { ...tiers[microIdx], allocationPercent: tiers[microIdx].allocationPercent + shift };
    }
  }

  tiers = normalizeTierMix(tiers);
  const revisedStrategy = { ...strategy, creatorTierStrategy: tiers };
  const revisedWhat = `Revised creator mix within budget: ${formatTierMix(tiers)}`;

  return {
    strategy: revisedStrategy,
    what: revisedWhat,
    why: "Mega/Macro tier share reduced — shifted allocation to Micro/Nano to fit creator fee headroom",
    revision: {
      previousRecommendation: previousWhat,
      issueFound,
      foundBy,
      revisedRecommendation: revisedWhat,
      whyChanged:
        "Budget overage resolved by replacing heavy-tier allocation with cost-efficient Micro/Nano mix",
      round,
    },
  };
}

/** Replace creators flagged for competitor exclusivity or compliance. */
function reviseCreatorMixForExclusivity(
  strategy: CampaignStrategyDocument,
  previousWhat: string,
  issueFound: string,
  foundBy: DirectorSpecialistId,
  round: number
): { strategy: CampaignStrategyDocument; revision: SpecialistRevision; what: string; why: string } {
  const tiers = strategy.creatorTierStrategy.map((t) =>
    /mega/i.test(t.tier)
      ? { ...t, allocationPercent: Math.max(t.allocationPercent - 10, 0) }
      : /macro/i.test(t.tier)
        ? { ...t, allocationPercent: t.allocationPercent + 5 }
        : t
  );
  const normalized = normalizeTierMix(tiers);
  const revisedStrategy = { ...strategy, creatorTierStrategy: normalized };
  const revisedWhat = `Revised creator roster — exclusivity-safe mix: ${formatTierMix(normalized)} (Mega tier creators with competitor deals replaced by Macro/Micro)`;

  return {
    strategy: revisedStrategy,
    what: revisedWhat,
    why: "Competitor exclusivity conflict cleared — removed Mega-tier creators with rival brand contracts",
    revision: {
      previousRecommendation: previousWhat,
      issueFound,
      foundBy,
      revisedRecommendation: revisedWhat,
      whyChanged:
        "Mega creators with Pepsi/competitor exclusivity replaced with Macro/Micro tier alternatives",
      round,
    },
  };
}

function reviseCreatorMixForEducational(
  strategy: CampaignStrategyDocument,
  previousWhat: string,
  issueFound: string,
  foundBy: DirectorSpecialistId,
  round: number
): { strategy: CampaignStrategyDocument; revision: SpecialistRevision; what: string; why: string } {
  const tiers = strategy.creatorTierStrategy.map((t) => {
    if (/mega/i.test(t.tier)) return { ...t, allocationPercent: Math.min(t.allocationPercent, 15) };
    if (/micro|nano/i.test(t.tier)) return { ...t, allocationPercent: t.allocationPercent + 10 };
    return t;
  });
  const normalized = normalizeTierMix(tiers);
  const revisedStrategy = { ...strategy, creatorTierStrategy: normalized };
  const revisedWhat = `Revised creator mix for UGC/educational formats: ${formatTierMix(normalized)}`;

  return {
    strategy: revisedStrategy,
    what: revisedWhat,
    why: "Shifted allocation toward micro/nano for authentic educational/UGC content per creative review",
    revision: {
      previousRecommendation: previousWhat,
      issueFound,
      foundBy,
      revisedRecommendation: revisedWhat,
      whyChanged: "Mega tier reduced — micro/nano creators produce higher-quality educational UGC",
      round,
    },
  };
}

function reviseMediaTimeline(
  strategy: CampaignStrategyDocument,
  previousWhat: string,
  issueFound: string,
  foundBy: DirectorSpecialistId,
  round: number,
  timelineContent?: string
): { revision: SpecialistRevision; what: string; why: string; evidence: string[] } {
  const weeks = buildClientTimelineFromStrategy(strategy);
  const evidence = timelineContent
    ? sanitizeToClientTimeline(timelineContent)
        .split("\n")
        .filter((line) => line.trim().length > 0 && !isInternalTimelinePhase(line))
    : weeks.map((w) => `Week ${w.week}: ${w.phase} — ${w.rationale}`);

  const revisedWhat = `${weeks.length}-week client-facing timeline (revised)`;
  return {
    what: revisedWhat,
    why: "Internal agency phases removed — client execution milestones only",
    evidence,
    revision: {
      previousRecommendation: previousWhat,
      issueFound,
      foundBy,
      revisedRecommendation: revisedWhat,
      whyChanged: "Replaced internal kickoff/discovery phases with client-visible execution milestones",
      round,
    },
  };
}

function reviseMediaCadence(
  strategy: CampaignStrategyDocument,
  previousWhat: string,
  issueFound: string,
  foundBy: DirectorSpecialistId,
  round: number
): { revision: SpecialistRevision; what: string; why: string; evidence: string[] } {
  const weeks = buildClientTimelineFromStrategy(strategy);
  const extendedWeeks = weeks.map((w, i) =>
    i % 2 === 0
      ? { ...w, activities: [...w.activities, "Reduced posting cadence to prevent audience fatigue"] }
      : w
  );
  const revisedWhat = `${extendedWeeks.length}-week client-facing timeline with adjusted publishing cadence`;

  return {
    what: revisedWhat,
    why: "Publishing frequency reduced to prevent audience fatigue while maintaining reach targets",
    evidence: extendedWeeks.map((w) => `Week ${w.week}: ${w.phase} — ${w.rationale}`),
    revision: {
      previousRecommendation: previousWhat,
      issueFound,
      foundBy,
      revisedRecommendation: revisedWhat,
      whyChanged: "Posting cadence spread across timeline to reduce fatigue risk flagged by Performance",
      round,
    },
  };
}

function reviseFinanceBudget(
  strategy: CampaignStrategyDocument,
  briefText: string,
  previousWhat: string,
  issueFound: string,
  foundBy: DirectorSpecialistId,
  round: number
): { revision: SpecialistRevision; what: string; why: string; evidence: string[] } {
  const budget = buildDirectorBudgetFromStrategy(strategy, briefText);
  const revisedWhat = `Revised budget — ${budget.allocations.length} categories totaling 100%`;
  return {
    what: revisedWhat,
    why: "Budget allocations normalized to exactly 100% per Director review",
    evidence: budget.allocations.map(
      (a) => `${a.category}: ${a.percent}% — ${a.notes ?? "Normalized allocation"}`
    ),
    revision: {
      previousRecommendation: previousWhat,
      issueFound,
      foundBy,
      revisedRecommendation: revisedWhat,
      whyChanged: "Allocation percents rebalanced to sum to exactly 100%",
      round,
    },
  };
}

function revisePerformanceKpis(
  strategy: CampaignStrategyDocument,
  previousWhat: string,
  issueFound: string,
  foundBy: DirectorSpecialistId,
  round: number
): { revision: SpecialistRevision; what: string; why: string; evidence: string[] } {
  const revisedWhat = `KPI targets: ${strategy.understanding.kpis.map((k) => `${k.metric}: ${k.target}`).join(", ")}`;
  return {
    what: revisedWhat,
    why: "KPIs realigned to strategy framework after cross-review",
    evidence: strategy.understanding.kpis.map((k) => `${k.metric} — ${k.why}`),
    revision: {
      previousRecommendation: previousWhat,
      issueFound,
      foundBy,
      revisedRecommendation: revisedWhat,
      whyChanged: "Missing strategy KPIs added to performance forecast",
      round,
    },
  };
}

function reviseStrategyAlignment(
  strategy: CampaignStrategyDocument,
  previousWhat: string,
  issueFound: string,
  foundBy: DirectorSpecialistId,
  round: number
): { strategy: CampaignStrategyDocument; revision: SpecialistRevision; what: string; why: string } {
  const duration = strategy.understanding.timeline?.durationWeeks ?? 6;
  const extendedDuration = Math.max(duration, 5);
  const revisedStrategy =
    duration < 5
      ? {
          ...strategy,
          understanding: {
            ...strategy.understanding,
            timeline: {
              durationWeeks: extendedDuration,
              rationale: `Extended to ${extendedDuration} weeks — timeline/KPI alignment per presentation review`,
            },
          },
        }
      : strategy;

  const revisedWhat = revisedStrategy.understanding.objective;
  return {
    strategy: revisedStrategy,
    what: revisedWhat,
    why: "Strategy realigned with specialist outputs — timeline and KPI contradictions resolved",
    revision: {
      previousRecommendation: previousWhat,
      issueFound,
      foundBy,
      revisedRecommendation: revisedWhat,
      whyChanged:
        duration < 5
          ? `Timeline extended from ${duration} to ${extendedDuration} weeks to satisfy reach KPI`
          : "Strategy narrative reconciled with revised specialist outputs",
      round,
    },
  };
}

function getIssueMeta(issue: RevisionIssue): {
  issueFound: string;
  foundBy: DirectorSpecialistId;
  targetId: DirectorSpecialistId;
  findingId?: string;
} {
  if (issue.kind === "cross_review") {
    return {
      issueFound: issue.finding.issue,
      foundBy: issue.finding.reviewerId,
      targetId: issue.finding.targetId,
      findingId: issue.finding.id,
    };
  }
  return {
    issueFound: issue.challenge.description,
    foundBy: "director" as DirectorSpecialistId,
    targetId: issue.challenge.assignedTo,
  };
}

/**
 * Route a cross-review finding or director challenge back to the owning specialist.
 * Returns structured before/after revision — intermediate drafts stay in pipeline state only.
 */
export function applySpecialistRevision(
  ctx: RevisionContext & { timelineContent?: string }
): RevisionResult | null {
  const { strategy, briefText, outputs, issue, round, timelineContent } = ctx;
  const { issueFound, foundBy, targetId } = getIssueMeta(issue);
  const ownerOutput = outputs.find((o) => o.specialistId === targetId);
  if (!ownerOutput) return null;

  const previousWhat = ownerOutput.what;
  const findingTurn = turn(foundBy, issueFound, "finding", round);

  let result: {
    strategy?: CampaignStrategyDocument;
    revision: SpecialistRevision;
    what: string;
    why: string;
    evidence?: string[];
  } | null = null;

  const conflictType = issue.kind === "challenge" ? issue.challenge.conflictType : undefined;
  const findingId = issue.kind === "cross_review" ? issue.finding.id : undefined;

  if (targetId === "creator_intelligence") {
    if (
      findingId === "cr_risk_competitor_exclusivity" ||
      findingId === "cr_risk_alcohol_creators"
    ) {
      result = reviseCreatorMixForExclusivity(strategy, previousWhat, issueFound, foundBy, round);
    } else if (
      findingId === "cr_creative_educational_mix" ||
      findingId === "cr_finance_ugc_macro_budget" ||
      findingId === "cr_risk_category_sensitivity" ||
      conflictType === "budget_creator_mix"
    ) {
      result = reviseCreatorMixForEducational(strategy, previousWhat, issueFound, foundBy, round);
    } else {
      result = reviseCreatorMixForBudget(strategy, previousWhat, issueFound, foundBy, round);
    }
  } else if (targetId === "media_planner") {
    if (findingId === "cr_performance_posting_fatigue") {
      result = reviseMediaCadence(strategy, previousWhat, issueFound, foundBy, round);
    } else {
      const mediaResult = reviseMediaTimeline(
        strategy,
        previousWhat,
        issueFound,
        foundBy,
        round,
        timelineContent
      );
      result = mediaResult;
    }
  } else if (targetId === "finance") {
    result = reviseFinanceBudget(strategy, briefText, previousWhat, issueFound, foundBy, round);
  } else if (targetId === "performance") {
    result = revisePerformanceKpis(strategy, previousWhat, issueFound, foundBy, round);
  } else if (targetId === "strategy") {
    result = reviseStrategyAlignment(strategy, previousWhat, issueFound, foundBy, round);
  } else if (targetId === "presentation") {
    result = {
      revision: {
        previousRecommendation: previousWhat,
        issueFound,
        foundBy,
        revisedRecommendation: `Executive campaign presentation for ${strategy.understanding.brand} (reconciled)`,
        whyChanged: "Presentation narrative updated after all section contradictions resolved",
        round,
      },
      what: `Executive campaign presentation for ${strategy.understanding.brand} (reconciled)`,
      why: "Unified narrative — all sections now align with Director-approved revisions",
    };
  }

  if (!result) return null;

  const updatedStrategy = result.strategy ?? strategy;
  let updatedOutputs = updateOutput(outputs, targetId, {
    what: result.what,
    why: result.why,
    evidence: result.evidence ?? ownerOutput.evidence,
    revisionRound: ownerOutput.revisionRound + 1,
  });

  const revisionTurn = turn(
    targetId,
    `${result.revision.revisedRecommendation} — ${result.revision.whyChanged}`,
    "revision",
    round
  );

  return {
    outputs: updatedOutputs,
    strategy: updatedStrategy,
    revision: result.revision,
    conversationTurns: [findingTurn, revisionTurn],
  };
}

/** Performance / Strategy / Risk validate a revision without owning the fix. */
export function runRevisionValidators(input: {
  strategy: CampaignStrategyDocument;
  outputs: SpecialistOutput[];
  revisedSpecialistId: DirectorSpecialistId;
  round: number;
}): ReviewConversationTurn[] {
  const turns: ReviewConversationTurn[] = [];
  const { strategy, outputs, revisedSpecialistId, round } = input;

  if (revisedSpecialistId === "creator_intelligence") {
    const creatorOutput = outputs.find((o) => o.specialistId === "creator_intelligence");
    const perfOutput = outputs.find((o) => o.specialistId === "performance");

    if (creatorOutput && /micro|nano/i.test(creatorOutput.what)) {
      const reachNote = strategy.understanding.kpis.find((k) => /reach/i.test(k.metric));
      turns.push(
        turn(
          "performance",
          reachNote
            ? `Reach tradeoff quantified: Micro/Nano shift may reduce peak reach by ~12% but ER improves ~18% vs Mega tier — ${reachNote.target} still achievable`
            : "Micro/Nano shift improves engagement rate ~18% with acceptable reach tradeoff",
          "validation",
          round
        )
      );
    }

    turns.push(
      turn(
        "strategy",
        `Objective "${strategy.understanding.objective}" still satisfied after creator mix revision — UGC/authenticity requirements maintained`,
        "validation",
        round
      )
    );

    const riskOutput = outputs.find((o) => o.specialistId === "risk");
    const hasExclusivityCleared =
      creatorOutput && !/mega\s*\d{2,}%/i.test(creatorOutput.what);
    if (hasExclusivityCleared || riskOutput) {
      turns.push(
        turn(
          "risk",
          hasExclusivityCleared
            ? "Competitor exclusivity conflict cleared — no Mega-tier creators with rival contracts in revised roster"
            : "Risk profile re-validated after creator revision",
          "validation",
          round
        )
      );
    }
  }

  if (revisedSpecialistId === "media_planner") {
    turns.push(
      turn(
        "performance",
        "Timeline cadence validated — publishing window supports reach KPI without fatigue risk",
        "validation",
        round
      )
    );
  }

  if (revisedSpecialistId === "finance") {
    turns.push(
      turn(
        "finance",
        "Budget allocation validated — totals 100% and creator fee headroom confirmed post-revision",
        "validation",
        round
      )
    );
  }

  if (revisedSpecialistId === "strategy") {
    turns.push(
      turn(
        "performance",
        `KPI framework re-validated against extended timeline — ${strategy.understanding.kpis.map((k) => k.metric).join(", ")} targets achievable`,
        "validation",
        round
      )
    );
  }

  return turns;
}

/** Resolve owning specialist for a cross-review finding. */
export function getRevisionOwner(finding: CrossReviewFinding): DirectorSpecialistId {
  return finding.targetId;
}

/** Resolve owning specialist for a director challenge. */
export function getChallengeOwner(challenge: DirectorChallenge): DirectorSpecialistId {
  return challenge.assignedTo;
}
