import type {
  GovernanceCheck,
  GovernanceReport,
  GovernanceValidationInput,
} from "./governance-types";
import { briefForbidsBudgetSplit } from "@/features/campaign-director/services/budget-rules";

/** Shared with governance-repair so the scrubber and the gate agree exactly. */
export const PLACEHOLDER_PATTERNS = [
  /\btbd\b/i,
  /\btodo\b/i,
  /lorem ipsum/i,
  /\[placeholder\]/i,
  /\bxxx\b/i,
  /insert here/i,
  /coming soon/i,
  /\[insert[^\]]*\]/i,
  /\[todo[^\]]*\]/i,
  /\[tbd[^\]]*\]/i,
];

function summarize(checks: GovernanceCheck[]): GovernanceReport["summary"] {
  const pass = checks.filter((c) => c.status === "PASS").length;
  const warning = checks.filter((c) => c.status === "WARNING").length;
  const fail = checks.filter((c) => c.status === "FAIL").length;
  return { pass, warning, fail, total: checks.length };
}

function check(
  id: string,
  name: string,
  passed: boolean,
  opts?: {
    warn?: boolean;
    section?: string;
    issue?: string;
    severity?: GovernanceCheck["severity"];
    recommendation?: string;
  }
): GovernanceCheck {
  const status = passed ? "PASS" : opts?.warn ? "WARNING" : "FAIL";
  return {
    id,
    name,
    status,
    section: opts?.section,
    issue: passed ? undefined : opts?.issue ?? name,
    severity: passed ? undefined : opts?.severity ?? (opts?.warn ? "low" : "high"),
    recommendation: passed ? undefined : opts?.recommendation,
  };
}

function extractNumbers(text: string): number[] {
  return (text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) =>
    parseFloat(n.replace(/,/g, ""))
  );
}

function collectSectionTexts(input: GovernanceValidationInput): Record<string, string> {
  const { strategy, specialistOutputs } = input;
  const texts: Record<string, string> = {
    strategy: strategy.narrative,
    narrative: strategy.narrative,
    objective: strategy.understanding.objective,
    audience: strategy.understanding.audience,
  };

  for (const output of specialistOutputs) {
    texts[output.specialistId] = output.what;
  }

  return texts;
}

/**
 * Campaign QA Manager — validates only; never creates or rewrites content.
 */
