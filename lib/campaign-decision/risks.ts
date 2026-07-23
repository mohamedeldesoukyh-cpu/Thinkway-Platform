import type { CampaignForecast } from "@/lib/campaign-forecast";
import type { CampaignOptimizationReport } from "@/lib/campaign-optimization";

import type { CampaignConfiguration, CampaignDecisionReport, CampaignRisk, RiskCategory } from "./types";

function overlapRatio(forecast: CampaignForecast): number {
  return forecast.grossReach > 0 ? forecast.overlapDeduction / forecast.grossReach : 0;
}

function topCreatorReachShare(forecast: CampaignForecast): number {
  if (forecast.estimatedReach <= 0) return 0;
  const top = Math.max(...forecast.creatorForecasts.map((c) => c.estimatedReach), 0);
  return top / forecast.estimatedReach;
}

export function detectCampaignRisks(input: {
  forecast: CampaignForecast;
  optimization: CampaignOptimizationReport;
  configuration?: CampaignConfiguration;
}): CampaignRisk[] {
  const { forecast, optimization, configuration } = input;
  const risks: CampaignRisk[] = [];
  let riskIndex = 1;

  const add = (risk: Omit<CampaignRisk, "id">) => {
    risks.push({ ...risk, id: `risk_${riskIndex++}` });
  };

  const overlap = overlapRatio(forecast);
  if (overlap >= 0.18) {
    add({
      category: "reach",
      severity: overlap >= 0.28 ? "high" : "medium",
      title: "Heavy audience overlap",
      businessImpact: "Net reach underperforms gross audience — paid spend reaches duplicate audiences.",
      mitigation: "Replace overlapping creators or diversify niche mix before launch.",
      triggeredMetrics: ["overlapDeduction", "grossReach", "estimatedReach"],
      evidence: [
        `Overlap ratio ${(overlap * 100).toFixed(1)}% deducts ${forecast.overlapDeduction.toLocaleString()} reach.`,
      ],
    });
  }

  if (forecast.confidenceScore.score < 60) {
    add({
      category: "reach",
      severity: forecast.confidenceScore.score < 40 ? "high" : "medium",
      title: "Low forecast confidence",
      businessImpact: "KPI projections may deviate significantly from actual campaign performance.",
      mitigation: "Enrich creator data or add creators with verified historical performance.",
      triggeredMetrics: ["confidenceScore"],
      evidence: [`Forecast confidence ${forecast.confidenceScore.score}/100 (${forecast.confidenceScore.label}).`],
    });
  }

  const budget = configuration?.commercial?.budget?.amount ?? 0;
  if (budget > 0 && forecast.estimatedReach > 0) {
    const costPerReach = budget / forecast.estimatedReach;
    if (costPerReach > 0.02) {
      add({
        category: "budget",
        severity: costPerReach > 0.035 ? "high" : "medium",
        title: "Poor cost efficiency",
        businessImpact: "Budget may not deliver competitive reach relative to spend.",
        mitigation: "Rebalance toward micro creators or reduce overlap to improve cost per reach.",
        triggeredMetrics: ["budget.amount", "estimatedReach"],
        evidence: [`Cost per reach ${costPerReach.toFixed(4)} ${configuration?.commercial?.budget?.currency ?? ""}.`],
      });
    }
  }

  if (configuration?.commercial?.gpHealth === "critical") {
    add({
      category: "budget",
      severity: "high",
      title: "Commercial margin at risk",
      businessImpact: "Campaign may fail commercial approval or erode agency margin.",
      mitigation: "Review pricing, creator fees, or scope before client approval.",
      triggeredMetrics: ["commercial.gpHealth"],
      evidence: ["GP health flagged critical in commercial intelligence."],
    });
  }

  const reachShare = topCreatorReachShare(forecast);
  if (reachShare >= 0.45 && forecast.creatorForecasts.length > 1) {
    const top = [...forecast.creatorForecasts].sort((a, b) => b.estimatedReach - a.estimatedReach)[0];
    add({
      category: "creator",
      severity: reachShare >= 0.6 ? "high" : "medium",
      title: "Overreliance on one creator",
      businessImpact: "Campaign performance hinges on a single creator — elevated delivery and brand risk.",
      mitigation: `Diversify reach away from ${top?.displayName ?? top?.handle ?? "top creator"}.`,
      triggeredMetrics: ["creator.estimatedReach"],
      evidence: [`Top creator contributes ${Math.round(reachShare * 100)}% of net reach.`],
    });
  }

  const genericStrategyCount = forecast.creatorForecasts.filter(
    (c) =>
      c.primaryForecastStrategy === "platform_benchmark" ||
      c.primaryForecastStrategy === "generic_multiplier"
  ).length;
  if (genericStrategyCount >= Math.ceil(forecast.creatorForecasts.length * 0.5)) {
    add({
      category: "creator",
      severity: "medium",
      title: "Missing historical performance",
      businessImpact: "Forecasts rely on benchmarks — actual results may vary widely.",
      mitigation: "Prioritize creators with campaign or enrichment history before approval.",
      triggeredMetrics: ["primaryForecastStrategy"],
      evidence: [`${genericStrategyCount}/${forecast.creatorForecasts.length} creators use benchmark/generic strategies.`],
    });
  }

  const audienceOpp = optimization.opportunities.find((o) => o.category === "audience" && o.impact !== "low");
  if (audienceOpp) {
    add({
      category: "audience",
      severity: audienceOpp.impact === "high" ? "high" : "medium",
      title: audienceOpp.title,
      businessImpact: "Target audience coverage or engagement quality may miss brief objectives.",
      mitigation: optimization.recommendations.find((r) => r.opportunityId === audienceOpp.id)?.action ??
        "Align creators to brief geography, language, and interest targets.",
      triggeredMetrics: audienceOpp.triggeredMetrics,
      evidence: [audienceOpp.summary],
    });
  }

  if (optimization.diagnostics.limitedAudienceSignals) {
    add({
      category: "audience",
      severity: "low",
      title: "Limited audience intelligence",
      businessImpact: "Demographic and interest alignment cannot be fully validated pre-launch.",
      mitigation: "Add audience targets to campaign configuration and enrich creator DNA.",
      triggeredMetrics: ["audienceTargets"],
      evidence: ["Optimization diagnostics flagged limited audience signals."],
    });
  }

  const operational = configuration?.operational;
  if (operational?.deliverablesDefined === false) {
    add({
      category: "operational",
      severity: "high",
      title: "Missing deliverables",
      businessImpact: "Execution team cannot schedule content or assign PO units.",
      mitigation: "Define deliverables on all campaign lines before launch approval.",
      triggeredMetrics: ["operational.deliverablesDefined"],
      evidence: ["Deliverables not marked as defined in operational intelligence."],
    });
  }

  if ((operational?.unenrichedCreatorCount ?? 0) > 0) {
    add({
      category: "operational",
      severity: "medium",
      title: "Incomplete creator data",
      businessImpact: "Slate includes creators pending intelligence refresh — forecasts less reliable.",
      mitigation: "Complete enrichment or replace unverified creators.",
      triggeredMetrics: ["operational.unenrichedCreatorCount"],
      evidence: [`${operational!.unenrichedCreatorCount} creator(s) pending enrichment.`],
    });
  }

  for (const missing of operational?.planMandatoryMissing ?? []) {
    add({
      category: "operational",
      severity: "medium",
      title: `Plan gap: ${missing}`,
      businessImpact: "Campaign plan incomplete — approval may precede missing strategic inputs.",
      mitigation: `Complete ${missing} before executive sign-off.`,
      triggeredMetrics: ["planMandatoryMissing"],
      evidence: [`Mandatory plan item missing: ${missing}.`],
    });
  }

  for (const missing of operational?.operationalMandatoryMissing ?? []) {
    add({
      category: "operational",
      severity: "high",
      title: `Operational gap: ${missing}`,
      businessImpact: "Campaign cannot execute safely without this operational prerequisite.",
      mitigation: `Resolve ${missing} in campaign workspace before launch.`,
      triggeredMetrics: ["operationalMandatoryMissing"],
      evidence: [`Mandatory operational item missing: ${missing}.`],
    });
  }

  return risks.sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
}

function severityRank(severity: CampaignRisk["severity"]): number {
  return { critical: 4, high: 3, medium: 2, low: 1 }[severity];
}

export function buildRiskMatrix(risks: CampaignRisk[]): CampaignDecisionReport["riskMatrix"] {
  const categories: RiskCategory[] = ["reach", "budget", "creator", "audience", "operational"];
  return categories.map((category) => {
    const categoryRisks = risks.filter((r) => r.category === category);
    const top = categoryRisks[0];
    const maxSeverity = categoryRisks.reduce<CampaignRisk["severity"] | null>((max, risk) => {
      if (!max || severityRank(risk.severity) > severityRank(max)) return risk.severity;
      return max;
    }, null);
    return {
      category,
      severity: maxSeverity ?? "low",
      count: categoryRisks.length,
      topRisk: top?.title ?? null,
    };
  });
}
