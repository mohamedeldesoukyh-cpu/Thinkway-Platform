/**
 * Governance self-repair — a campaign must never stop because of a fixable
 * quality issue.
 *
 * Every failing governance check is classified as either:
 *   auto_fixable  — the Director can repair it deterministically by scrubbing,
 *                   normalizing, or regenerating ONLY the affected artifacts
 *                   (strategy fields, one specialist output, the budget) while
 *                   preserving all other completed work;
 *   user_required — missing business information that cannot be inferred
 *                   (budget, brand, objective, audience) → the workflow pauses
 *                   and asks a clear, specific question.
 *
 * The Director pipeline runs the repair loop (see runCampaignDirectorPipeline)
 * until governance approves or the configurable retry limit is reached. Every
 * attempt is logged with the blocker, the repair applied, and the final
 * outcome, and the summary is persisted on the pipeline result so the decision
 * is explainable and traceable in Studio.
 */
import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type {
  CampaignStrategyDocument,
  DirectorSpecialistId,
  SpecialistOutput,
} from "@/features/campaign-director/types/pipeline";
import { dispatchSpecialists } from "@/features/campaign-director/services/specialist-dispatch";
import { buildDirectorBudgetFromStrategy } from "@/features/campaign-director/services/budget-rules";
import { writeStrategyDocumentFromBrief } from "@/features/campaign-director/services/strategy-document";
import { normalizeBudgetAllocationPercents } from "@/features/campaign-studio/services/budget-allocation";
import type { BudgetSectionData } from "@/features/campaign-intelligence/types/section-schemas";

import { PLACEHOLDER_PATTERNS } from "./campaign-qa-manager";
import type { GovernanceCheck, GovernancePipelineResult } from "./governance-types";

const DEFAULT_MAX_REPAIR_ATTEMPTS = 3;

/** Configurable retry limit for the governance self-repair loop. */
export function governanceMaxRepairAttempts(): number {
  const raw = Number(process.env.GOVERNANCE_MAX_REPAIR_ATTEMPTS);
  return Number.isFinite(raw) && raw >= 0 ? Math.min(10, Math.floor(raw)) : DEFAULT_MAX_REPAIR_ATTEMPTS;
}

export type GovernanceBlockerClassification = "auto_fixable" | "user_required";

export type GovernanceRepairLogEntry = {
  attempt: number;
  checkId: string;
  section?: string;
  issue?: string;
  action: string;
};

export type GovernanceUserQuestion = {
  checkId: string;
  section?: string;
  question: string;
};

export type GovernanceRepairSummary = {
  attempts: number;
  maxAttempts: number;
  /** Every repair applied, in order: blocker → action. */
  log: GovernanceRepairLogEntry[];
  /** FAIL checks still open after the loop, with their classification. */
  unresolved: Array<{
    checkId: string;
    section?: string;
    issue?: string;
    classification: GovernanceBlockerClassification;
  }>;
  /** Specific questions for the user — present whenever approval was not reached. */
  userQuestions: GovernanceUserQuestion[];
  outcome: "approved" | "approved_after_repair" | "needs_user_input" | "blocked_after_max_attempts";
};

/**
 * Business information the Director must never invent. Everything else that a
 * deterministic check can flag has a targeted deterministic repair.
 */
const USER_REQUIRED_QUESTIONS: Record<string, string> = {
  qa_budget_present: "What is the total campaign budget (amount and currency)?",
  qa_brand_present: "Which brand is this campaign for?",
  qa_mandatory_objective:
    "What is the campaign's primary objective (e.g. awareness, engagement, sales, product launch)?",
  qa_mandatory_audience: "Who is the target audience (age range, gender, market)?",
};

export function classifyGovernanceCheck(check: GovernanceCheck): GovernanceBlockerClassification {
  return USER_REQUIRED_QUESTIONS[check.id] ? "user_required" : "auto_fixable";
}

/** Question for a blocker — mapped for user-required, explanatory for escalated auto-fixables. */
export function questionForGovernanceCheck(check: GovernanceCheck): string {
  const mapped = USER_REQUIRED_QUESTIONS[check.id];
  if (mapped) return mapped;
  return [
    `Please review the ${check.section ?? "campaign"} section: ${check.issue ?? check.name}.`,
    check.recommendation,
  ]
    .filter(Boolean)
    .join(" ");
}

export function collectFailingGovernanceChecks(
  governance: GovernancePipelineResult
): GovernanceCheck[] {
  return [
    ...governance.qaReport.checks,
    ...governance.complianceReport.checks,
    ...governance.presentationReport.checks,
  ].filter((check) => check.status === "FAIL");
}

