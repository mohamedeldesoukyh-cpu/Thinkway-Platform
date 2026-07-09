import type { GovernanceCheck, GovernanceReport, GovernanceValidationInput } from "./governance-types";

const FABRICATED_COMPLIANCE_PATTERNS = [
  /\bgdpr\s+certified\b/i,
  /\biso\s+27001\s+approved\b/i,
  /\bregulatory\s+approval\s+obtained\b/i,
  /\bfully\s+compliant\s+with\s+all\s+laws\b/i,
  /\bno\s+legal\s+risk\b/i,
  /\bguaranteed\s+compliance\b/i,
];

const SENSITIVE_CATEGORIES = [
  "finance",
  "banking",
  "healthcare",
  "pharma",
  "alcohol",
  "gambling",
  "tobacco",
  "children",
  "baby",
  "political",
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

/**
 * Compliance Gate — regulatory/sensitivity checks from risk data + facts constraints.
 * Does not fabricate compliance claims.
 */
export function runComplianceGate(input: GovernanceValidationInput): GovernanceReport {
  const { facts, strategy, specialistOutputs } = input;
  const checks: GovernanceCheck[] = [];
  const allText = [
    strategy.narrative,
    ...strategy.understanding.risks,
    ...strategy.understanding.constraints,
    ...(facts.constraints ?? []),
    ...(facts.risks ?? []),
    ...specialistOutputs.map((o) => o.what),
  ].join("\n");

  let fabricatedClaim = false;
  for (const pattern of FABRICATED_COMPLIANCE_PATTERNS) {
    if (pattern.test(allText)) {
      fabricatedClaim = true;
      checks.push(
        check("compliance_no_fabricated_claims", "No fabricated compliance claims", false, {
          section: "operations",
          issue: `Unverified compliance claim detected: ${pattern.source}`,
          recommendation: "Remove absolute compliance claims; cite known constraints only",
        })
      );
    }
  }
  if (!fabricatedClaim) {
    checks.push(check("compliance_no_fabricated_claims", "No fabricated compliance claims", true));
  }

  const industryLower = (facts.industry ?? strategy.understanding.industry ?? "").toLowerCase();
  const brandLower = (facts.brandName ?? strategy.understanding.brand ?? "").toLowerCase();
  const objectiveLower = strategy.understanding.objective.toLowerCase();

  const sensitiveHits = SENSITIVE_CATEGORIES.filter(
    (cat) =>
      industryLower.includes(cat) ||
      brandLower.includes(cat) ||
      objectiveLower.includes(cat) ||
      allText.toLowerCase().includes(cat)
  );

  if (sensitiveHits.length > 0) {
    const hasRiskAcknowledgment = strategy.understanding.risks.length > 0 || (facts.risks?.length ?? 0) > 0;
    checks.push(
      check("compliance_sensitive_category", "Sensitive category risks acknowledged", hasRiskAcknowledgment, {
        warn: !hasRiskAcknowledgment,
        section: "operations",
        issue: `Sensitive categories detected (${sensitiveHits.join(", ")}) without documented risks`,
        recommendation: "Document regulatory/sensitivity constraints in risk section",
      })
    );

    const hasConstraints = strategy.understanding.constraints.length > 0 || (facts.constraints?.length ?? 0) > 0;
    checks.push(
      check("compliance_sensitive_constraints", "Sensitive category constraints documented", hasConstraints, {
        warn: !hasConstraints,
        section: "operations",
        issue: "Missing compliance constraints for sensitive category",
        recommendation: "Add age-gating, disclosure, or market-specific constraints",
      })
    );
  } else {
    checks.push(check("compliance_sensitive_category", "Sensitive category risks acknowledged", true));
  }

  if ((facts.risks?.length ?? 0) > 0) {
    const strategyRiskText = strategy.understanding.risks.join(" ").toLowerCase();
    const factsRisksReflected = facts.risks!.some((r) => strategyRiskText.includes(r.toLowerCase().slice(0, 15)));
    checks.push(
      check("compliance_facts_risks_reflected", "CampaignFacts risks reflected in strategy", factsRisksReflected, {
        warn: !factsRisksReflected,
        section: "operations",
        issue: "Brief risks not reflected in strategy risk list",
        recommendation: "Carry brief-identified risks into operations section",
      })
    );
  }

  if ((facts.constraints?.length ?? 0) > 0) {
    const constraintText = [
      ...strategy.understanding.constraints,
      strategy.narrative,
      ...specialistOutputs.map((o) => o.why),
    ]
      .join(" ")
      .toLowerCase();

    const unaddressed = facts.constraints!.filter(
      (c) => !constraintText.includes(c.toLowerCase().slice(0, 12))
    );

    checks.push(
      check(
        "compliance_constraints_addressed",
        "Brief constraints addressed in strategy",
        unaddressed.length === 0,
        {
          warn: unaddressed.length <= 1,
          section: "operations",
          issue: unaddressed.length ? `Unaddressed constraints: ${unaddressed.join("; ")}` : undefined,
          recommendation: "Reference each brief constraint in strategy or specialist rationale",
        }
      )
    );
  }

  if (facts.geography?.some((g) => /uae|saudi|egypt|gcc|mena/i.test(g))) {
    const hasGeoRisk = allText.toLowerCase().match(/local|regulation|market|compliance|disclosure/);
    checks.push(
      check("compliance_geo_regulatory", "Geography-specific regulatory awareness", Boolean(hasGeoRisk), {
        warn: !hasGeoRisk,
        section: "operations",
        issue: "MENA/GCC market without regulatory awareness language",
        recommendation: "Note market-specific advertising/disclosure requirements",
      })
    );
  }

  const riskOutput = specialistOutputs.find((o) => o.specialistId === "risk");
  checks.push(
    check("compliance_risk_specialist", "Risk specialist assessment present", Boolean(riskOutput?.what?.trim()), {
      section: "operations",
      issue: "Missing risk specialist output",
      recommendation: "Risk specialist must assess compliance exposure",
    })
  );

  return {
    reportId: `compliance-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    checks,
    summary: summarize(checks),
  };
}
