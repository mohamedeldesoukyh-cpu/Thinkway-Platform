import type { GovernanceCheck, GovernanceReport, GovernanceValidationInput } from "./governance-types";
import {
  detectCrossSectionCopyPaste,
  detectGenericPhrases,
  detectPriorCampaignCopyPaste,
} from "./generic-language-detector";

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
    severity: passed ? undefined : opts?.warn ? "low" : "high",
    recommendation: passed ? undefined : opts?.recommendation,
  };
}

function buildSectionMap(input: GovernanceValidationInput): Record<string, string> {
  const { strategy, specialistOutputs } = input;
  const map: Record<string, string> = {
    executive_strategy: strategy.narrative,
    strategy: strategy.narrative,
    audience: strategy.understanding.audience,
    objective: strategy.understanding.objective,
  };

  for (const output of specialistOutputs) {
    map[output.specialistId] = `${output.what}\n${output.why}`;
  }

  const presentation = specialistOutputs.find((o) => o.specialistId === "presentation");
  if (presentation) {
    map.presentation = presentation.what;
  }

  return map;
}

/**
 * Presentation Validator — Marketing Director review checks (deterministic, no LLM).
 */
export function runPresentationValidator(input: GovernanceValidationInput): GovernanceReport {
  const { strategy, specialistOutputs, budget, priorCampaignTexts } = input;
  const checks: GovernanceCheck[] = [];
  const sections = buildSectionMap(input);

  // Executive strategy uniqueness — narrative length and pillar differentiation
  const narrativeWords = strategy.narrative.split(/\s+/).filter(Boolean);
  checks.push(
    check(
      "pres_exec_strategy_depth",
      "Executive strategy sufficient depth",
      narrativeWords.length >= 40,
      {
        warn: narrativeWords.length >= 25,
        section: "strategy",
        issue: `Strategy narrative only ${narrativeWords.length} words`,
        recommendation: "Expand executive strategy with brand-specific context",
      }
    )
  );

  const pillarTitles = strategy.pillars.map((p) => p.title.toLowerCase());
  const uniquePillars = new Set(pillarTitles);
  checks.push(
    check(
      "pres_exec_strategy_unique_pillars",
      "Executive strategy pillars are distinct",
      uniquePillars.size === pillarTitles.length,
      {
        section: "strategy",
        issue: "Duplicate strategic pillar titles detected",
        recommendation: "Each pillar should address a distinct strategic angle",
      }
    )
  );

  // Timeline quality
  const mediaOutput = specialistOutputs.find((o) => o.specialistId === "media_planner");
  checks.push(
    check(
      "pres_timeline_quality",
      "Timeline specialist provides actionable phases",
      Boolean(mediaOutput?.what?.trim()) && (mediaOutput?.what.length ?? 0) >= 30,
      {
        section: "timeline",
        issue: "Timeline lacks actionable phase detail",
        recommendation: "Media planner must define week-by-week creator activation",
      }
    )
  );

  // Budget quality
  checks.push(
    check(
      "pres_budget_quality",
      "Budget allocations documented with rationale",
      (budget.allocations?.length ?? 0) >= 2 &&
        budget.allocations!.every((a) => Boolean(a.category && a.percent != null)),
      {
        section: "budget",
        issue: "Budget missing category breakdown or percentages",
        recommendation: "Finance must provide categorized allocation with percentages",
      }
    )
  );

  // Vendor quality
  const creatorOutput = specialistOutputs.find((o) => o.specialistId === "creator_intelligence");
  checks.push(
    check(
      "pres_vendor_quality",
      "Vendor/creator recommendations include rationale",
      Boolean(creatorOutput?.why?.trim()) && creatorOutput!.why.length >= 20,
      {
        section: "creators",
        issue: "Creator recommendations lack WHY rationale",
        recommendation: "Creator intelligence must explain tier mix decisions",
      }
    )
  );

  // Industry benchmark usefulness
  const perfOutput = specialistOutputs.find((o) => o.specialistId === "performance");
  const hasBenchmarkLanguage =
    Boolean(perfOutput?.what?.match(/benchmark|industry|average|typical|baseline/i)) ||
    strategy.understanding.kpis.some((k) => k.why.length > 10);
  checks.push(
    check(
      "pres_industry_benchmark",
      "Industry benchmarks referenced in KPIs",
      hasBenchmarkLanguage,
      {
        warn: !hasBenchmarkLanguage,
        section: "performance",
        issue: "KPIs lack industry benchmark context",
        recommendation: "Anchor KPI targets to category benchmarks",
      }
    )
  );

  // Risk usefulness
  const riskOutput = specialistOutputs.find((o) => o.specialistId === "risk");
  checks.push(
    check(
      "pres_risk_usefulness",
      "Risk assessment actionable",
      Boolean(riskOutput?.what?.trim()) && strategy.understanding.risks.length > 0,
      {
        warn: strategy.understanding.risks.length === 0,
        section: "operations",
        issue: "Risk section lacks identified risks",
        recommendation: "Document top 2–3 campaign risks with mitigation",
      }
    )
  );

  // Decision rationale quality
  const rationaleOutputs = specialistOutputs.filter((o) => o.why.length >= 25);
  checks.push(
    check(
      "pres_decision_rationale",
      "Specialist decision rationales substantive",
      rationaleOutputs.length >= 3,
      {
        warn: rationaleOutputs.length >= 2,
        section: "strategy",
        issue: `Only ${rationaleOutputs.length} specialists provide substantive WHY`,
        recommendation: "Each specialist must tie recommendations to strategy pillars",
      }
    )
  );

  // Presentation professionalism
  const presentationOutput = specialistOutputs.find((o) => o.specialistId === "presentation");
  checks.push(
    check(
      "pres_professionalism",
      "Presentation section client-ready",
      Boolean(presentationOutput?.what?.trim()) && !/draft|wip|placeholder/i.test(presentationOutput!.what),
      {
        section: "presentation",
        issue: "Presentation section not client-ready",
        recommendation: "Presentation specialist must produce approval-ready summary",
      }
    )
  );

  // Generic language detection
  const genericFindings = detectGenericPhrases(sections);
  if (genericFindings.length === 0) {
    checks.push(check("pres_no_generic_language", "No generic marketing language", true));
  } else if (genericFindings.length <= 2) {
    checks.push(
      check("pres_no_generic_language", "No generic marketing language", false, {
        warn: true,
        section: genericFindings[0]!.section,
        issue: `Generic phrases: ${genericFindings.map((f) => f.phrase).slice(0, 3).join(", ")}`,
        recommendation: "Replace boilerplate with brand-specific language",
      })
    );
  } else {
    checks.push(
      check("pres_no_generic_language", "No generic marketing language", false, {
        section: genericFindings[0]!.section,
        issue: `${genericFindings.length} generic phrases detected`,
        recommendation: "Remove leverage/synergy/best-in-class boilerplate",
      })
    );
  }

  // Copy-paste detection across sections
  const copyPaste = detectCrossSectionCopyPaste(sections);
  if (copyPaste.length === 0) {
    checks.push(check("pres_no_copy_paste", "No cross-section copy-paste", true));
  } else {
    checks.push(
      check("pres_no_copy_paste", "No cross-section copy-paste", false, {
        section: `${copyPaste[0]!.sectionA} ↔ ${copyPaste[0]!.sectionB}`,
        issue: `Sections ${copyPaste[0]!.similarity * 100}% similar`,
        recommendation: "Differentiate section content; avoid repeating paragraphs",
      })
    );
  }

  if (priorCampaignTexts?.length) {
    const priorCopy = detectPriorCampaignCopyPaste(sections, priorCampaignTexts);
    checks.push(
      check(
        "pres_no_prior_campaign_copy",
        "No copy-paste from prior campaigns",
        priorCopy.length === 0,
        {
          warn: priorCopy.length <= 1,
          section: priorCopy[0]?.section,
          issue: priorCopy.length
            ? `${priorCopy.length} section(s) match prior campaign text`
            : undefined,
          recommendation: "Tailor content to current brief; do not recycle prior campaigns",
        }
      )
    );
  }

  // Section usefulness — each specialist has evidence
  const withEvidence = specialistOutputs.filter((o) => o.evidence.length >= 1);
  checks.push(
    check(
      "pres_section_evidence",
      "Sections backed by evidence citations",
      withEvidence.length >= specialistOutputs.length * 0.5,
      {
        warn: withEvidence.length >= 2,
        section: "strategy",
        issue: "Insufficient evidence citations across specialist outputs",
        recommendation: "Each specialist should cite brief or strategy evidence",
      }
    )
  );

  // Business maturity — platform mix and creator tiers defined
  checks.push(
    check(
      "pres_business_maturity",
      "Platform mix and creator tiers defined",
      strategy.platformMix.length >= 1 && strategy.creatorTierStrategy.length >= 1,
      {
        section: "strategy",
        issue: "Missing platform mix or creator tier strategy",
        recommendation: "Director strategy must define channel and tier architecture",
      }
    )
  );

  return {
    reportId: `presentation-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    checks,
    summary: summarize(checks),
  };
}