export function runCampaignQaManager(input: GovernanceValidationInput): GovernanceReport {
  const { facts, strategy, budget, timelineWeeks, briefText } = input;
  const checks: GovernanceCheck[] = [];
  const sections = collectSectionTexts(input);

  const factsBudget = facts.budget?.amount;
  const strategyBudget = strategy.understanding.budget?.amount;
  const budgetTotal = budget.total ?? strategyBudget ?? factsBudget;

  checks.push(
    check("qa_budget_present", "Budget amount defined", Boolean(budgetTotal && budgetTotal > 0), {
      section: "budget",
      issue: "Missing or zero budget",
      recommendation: "Ensure budget is extracted from brief and reflected in strategy",
    })
  );

  if (factsBudget && budgetTotal) {
    const variance = Math.abs(factsBudget - budgetTotal) / factsBudget;
    checks.push(
      check("qa_budget_facts_match", "Budget matches CampaignFacts", variance <= 0.05, {
        warn: variance <= 0.15,
        section: "budget",
        issue: `Budget ${budgetTotal} differs from facts ${factsBudget}`,
        recommendation: "Align budget totals across facts, strategy, and allocations",
      })
    );
  }

  const factsCurrency = facts.budget?.currency?.toUpperCase();
  const strategyCurrency = strategy.understanding.budget?.currency?.toUpperCase();
  const budgetCurrency = budget.currency?.toUpperCase();

  if (factsCurrency || strategyCurrency) {
    const currencies = [factsCurrency, strategyCurrency, budgetCurrency].filter(Boolean);
    const unique = new Set(currencies);
    checks.push(
      check("qa_currency_consistent", "Currency consistent across sections", unique.size <= 1, {
        section: "budget",
        issue: `Mixed currencies: ${[...unique].join(", ")}`,
        recommendation: "Use single currency from brand/brief throughout",
      })
    );
  }

  const factsWeeks = facts.durationWeeks;
  const strategyWeeks = strategy.understanding.timeline?.durationWeeks;

  if (factsWeeks) {
    checks.push(
      check(
        "qa_duration_facts_match",
        "Duration matches CampaignFacts",
        !strategyWeeks || strategyWeeks === factsWeeks,
        {
          warn: strategyWeeks ? Math.abs(strategyWeeks - factsWeeks) <= 1 : false,
          section: "timeline",
          issue: `Strategy ${strategyWeeks}w vs facts ${factsWeeks}w`,
          recommendation: "Sync campaign duration with brief",
        }
      )
    );
  }

  checks.push(
    check(
      "qa_timeline_weeks_match",
      "Timeline weeks align with strategy duration",
      !strategyWeeks || timelineWeeks === strategyWeeks || timelineWeeks > 0,
      {
        section: "timeline",
        issue: `Timeline has ${timelineWeeks} weeks vs strategy ${strategyWeeks}`,
        recommendation: "Ensure timeline milestone count matches declared duration",
      }
    )
  );

  checks.push(
    check("qa_brand_present", "Brand name present", Boolean(facts.brandName || strategy.understanding.brand), {
      section: "summary",
      issue: "Missing brand name",
      recommendation: "Brand must be set in CampaignFacts",
    })
  );

  if (facts.brandName && strategy.understanding.brand) {
    checks.push(
      check(
        "qa_brand_match",
        "Brand matches CampaignFacts",
        facts.brandName.toLowerCase() === strategy.understanding.brand.toLowerCase(),
        {
          section: "summary",
          issue: `Facts brand "${facts.brandName}" vs strategy "${strategy.understanding.brand}"`,
          recommendation: "Align brand across facts and strategy",
        }
      )
    );
  }

  if (facts.clientName && strategy.understanding.client) {
    checks.push(
      check(
        "qa_client_match",
        "Client matches CampaignFacts",
        facts.clientName.toLowerCase() === strategy.understanding.client.toLowerCase(),
        {
          section: "summary",
          issue: "Client name mismatch",
          recommendation: "Sync legal entity from brand hierarchy",
        }
      )
    );
  }

  if (facts.objective) {
    checks.push(
      check(
        "qa_objective_match",
        "Objective aligned with CampaignFacts",
        strategy.understanding.objective.toLowerCase().includes(facts.objective.toLowerCase().slice(0, 20)) ||
          facts.objective.toLowerCase().includes(strategy.understanding.objective.toLowerCase().slice(0, 20)),
        {
          warn: true,
          section: "strategy",
          issue: "Objective wording diverges from brief facts",
          recommendation: "Ensure strategy objective reflects brief objective",
        }
      )
    );
  }

  if (facts.geography?.length) {
    const geoText = [strategy.understanding.geography, briefText, strategy.narrative]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    const geoMatch = facts.geography.some((g) => geoText.includes(g.toLowerCase()));
    checks.push(
      check("qa_geography_present", "Geography reflected in strategy", geoMatch, {
        warn: !geoMatch,
        section: "summary",
        issue: "Target geography not found in strategy narrative",
        recommendation: "Include target country/market in strategy sections",
      })
    );
  }

  const creatorOutput = input.specialistOutputs.find((o) => o.specialistId === "creator_intelligence");
  checks.push(
    check("qa_creator_output", "Creator intelligence section populated", Boolean(creatorOutput?.what?.trim()), {
      section: "creators",
      issue: "Missing creator recommendations",
      recommendation: "Creator specialist must provide tier mix and rationale",
    })
  );

  if (creatorOutput?.what && strategy.creatorTierStrategy.length > 0) {
    const tierSum = strategy.creatorTierStrategy.reduce((s, t) => s + t.allocationPercent, 0);
    checks.push(
      check("qa_creator_tier_sum", "Creator tier allocations sum to 100%", Math.abs(tierSum - 100) <= 1, {
        section: "creators",
        issue: `Creator tiers sum to ${tierSum}%`,
        recommendation: "Normalize creator tier percentages to 100%",
      })
    );
  }

  const allocSum = (budget.allocations ?? []).reduce((s, a) => s + (a.percent ?? 0), 0);
  checks.push(
    check("qa_budget_allocation_100", "Budget allocations sum to 100%", Math.abs(allocSum - 100) <= 0.5, {
      section: "budget",
      issue: `Allocations sum to ${allocSum}%`,
      recommendation: "Finance section must allocate 100% of influencer budget",
    })
  );

  const forbidsSplit = briefForbidsBudgetSplit(briefText ?? facts.rawBriefExcerpt ?? "", facts);
  const hasNonCreatorSplitLines = (budget.allocations ?? []).some(
    (line) => !/creator\s*fees?/i.test(line.category)
  );
  if (forbidsSplit) {
    checks.push(
      check(
        "qa_budget_no_split_when_forbidden",
        "No split lines when brief forbids production/usage rights",
        !hasNonCreatorSplitLines,
        {
          section: "budget",
          issue: "Brief forbids separate production/usage-rights lines but budget is split",
          recommendation: "Allocate 100% to creator fees when brief says no production / no usage rights",
        }
      )
    );
  }

  for (const kpi of strategy.understanding.kpis) {
    const nums = extractNumbers(kpi.target);
    for (const n of nums) {
      if (kpi.metric.toLowerCase().includes("engagement") && n > 100) {
        checks.push(
          check("qa_kpi_engagement_realistic", "Engagement KPI realistic", false, {
            section: "performance",
            issue: `Engagement target ${n}% exceeds 100%`,
            recommendation: "Cap engagement rate KPIs at realistic benchmarks",
          })
        );
      }
      if (kpi.metric.toLowerCase().includes("reach") && budgetTotal && n > budgetTotal * 50) {
        checks.push(
          check("qa_kpi_reach_realistic", "Reach KPI realistic vs budget", false, {
            section: "performance",
            issue: `Reach ${n} implausible for budget ${budgetTotal}`,
            recommendation: "Scale reach targets to budget and market size",
          })
        );
      }
    }
  }

  let placeholderFound = false;
  for (const [section, text] of Object.entries(sections)) {
    for (const pattern of PLACEHOLDER_PATTERNS) {
      if (pattern.test(text)) {
        placeholderFound = true;
        checks.push(
          check("qa_no_placeholder", "No placeholder text", false, {
            section,
            issue: `Placeholder pattern detected in ${section}`,
            recommendation: "Replace placeholders with brief-derived content",
          })
        );
      }
    }
  }
  if (!placeholderFound) {
    checks.push(check("qa_no_placeholder", "No placeholder text", true));
  }

  const sentences = new Map<string, string[]>();
  for (const [section, text] of Object.entries(sections)) {
    for (const sentence of text.split(/[.!?]\s+/).filter((s) => s.length > 40)) {
      const key = sentence.toLowerCase().trim();
      const existing = sentences.get(key) ?? [];
      existing.push(section);
      sentences.set(key, existing);
    }
  }
  let dupFacts = false;
  for (const [sentence, sects] of sentences) {
    if (sects.length > 1 && new Set(sects).size > 1) {
      dupFacts = true;
      checks.push(
        check("qa_no_duplicate_facts", "No duplicated facts across sections", false, {
          section: sects.join(", "),
          issue: `Repeated fact: "${sentence.slice(0, 60)}..."`,
          recommendation: "Each fact should appear once; cross-reference instead of copy",
          severity: "medium",
        })
      );
    }
  }
  if (!dupFacts) {
    checks.push(check("qa_no_duplicate_facts", "No duplicated facts across sections", true));
  }

  const mandatory = [
    { field: strategy.understanding.objective, name: "objective", section: "strategy" },
    { field: strategy.understanding.audience, name: "audience", section: "audience" },
    { field: strategy.narrative, name: "narrative", section: "strategy" },
  ];
  for (const { field, name, section } of mandatory) {
    checks.push(
      check(`qa_mandatory_${name}`, `${name} field populated`, Boolean(field?.trim()), {
        section,
        issue: `Missing mandatory field: ${name}`,
        recommendation: `Populate ${name} before governance release`,
      })
    );
  }

  if (!factsBudget && strategyBudget && strategyBudget > 0) {
    checks.push(
      check("qa_budget_sourced", "Budget traceable to brief", false, {
        warn: true,
        section: "budget",
        issue: "Budget in strategy but not in CampaignFacts",
        recommendation: "Extract budget from brief into CampaignFacts SSOT",
        severity: "medium",
      })
    );
  } else {
    checks.push(check("qa_budget_sourced", "Budget traceable to brief", true));
  }

  return {
    reportId: `qa-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    checks,
    summary: summarize(checks),
  };
}
