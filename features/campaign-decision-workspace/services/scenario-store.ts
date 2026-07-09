/**
 * Session/in-memory scenario store — deltas only, never mutates CampaignObject.
 */

import type { CampaignScenario } from "@/features/campaign-decision-engine";

import type { DecisionTimelineEntry, WorkspaceScenarioRecord } from "../types";

const SESSION_PREFIX = "thinkway_cdi_scenarios_";

function sessionKey(campaignObjectId: string): string {
  return `${SESSION_PREFIX}${campaignObjectId}`;
}

export type PersistedWorkspaceData = {
  scenarios: WorkspaceScenarioRecord[];
  timeline: DecisionTimelineEntry[];
  selectedScenarioId?: string;
  comparisonScenarioIds?: string[];
};

export class WorkspaceScenarioStore {
  private scenarios = new Map<string, WorkspaceScenarioRecord>();
  private timeline: DecisionTimelineEntry[] = [];
  private campaignObjectId: string;

  constructor(campaignObjectId: string) {
    this.campaignObjectId = campaignObjectId;
    this.hydrateFromSession();
  }

  private hydrateFromSession(): void {
    if (typeof sessionStorage === "undefined") return;
    try {
      const raw = sessionStorage.getItem(sessionKey(this.campaignObjectId));
      if (!raw) return;
      const parsed = JSON.parse(raw) as PersistedWorkspaceData;
      for (const scenario of parsed.scenarios ?? []) {
        this.scenarios.set(scenario.id, scenario);
      }
      this.timeline = parsed.timeline ?? [];
    } catch {
      // Ignore corrupt session data
    }
  }

  persist(
    selectedScenarioId?: string,
    comparisonScenarioIds?: string[]
  ): void {
    if (typeof sessionStorage === "undefined") return;
    const payload: PersistedWorkspaceData = {
      scenarios: this.list(),
      timeline: this.timeline,
      selectedScenarioId,
      comparisonScenarioIds,
    };
    sessionStorage.setItem(sessionKey(this.campaignObjectId), JSON.stringify(payload));
  }

  loadPersistedMeta(): Pick<PersistedWorkspaceData, "selectedScenarioId" | "comparisonScenarioIds"> {
    if (typeof sessionStorage === "undefined") return {};
    try {
      const raw = sessionStorage.getItem(sessionKey(this.campaignObjectId));
      if (!raw) return {};
      const parsed = JSON.parse(raw) as PersistedWorkspaceData;
      return {
        selectedScenarioId: parsed.selectedScenarioId,
        comparisonScenarioIds: parsed.comparisonScenarioIds,
      };
    } catch {
      return {};
    }
  }

  clearSession(): void {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.removeItem(sessionKey(this.campaignObjectId));
    this.scenarios.clear();
    this.timeline = [];
  }

  setBaseline(scenario: CampaignScenario): WorkspaceScenarioRecord {
    const record: WorkspaceScenarioRecord = {
      ...scenario,
      isOriginal: true,
      createdBy: "system",
    };
    this.scenarios.set(record.id, record);
    return record;
  }

  add(
    scenario: CampaignScenario,
    meta?: { createdBy?: string; reason?: string }
  ): WorkspaceScenarioRecord {
    const record: WorkspaceScenarioRecord = {
      ...scenario,
      createdBy: meta?.createdBy ?? "user",
      reason: meta?.reason,
    };
    this.scenarios.set(record.id, record);
    this.appendTimeline({
      scenarioId: record.id,
      scenarioName: record.name,
      action: "created",
      createdBy: record.createdBy ?? "user",
      changesSummary: summarizeChanges(record.changes),
      reason: meta?.reason,
      recommendation: record.recommendations[0]?.title,
    });
    return record;
  }

  update(scenario: CampaignScenario): WorkspaceScenarioRecord {
    const existing = this.scenarios.get(scenario.id);
    const record: WorkspaceScenarioRecord = {
      ...scenario,
      createdBy: existing?.createdBy ?? "user",
      reason: existing?.reason,
      isOriginal: existing?.isOriginal,
    };
    this.scenarios.set(record.id, record);
    this.appendTimeline({
      scenarioId: record.id,
      scenarioName: record.name,
      action: "simulated",
      createdBy: record.createdBy ?? "user",
      changesSummary: summarizeChanges(record.changes),
      recommendation: record.recommendations[0]?.title,
    });
    return record;
  }

