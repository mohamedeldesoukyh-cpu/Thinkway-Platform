import type { CampaignOptimizationReport } from "@/lib/campaign-optimization";

import type {
  CampaignRisk,
  DecisionRecommendation,
  DecisionRecommendationKind,
  LaunchReadiness,
} from "./types";

function confidenceLabel(score: number): "low" | "medium" | "high" {
  if (score >= 75) return "high";
  if (score >= 55) return "medium";
  return "low";
}

function priorityFromImpact(
  impact: LaunchReadiness,
  severity: CampaignRisk["severity"]
): DecisionRecommendation["priority"] {
  if (impact === "not_ready" || severity === "critical") return "critical";
  if (impact === "high_risk" || severity === "high") return "high";
  if (impact === "needs_review" || severity === "medium") return "medium";
  return "low";
}

export function buildDecisionRecommendations(input: {
  readiness: LaunchReadiness;
  risks: CampaignRisk[];
  optimization: CampaignOptimizationReport;
}): DecisionRecommendation[] {
  const recommendations: DecisionRecommendation[] = [];
  let index = 1;

  const add = (rec: Omit<DecisionRecommendation, "id">) => {
    recommendations.push({ ...rec, id: `decision_rec_${index++}` });
  };

  if (input.readiness === "ready") {
    add({
      kind: "safe_to_launch",
      priority: "low",
      action: "Campaign meets launch readiness criteria — proceed to approval workflow.",
      expectedBusinessImpact: "Timely launch with forecast-backed KPI expectations.",
      confidence: 82,
      confidenceLabel: "high",
      supportingEvidence: [
        `Optimization health ${input.optimization.healthScore.overall}/100.`,
        `${input.risks.filter((r) => r.severity === "high").length} high risks remaining.`,
      ],
      linkedRiskIds: [],
      linkedOptimizationIds: [],
    });
  }

  if (input.readiness === "high_risk" || input.readiness === "not_ready") {
    add({
      kind: "delay_launch",
      priority: "critical",
      action: "Delay launch until critical risks and operational gaps are resolved.",
      expectedBusinessImpact: "Avoids budget waste and client KPI miss on under-prepared campaigns.",
      confidence: 88,
      confidenceLabel: "high",
      supportingEvidence: input.risks.slice(0, 3).map((r) => r.title),
      linkedRiskIds: input.risks.slice(0, 3).map((r) => r.id),
      linkedOptimizationIds: [],
    });
  }

  const overlapRisk = input.risks.find((r) => r.title.toLowerCase().includes("overlap"));
  if (overlapRisk) {
    const optRec = input.optimization.recommendations.find((r) =>
      r.action.toLowerCase().includes("overlap")
    );
    add({
      kind: "reduce_overlap",
      priority: priorityFromImpact(input.readiness, overlapRisk.severity),
      action: optRec?.action ?? overlapRisk.mitigation,
      expectedBusinessImpact: optRec?.expectedImpact ?? "+8–15% estimated reach without additional spend.",
      confidence: optRec?.confidence ?? 75,
      confidenceLabel: confidenceLabel(optRec?.confidence ?? 75),
      supportingEvidence: overlapRisk.evidence,
      linkedRiskIds: [overlapRisk.id],
      linkedOptimizationIds: optRec ? [optRec.opportunityId] : [],
    });
  }

  const creatorRisk = input.risks.find((r) => r.category === "creator" && r.severity !== "low");
  if (creatorRisk) {
    const optRec = input.optimization.recommendations.find((r) => r.category === "creator_mix");
    add({
      kind: "replace_creators",
      priority: priorityFromImpact(input.readiness, creatorRisk.severity),
      action: optRec?.action ?? creatorRisk.mitigation,
      expectedBusinessImpact: optRec?.expectedImpact ?? "Reduced concentration risk and improved engagement efficiency.",
      confidence: optRec?.confidence ?? 70,
      confidenceLabel: confidenceLabel(optRec?.confidence ?? 70),
      supportingEvidence: creatorRisk.evidence,
      linkedRiskIds: [creatorRisk.id],
      linkedOptimizationIds: optRec ? [optRec.opportunityId] : [],
    });
  }

  const budgetRisk = input.risks.find((r) => r.category === "budget" && r.severity !== "low");
  if (budgetRisk) {
    add({
      kind: "increase_budget",
      priority: priorityFromImpact(input.readiness, budgetRisk.severity),
      action: "Increase budget or reallocate to higher-efficiency creators before approval.",
      expectedBusinessImpact: "Improves cost per reach and protects margin on deliverable scope.",
      confidence: 68,
      confidenceLabel: "medium",
      supportingEvidence: budgetRisk.evidence,
      linkedRiskIds: [budgetRisk.id],
      linkedOptimizationIds: [],
    });
  }

  const audienceRisk = input.risks.find((r) => r.category === "audience" && r.severity !== "low");
  if (audienceRisk) {
    add({
      kind: "expand_audience",
      priority: priorityFromImpact(input.readiness, audienceRisk.severity),
      action: "Expand geographic or interest coverage with niche-aligned creators.",
      expectedBusinessImpact: "+6–14% engagement probability vs current roster.",
      confidence: 66,
      confidenceLabel: "medium",
      supportingEvidence: audienceRisk.evidence,
      linkedRiskIds: [audienceRisk.id],
      linkedOptimizationIds: [],
    });
  }

  const platformRec = input.optimization.recommendations.find((r) => r.category === "platform");
  if (platformRec) {
    add({
      kind: "improve_platform_mix",
      priority: "medium",
      action: platformRec.action,
      expectedBusinessImpact: platformRec.expectedImpact,
      confidence: platformRec.confidence,
      confidenceLabel: platformRec.confidenceLabel,
      supportingEvidence: platformRec.reasoning,
      linkedRiskIds: [],
      linkedOptimizationIds: [platformRec.opportunityId],
    });
  }

  const operationalRisks = input.risks.filter((r) => r.category === "operational" && r.severity !== "low");
  if (operationalRisks.length) {
    add({
      kind: "resolve_operational_gaps",
      priority: "high",
      action: "Complete mandatory plan and operational checklist items before sign-off.",
      expectedBusinessImpact: "Enables safe handoff from planning to campaign execution.",
      confidence: 90,
      confidenceLabel: "high",
      supportingEvidence: operationalRisks.map((r) => r.title),
      linkedRiskIds: operationalRisks.map((r) => r.id),
      linkedOptimizationIds: [],
    });
  }

  return recommendations.sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority));
}

function priorityRank(priority: DecisionRecommendation["priority"]): number {
  return { critical: 4, high: 3, medium: 2, low: 1 }[priority];
}