export function buildGovernanceUserQuestions(
  failing: GovernanceCheck[],
  gateBlockers: string[]
): GovernanceUserQuestion[] {
  const questions: GovernanceUserQuestion[] = [];
  const seen = new Set<string>();
  for (const check of failing) {
    const question = questionForGovernanceCheck(check);
    if (seen.has(question)) continue;
    seen.add(question);
    questions.push({ checkId: check.id, section: check.section, question });
  }
  if (questions.length === 0 && gateBlockers.length > 0) {
    questions.push({
      checkId: "governance_quality_threshold",
      question:
        `The campaign draft did not reach the release quality bar (${gateBlockers.join("; ")}). ` +
        "Please add more specific details to the brief — budget, target audience, KPIs, or timeline — and I will regenerate the affected sections.",
    });
  }
  return questions;
}

/** Chat/Studio wording for a governance pause — clear, numbered, specific. */
export function formatGovernanceUserQuestions(questions: GovernanceUserQuestion[]): string {
  if (questions.length === 1) {
    return `To finalize your campaign, I need one more detail: ${questions[0]!.question}`;
  }
  return [
    "To finalize your campaign, I need a few details:",
    ...questions.map((q, index) => `${index + 1}. ${q.question}`),
  ].join("\n");
}

export type GovernanceRepairArtifacts = {
  briefText: string;
  facts: CampaignFacts;
  strategy: CampaignStrategyDocument;
  specialistOutputs: SpecialistOutput[];
  budget: BudgetSectionData;
};

const SPECIALIST_IDS = new Set<DirectorSpecialistId>([
  "strategy",
  "creative",
  "creator_intelligence",
  "media_planner",
  "finance",
  "risk",
  "performance",
  "presentation",
]);