  get(id: string): WorkspaceScenarioRecord | undefined {
    return this.scenarios.get(id);
  }

  list(): WorkspaceScenarioRecord[] {
    return [...this.scenarios.values()].sort((a, b) => {
      if (a.isOriginal) return -1;
      if (b.isOriginal) return 1;
      return a.createdAt.localeCompare(b.createdAt);
    });
  }

  getTimeline(): DecisionTimelineEntry[] {
    return [...this.timeline].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  markPromoted(scenarioId: string, promotedBy: string): void {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) return;
    this.appendTimeline({
      scenarioId,
      scenarioName: scenario.name,
      action: "promoted",
      createdBy: promotedBy,
      changesSummary: "Scenario promoted to approved CampaignObject version",
      reason: scenario.reason,
      recommendation: scenario.recommendations[0]?.title,
    });
  }

  private appendTimeline(
    entry: Omit<DecisionTimelineEntry, "id" | "createdAt">
  ): void {
    this.timeline.unshift({
      ...entry,
      id: `timeline_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
    });
    if (this.timeline.length > 100) {
      this.timeline = this.timeline.slice(0, 100);
    }
  }
}

function summarizeChanges(changes: CampaignScenario["changes"]): string {
  const parts: string[] = [];
  if (changes.budgetChange) {
    parts.push(`Budget ${changes.budgetChange.percentChange > 0 ? "+" : ""}${changes.budgetChange.percentChange}%`);
  }
  if (changes.creatorChanges?.length) {
    parts.push(`${changes.creatorChanges.length} creator action(s)`);
  }
  if (changes.objectiveChanges?.objective) {
    parts.push(`Objective: ${changes.objectiveChanges.objective}`);
  }
  if (changes.timelineChanges) {
    parts.push("Timeline adjusted");
  }
  if (changes.platformChanges) {
    parts.push("Platform mix changed");
  }
  return parts.length > 0 ? parts.join(" · ") : "No changes";
}

export const SCENARIO_PRESETS: Array<{
  id: string;
  label: string;
  buildChanges: (baselineCreatorIds: string[]) => import("@/features/campaign-decision-engine").ScenarioChanges;
}> = [
  {
    id: "budget_cut",
    label: "Budget Cut",
    buildChanges: () => ({ budgetChange: { percentChange: -20, label: "Budget -20%" } }),
  },
  {
    id: "client_selection",
    label: "Client Selection",
    buildChanges: (ids) => ({
      creatorChanges: ids.map((id) => ({
        action: "replace" as const,
        creatorId: id,
        replacementCreatorId: `client_${id}`,
        source: "client" as const,
      })),
    }),
  },
  {
    id: "alternative_creators",
    label: "Alternative Creators",
    buildChanges: (ids) => ({
      creatorChanges: [
        ...(ids.length > 1 ? [{ action: "remove" as const, creatorId: ids[0] }] : []),
        { action: "add" as const, creatorId: "alt_creator_premium", source: "thinkway" as const },
      ],
      budgetChange: { percentChange: -5, label: "Efficiency reallocation" },
    }),
  },
  {
    id: "luxury_positioning",
    label: "Luxury Positioning",
    buildChanges: (ids) => ({
      creatorChanges: ids.map((id) => ({
        action: "switch_platform" as const,
        creatorId: id,
        targetPlatform: "instagram",
      })),
      budgetChange: { percentChange: 15, label: "Premium positioning" },
    }),
  },
  {
    id: "sales_objective",
    label: "Sales Objective",
    buildChanges: () => ({
      objectiveChanges: { objective: "Conversions and sales", campaignType: "Performance" },
      budgetChange: { percentChange: 10, label: "Performance uplift" },
    }),
  },
  {
    id: "high_roi",
    label: "High ROI",
    buildChanges: (ids) => ({
      budgetChange: { percentChange: -10, label: "Efficiency focus" },
      creatorChanges: ids.slice(0, 1).map((id) => ({
        action: "decrease_posts" as const,
        creatorId: id,
        postCountDelta: 1,
      })),
    }),
  },
];
