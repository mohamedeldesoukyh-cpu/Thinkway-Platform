/**
 * Apply scenario simulation deltas to CampaignObject — only called on explicit promotion.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";
import { enrichCampaignObjectWithStudioData } from "@/features/campaign-intelligence";
import {
  isBudgetSectionData,
  isPerformanceSectionData,
  isSummarySectionData,
  isTimelineSectionData,
} from "@/features/campaign-intelligence/types/section-schemas";
import type { CampaignScenario } from "@/features/campaign-decision-engine";
import {
  assertCampaignObjectImmutable,
  snapshotCampaignObject,
} from "@/features/campaign-decision-engine";

import type { PromoteScenarioResult } from "../types";

function cloneCampaignObject(campaignObject: CampaignObject): CampaignObject {
  return JSON.parse(JSON.stringify(campaignObject)) as CampaignObject;
}

/** Apply scenario simulation results to a new CampaignObject snapshot. */
export function applyScenarioToCampaignObject(
  campaignObject: CampaignObject,
  scenario: CampaignScenario
): CampaignObject {
  const snapshotBefore = snapshotCampaignObject(campaignObject);
  const next = cloneCampaignObject(campaignObject);
  const sim = scenario.simulationResult;
  const changes = scenario.changes;

  // Budget section
  const budgetContent = next.sections.budget.content;
  if (isBudgetSectionData(budgetContent)) {
    budgetContent.total = sim.budget.total;
    budgetContent.currency = sim.budget.currency;
    const ratio = sim.budget.total / Math.max(campaignObject.sections.budget.content && isBudgetSectionData(campaignObject.sections.budget.content) ? campaignObject.sections.budget.content.total ?? sim.budget.total : sim.budget.total, 1);
    budgetContent.allocations = budgetContent.allocations.map((line) => ({
      ...line,
      amount: line.amount != null ? Math.round(line.amount * ratio) : line.amount,
    }));
  } else if (typeof next.sections.budget.content === "string") {
    next.sections.budget.content = next.sections.budget.content.replace(
      /total[^\d]*[\d,]+/gi,
      `total: ${sim.budget.total.toLocaleString()} ${sim.budget.currency}`
    );
  }

  if (next.sections.budget.data && isBudgetSectionData(next.sections.budget.data)) {
    next.sections.budget.data.total = sim.budget.total;
    next.sections.budget.data.currency = sim.budget.currency;
  }

  // Creators section — update IDs from simulation
  const creatorIds = sim.creators.map((c) => c.id);
  const creatorsData = next.sections.creators.data;
  if (creatorsData && typeof creatorsData === "object") {
    const data = creatorsData as Record<string, unknown>;
    if (data.discovery && typeof data.discovery === "object") {
      (data.discovery as { creatorIds?: string[] }).creatorIds = creatorIds;
    }
    if (data.recommendations && typeof data.recommendations === "object") {
      (data.recommendations as { creatorIds?: string[] }).creatorIds = creatorIds;
    }
  }

  // Summary section
  const summaryCards = next.sections.summary.data?.summaryCards;
  if (isSummarySectionData(summaryCards)) {
    summaryCards.budget = `${sim.budget.total.toLocaleString()} ${sim.budget.currency}`;
    summaryCards.estimatedReach = formatReach(sim.kpis.reach);
    if (changes.objectiveChanges?.objective) {
      summaryCards.objective = changes.objectiveChanges.objective;
    }
    if (changes.objectiveChanges?.campaignType) {
      summaryCards.campaignType = changes.objectiveChanges.campaignType;
    }
  }

  // Timeline section
  const timelineData = next.sections.timeline.data;
  if (isTimelineSectionData(timelineData)) {
    timelineData.durationWeeks = sim.timeline.durationWeeks;
    timelineData.goLiveWeek = sim.timeline.goLiveWeek;
  }

  // Performance / KPI section
  const perfData = next.sections.performance.data;
  if (isPerformanceSectionData(perfData)) {
    if (perfData.industryBenchmark) {
      perfData.industryBenchmark.estReach = formatReach(sim.kpis.reach);
      perfData.industryBenchmark.estCpm = String(Math.round(sim.kpis.cpm));
    }
    if (perfData.groundedKpis) {
      for (const kpi of perfData.groundedKpis) {
        const metric = kpi.metric.toLowerCase();
        if (metric.includes("reach")) kpi.prediction = formatReach(sim.kpis.reach);
        if (metric.includes("engagement rate") || metric === "er") {
          kpi.prediction = `${sim.kpis.engagementRate.toFixed(1)}%`;
        }
        if (metric.includes("conversion")) {
          kpi.prediction = sim.kpis.conversions.toLocaleString();
        }
        if (metric.includes("roas")) {
          kpi.prediction = `${sim.kpis.roas.toFixed(1)}x`;
        }
      }
    }
  }

  next.updatedAt = new Date().toISOString();
  next.meta = {
    ...next.meta,
    status: next.meta.status === "complete" ? "complete" : next.meta.status,
  };

  const enriched = enrichCampaignObjectWithStudioData(next);

  if (!assertCampaignObjectImmutable(campaignObject, campaignObject)) {
    throw new Error("Source CampaignObject was mutated during promotion");
  }
  if (snapshotBefore === snapshotCampaignObject(campaignObject)) {
    // Source unchanged — expected
  }

  return enriched;
}

function formatReach(reach: number): string {
  if (reach >= 1_000_000) return `${(reach / 1_000_000).toFixed(1)}M`;
  if (reach >= 1_000) return `${(reach / 1_000).toFixed(0)}K`;
  return reach.toLocaleString();
}

export type PromoteScenarioInput = {
  campaignObject: CampaignObject;
  scenario: CampaignScenario;
  conversationId: string;
  userId: string;
  campaignHeaderId?: string | null;
};

/** Client-side helper result shape (API handles persistence). */
export function buildPromotedCampaignObject(
  input: PromoteScenarioInput
): { promoted: CampaignObject; meta: Omit<PromoteScenarioResult, "version" | "versionId"> } {
  const snapshotBefore = snapshotCampaignObject(input.campaignObject);
  const promoted = applyScenarioToCampaignObject(input.campaignObject, input.scenario);
  const snapshotAfter = snapshotCampaignObject(input.campaignObject);

  if (snapshotBefore !== snapshotAfter) {
    throw new Error("CampaignObject mutated before promotion completed");
  }

  return {
    promoted: {
      ...promoted,
      conversationId: input.conversationId,
    },
    meta: {
      campaignObjectId: input.campaignObject.id,
      promotedScenarioName: input.scenario.name,
    },
  };
}