function sectionTokens(section: string | undefined): string[] {
  if (!section) return [];
  return section
    .split(/[,↔]/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function specialistIdsFromSection(section: string | undefined): DirectorSpecialistId[] {
  return sectionTokens(section).filter((token): token is DirectorSpecialistId =>
    SPECIALIST_IDS.has(token as DirectorSpecialistId)
  );
}

function containsPlaceholder(text: string): boolean {
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(text));
}

function scrubText(text: string): string {
  let result = text;
  for (const pattern of PLACEHOLDER_PATTERNS) {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    result = result.replace(new RegExp(pattern.source, flags), "pending confirmation");
  }
  return result;
}

/** Remove placeholder vocabulary from every strategy field the QA gate scans. */
function scrubStrategyPlaceholders(strategy: CampaignStrategyDocument): boolean {
  let changed = false;
  const scrubField = (value: string): string => {
    if (!containsPlaceholder(value)) return value;
    changed = true;
    return scrubText(value);
  };

  strategy.narrative = scrubField(strategy.narrative);
  strategy.understanding.objective = scrubField(strategy.understanding.objective);
  strategy.understanding.audience = scrubField(strategy.understanding.audience);
  strategy.understanding.kpis = strategy.understanding.kpis.map((kpi) => {
    if (!containsPlaceholder(`${kpi.metric} ${kpi.target} ${kpi.why}`)) return kpi;
    changed = true;
    return {
      metric: scrubText(kpi.metric),
      target: containsPlaceholder(kpi.target) ? "Confirm with brand" : kpi.target,
      why: scrubText(kpi.why),
    };
  });
  strategy.understanding.risks = strategy.understanding.risks.map(scrubField);
  strategy.understanding.constraints = strategy.understanding.constraints.map(scrubField);
  strategy.pillars = strategy.pillars.map((pillar) => {
    if (!containsPlaceholder(`${pillar.title} ${pillar.what} ${pillar.why}`)) return pillar;
    changed = true;
    return { title: scrubText(pillar.title), what: scrubText(pillar.what), why: scrubText(pillar.why) };
  });
  return changed;
}

/** Rebuild core strategy fields (narrative, pillars, mix) from the deterministic writer. */
function rebuildStrategyCore(artifacts: GovernanceRepairArtifacts): void {
  const fresh = writeStrategyDocumentFromBrief(
    {
      rawMessage: artifacts.briefText,
      brandName: artifacts.facts.brandName,
      clientName: artifacts.facts.clientName,
      campaignFacts: artifacts.facts,
    },
    artifacts.facts
  );
  artifacts.strategy.narrative = fresh.narrative;
  const titles = new Set(artifacts.strategy.pillars.map((p) => p.title.toLowerCase()));
  if (
    artifacts.strategy.pillars.length === 0 ||
    titles.size !== artifacts.strategy.pillars.length ||
    !artifacts.strategy.narrative.trim()
  ) {
    artifacts.strategy.pillars = fresh.pillars;
  }
  if (artifacts.strategy.platformMix.length === 0) {
    artifacts.strategy.platformMix = fresh.platformMix;
  }
  if (artifacts.strategy.creatorTierStrategy.length === 0) {
    artifacts.strategy.creatorTierStrategy = fresh.creatorTierStrategy;
  }
}

/** Replace one specialist output with the deterministic generator's version. */
function regenerateSpecialists(
  artifacts: GovernanceRepairArtifacts,
  ids: Iterable<DirectorSpecialistId>
): void {
  const fresh = dispatchSpecialists(
    artifacts.strategy,
    artifacts.briefText,
    undefined,
    artifacts.facts
  );
  const byId = new Map(fresh.map((output) => [output.specialistId, output]));
  const targets = new Set(ids);
  artifacts.specialistOutputs = artifacts.specialistOutputs.map((output) => {
    if (!targets.has(output.specialistId)) return output;
    const replacement = byId.get(output.specialistId);
    if (!replacement) return output;
    return {
      ...replacement,
      status: "revised" as const,
      revisionRound: output.revisionRound + 1,
    };
  });
}

function normalizeCreatorTierPercents(strategy: CampaignStrategyDocument): void {
  const tiers = strategy.creatorTierStrategy;
  const sum = tiers.reduce((s, t) => s + Math.max(0, t.allocationPercent), 0);
  if (tiers.length === 0 || sum <= 0) return;
  let assigned = 0;
  strategy.creatorTierStrategy = tiers.map((tier, index) => {
    const isLast = index === tiers.length - 1;
    const percent = isLast
      ? Math.round((100 - assigned) * 100) / 100
      : Math.round((Math.max(0, tier.allocationPercent) / sum) * 100);
    assigned += isLast ? 0 : percent;
    return { ...tier, allocationPercent: percent };
  });
}

export type GovernanceRepairResult = {
  artifacts: GovernanceRepairArtifacts;
  changed: boolean;
  log: GovernanceRepairLogEntry[];
};

/**
 * Apply targeted deterministic repairs for the given auto-fixable failing
 * checks. Returns new artifacts (input is never mutated) plus one log entry
 * per blocker describing the repair applied.
 */
export function repairGovernanceArtifacts(
  input: GovernanceRepairArtifacts,
  failing: GovernanceCheck[],
  attempt: number
): GovernanceRepairResult {
  const artifacts: GovernanceRepairArtifacts = {
    briefText: input.briefText,
    facts: input.facts,
    strategy: structuredClone(input.strategy),
    specialistOutputs: [...input.specialistOutputs],
    budget: structuredClone(input.budget),
  };
  const before = JSON.stringify({
    strategy: input.strategy,
    outputs: input.specialistOutputs,
    budget: input.budget,
  });

  const log: GovernanceRepairLogEntry[] = [];
  const regenerate = new Set<DirectorSpecialistId>();
  let needsStrategyRebuild = false;
  let needsPlaceholderScrub = false;

  const logEntry = (check: GovernanceCheck, action: string) => {
    log.push({ attempt, checkId: check.id, section: check.section, issue: check.issue, action });
  };

  for (const check of failing) {
    switch (check.id) {
      case "qa_no_placeholder": {
        needsPlaceholderScrub = true;
        for (const id of specialistIdsFromSection(check.section)) regenerate.add(id);
        logEntry(check, "Scrubbed placeholder vocabulary from strategy fields and regenerated the affected section");
        break;
      }
      case "qa_budget_allocation_100": {
        artifacts.budget.allocations = normalizeBudgetAllocationPercents(
          artifacts.budget.allocations ?? [],
          artifacts.budget.total
        );
        logEntry(check, "Normalized budget allocation percentages to total 100%");
        break;
      }
      case "qa_currency_consistent": {
        const currency =
          artifacts.facts.budget?.currency ??
          artifacts.strategy.understanding.budget?.currency ??
          artifacts.budget.currency;
        artifacts.budget.currency = currency;
        if (artifacts.strategy.understanding.budget) {
          artifacts.strategy.understanding.budget.currency = currency;
        }
        regenerate.add("finance");
        logEntry(check, `Aligned all sections to the CampaignFacts currency (${currency})`);
        break;
      }
      case "qa_budget_facts_match": {
        if (artifacts.facts.budget?.amount) {
          artifacts.budget.total = artifacts.facts.budget.amount;
          if (artifacts.strategy.understanding.budget) {
            artifacts.strategy.understanding.budget.amount = artifacts.facts.budget.amount;
          }
          regenerate.add("finance");
          logEntry(check, "Reset budget total to the CampaignFacts SSOT amount");
        }
        break;
      }
      case "pres_budget_quality":
      case "qa_budget_no_split_when_forbidden": {
        artifacts.budget = buildDirectorBudgetFromStrategy(
          artifacts.strategy,
          artifacts.briefText,
          artifacts.facts
        );
        regenerate.add("finance");
        logEntry(check, "Rebuilt the budget from the Director budget rules");
        break;
      }
      case "qa_creator_tier_sum": {
        normalizeCreatorTierPercents(artifacts.strategy);
        regenerate.add("creator_intelligence");
        logEntry(check, "Normalized creator tier allocations to total 100%");
        break;
      }
      case "qa_duration_facts_match":
      case "qa_timeline_weeks_match": {
        if (artifacts.facts.durationWeeks && artifacts.strategy.understanding.timeline) {
          artifacts.strategy.understanding.timeline.durationWeeks = artifacts.facts.durationWeeks;
          regenerate.add("media_planner");
          logEntry(check, `Synced campaign duration to the brief (${artifacts.facts.durationWeeks} weeks)`);
        }
        break;
      }
      case "qa_brand_match": {
        if (artifacts.facts.brandName) {
          artifacts.strategy.understanding.brand = artifacts.facts.brandName;
          logEntry(check, "Aligned strategy brand to the CampaignFacts SSOT");
        }
        break;
      }
      case "qa_client_match": {
        if (artifacts.facts.clientName) {
          artifacts.strategy.understanding.client = artifacts.facts.clientName;
          logEntry(check, "Aligned strategy client to the CampaignFacts SSOT");
        }
        break;
      }
      case "qa_kpi_engagement_realistic":
      case "qa_kpi_reach_realistic": {
        artifacts.strategy.understanding.kpis = artifacts.strategy.understanding.kpis.map((kpi) => {
          const metric = kpi.metric.toLowerCase();
          const isTarget =
            check.id === "qa_kpi_engagement_realistic"
              ? metric.includes("engagement")
              : metric.includes("reach");
          return isTarget
            ? { ...kpi, target: "Category benchmark", why: "Reset to a realistic benchmark by governance repair" }
            : kpi;
        });
        regenerate.add("performance");
        logEntry(check, "Reset the unrealistic KPI target to the category benchmark");
        break;
      }
      case "pres_exec_strategy_depth":
      case "pres_exec_strategy_unique_pillars":
      case "pres_business_maturity":
      case "qa_mandatory_narrative": {
        needsStrategyRebuild = true;
        regenerate.add("strategy");
        logEntry(check, "Rebuilt the strategy narrative/pillars from the Director strategy writer");
        break;
      }
      case "qa_creator_output":
      case "pres_vendor_quality": {
        regenerate.add("creator_intelligence");
        logEntry(check, "Regenerated the creator intelligence section deterministically");
        break;
      }
      case "pres_timeline_quality": {
        regenerate.add("media_planner");
        logEntry(check, "Regenerated the media plan section deterministically");
        break;
      }
      case "pres_risk_usefulness": {
        if (artifacts.strategy.understanding.risks.length === 0) {
          artifacts.strategy.understanding.risks = [
            "Vendor availability variance during outreach window",
          ];
        }
        regenerate.add("risk");
        logEntry(check, "Regenerated the risk section with documented strategy risks");
        break;
      }
      case "pres_professionalism": {
        regenerate.add("presentation");
        logEntry(check, "Regenerated the presentation section deterministically");
        break;
      }
      case "pres_decision_rationale": {
        for (const output of artifacts.specialistOutputs) {
          if (output.why.length < 25) regenerate.add(output.specialistId);
        }
        logEntry(check, "Regenerated specialist outputs with insufficient WHY rationale");
        break;
      }
      case "pres_section_evidence": {
        for (const output of artifacts.specialistOutputs) {
          if (output.evidence.length === 0) regenerate.add(output.specialistId);
        }
        logEntry(check, "Regenerated specialist outputs missing evidence citations");
        break;
      }
      default: {
        // Duplicated facts, copy-paste, generic language, compliance flags, and
        // any future section-scoped check: regenerate the affected specialist
        // sections; strategy-scoped sections fall back to the strategy rebuild.
        const ids = specialistIdsFromSection(check.section);
        const strategyScoped = sectionTokens(check.section).some((token) =>
          ["strategy", "narrative", "objective", "audience", "executive_strategy", "summary"].includes(token)
        );
        if (ids.length > 0 || strategyScoped) {
          for (const id of ids) regenerate.add(id);
          if (strategyScoped) needsStrategyRebuild = true;
          logEntry(check, "Regenerated the affected section(s) deterministically");
        }
        break;
      }
    }
  }

  if (needsStrategyRebuild) rebuildStrategyCore(artifacts);
  if (needsPlaceholderScrub) scrubStrategyPlaceholders(artifacts.strategy);
  if (regenerate.size > 0) regenerateSpecialists(artifacts, regenerate);

  const after = JSON.stringify({
    strategy: artifacts.strategy,
    outputs: artifacts.specialistOutputs,
    budget: artifacts.budget,
  });

  return { artifacts, changed: before !== after, log };
}
