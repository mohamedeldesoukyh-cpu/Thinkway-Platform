"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { CampaignObject } from "@/features/campaign-intelligence";
import {
  compareScenarios,
  createOriginalScenario,
  createScenario,
  evaluateClientCreators,
  extractCampaignDecisionContext,
  runDecisionEngine,
  snapshotCampaignObject,
  type CampaignDecisionContext,
  type CampaignScenario,
  type ScenarioChanges,
  type StructuredRecommendation,
} from "@/features/campaign-decision-engine";

import {
  assessClientCreator,
  creatorIdFromUrl,
} from "../services/client-creator-assessment";
import { buildPromotedCampaignObject } from "../services/promote-scenario";
import {
  SCENARIO_PRESETS,
  WorkspaceScenarioStore,
} from "../services/scenario-store";
import type {
  ClientCreatorAssessment,
  MetricComparison,
  PromoteScenarioResult,
  WorkspaceScenarioRecord,
} from "../types";

export type UseDecisionWorkspaceOptions = {
  campaignObject: CampaignObject;
  conversationId: string;
  userId?: string;
  onCampaignObjectPromoted?: (campaignObject: CampaignObject) => void;
};

export type UseDecisionWorkspaceReturn = {
  baseline: CampaignDecisionContext;
  baselineScenario: WorkspaceScenarioRecord;
  scenarios: WorkspaceScenarioRecord[];
  selectedScenario: WorkspaceScenarioRecord;
  selectedScenarioId: string;
  comparisonScenarioIds: string[];
  comparison: ReturnType<typeof compareScenarios>;
  clientCreatorAssessments: ClientCreatorAssessment[];
  topRecommendation: StructuredRecommendation | null;
  timeline: ReturnType<WorkspaceScenarioStore["getTimeline"]>;
  metricComparisons: MetricComparison[];
  isPromoting: boolean;
  promoteError: string | null;
  selectScenario: (id: string) => void;
  toggleComparisonScenario: (id: string) => void;
  createScenarioFromPreset: (presetId: string, reason?: string) => void;
  createCustomScenario: (name: string, changes: ScenarioChanges, reason?: string) => void;
  updateScenarioChanges: (scenarioId: string, changes: ScenarioChanges) => void;
  applyBudgetChange: (percentChange: number) => void;
  applyCreatorAction: (action: import("@/features/campaign-decision-engine").CreatorChangeDelta) => void;
  evaluateClientCreatorUrls: (urls: string[]) => ClientCreatorAssessment[];
  promoteSelectedScenario: (reason?: string) => Promise<PromoteScenarioResult | null>;
};

function buildMetricComparisons(
  baseline: CampaignDecisionContext,
  baselineScore: number,
  scenario: WorkspaceScenarioRecord
): MetricComparison[] {
  const sim = scenario.simulationResult;
  const pct = (after: number, before: number) =>
    before === 0 ? 0 : Math.round(((after - before) / before) * 1000) / 10;

  return [
    {
      label: "Budget",
      value: sim.budget.total,
      baseline: baseline.budget.total,
      percentChange: pct(sim.budget.total, baseline.budget.total),
      format: "currency",
      currency: sim.budget.currency,
    },
    {
      label: "Creator Count",
      value: sim.kpis.creatorCount,
      baseline: baseline.kpis.creatorCount,
      percentChange: pct(sim.kpis.creatorCount, baseline.kpis.creatorCount),
      format: "number",
    },
    {
      label: "Posts",
      value: sim.kpis.postCount,
      baseline: baseline.kpis.postCount,
      percentChange: pct(sim.kpis.postCount, baseline.kpis.postCount),
      format: "number",
    },
    {
      label: "Reach",
      value: sim.kpis.reach,
      baseline: baseline.kpis.reach,
      percentChange: pct(sim.kpis.reach, baseline.kpis.reach),
      format: "number",
    },
    {
      label: "Engagement",
      value: sim.kpis.engagement,
      baseline: baseline.kpis.engagement,
      percentChange: pct(sim.kpis.engagement, baseline.kpis.engagement),
      format: "number",
    },
    {
      label: "ER",
      value: sim.kpis.engagementRate,
      baseline: baseline.kpis.engagementRate,
      percentChange: pct(sim.kpis.engagementRate, baseline.kpis.engagementRate),
      format: "percent",
    },
    {
      label: "CPM",
      value: sim.kpis.cpm,
      baseline: baseline.kpis.cpm,
      percentChange: pct(sim.kpis.cpm, baseline.kpis.cpm),
      format: "currency",
      currency: sim.budget.currency,
    },
    {
      label: "ROAS",
      value: sim.kpis.roas,
      baseline: baseline.kpis.roas,
      percentChange: pct(sim.kpis.roas, baseline.kpis.roas),
      format: "number",
    },
    {
      label: "Timeline",
      value: sim.timeline.durationWeeks,
      baseline: baseline.timeline.durationWeeks,
      percentChange: pct(sim.timeline.durationWeeks, baseline.timeline.durationWeeks),
      format: "number",
    },
    {
      label: "Thinkway Score",
      value: scenario.thinkwayScore.total,
      baseline: baselineScore,
      percentChange: pct(scenario.thinkwayScore.total, baselineScore),
      format: "score",
    },
    {
      label: "Success Probability",
      value: sim.successProbability,
      baseline: baseline.successProbability,
      percentChange: pct(sim.successProbability, baseline.successProbability),
      format: "percent",
    },
  ];
}

export function useDecisionWorkspace({
  campaignObject,
  conversationId,
  userId = "user",
  onCampaignObjectPromoted,
}: UseDecisionWorkspaceOptions): UseDecisionWorkspaceReturn {
  const baselineRef = useRef<CampaignDecisionContext | null>(null);
  const storeRef = useRef<WorkspaceScenarioStore | null>(null);
  const frozenCampaignRef = useRef(campaignObject);

  const baseline = useMemo(() => {
    const ctx = extractCampaignDecisionContext(campaignObject);
    baselineRef.current = ctx;
    return ctx;
  }, [campaignObject]);

  const engineBootstrap = useMemo(() => {
    return runDecisionEngine({ campaignObject });
  }, [campaignObject]);

  const [scenarios, setScenarios] = useState<WorkspaceScenarioRecord[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>("");
  const [comparisonScenarioIds, setComparisonScenarioIds] = useState<string[]>([]);
  const [isPromoting, setIsPromoting] = useState(false);
  const [promoteError, setPromoteError] = useState<string | null>(null);

  useEffect(() => {
    const store = new WorkspaceScenarioStore(campaignObject.id);
    storeRef.current = store;

    const existing = store.list();
    if (existing.length > 0) {
      let loaded = existing;
      if (!existing.some((s) => s.isOriginal)) {
        const original =
          engineBootstrap.scenarios.find((s) => s.name === "Original") ??
          createOriginalScenario(baselineRef.current ?? baseline);
        const baselineRecord = store.setBaseline(original);
        loaded = [baselineRecord, ...existing];
      }
      setScenarios(loaded);
      const meta = store.loadPersistedMeta();
      setSelectedScenarioId(meta.selectedScenarioId ?? loaded[0].id);
      setComparisonScenarioIds(meta.comparisonScenarioIds ?? loaded.slice(0, 3).map((s) => s.id));
    } else {
      const original =
        engineBootstrap.scenarios.find((s) => s.name === "Original") ??
        createOriginalScenario(baselineRef.current ?? baseline);
      const baselineRecord = store.setBaseline(original);
      setScenarios([baselineRecord]);
      setSelectedScenarioId(baselineRecord.id);
      setComparisonScenarioIds([baselineRecord.id]);
      store.persist(baselineRecord.id, [baselineRecord.id]);
    }
  }, [campaignObject.id, engineBootstrap.scenarios, baseline]);

  const baselineScenario = useMemo(
    () => scenarios.find((s) => s.isOriginal) ?? scenarios[0],
    [scenarios]
  );

  const selectedScenario = useMemo(
    () => scenarios.find((s) => s.id === selectedScenarioId) ?? baselineScenario,
    [scenarios, selectedScenarioId, baselineScenario]
  );

  const comparison = useMemo(() => {
    if (scenarios.length === 0) {
      return compareScenarios([]);
    }
    const compared = scenarios.filter(
      (s) => comparisonScenarioIds.includes(s.id) || s.isOriginal
    );
    const unique = [...new Map(compared.map((s) => [s.id, s])).values()];
    return compareScenarios(unique.length > 0 ? unique : scenarios);
  }, [scenarios, comparisonScenarioIds]);

  const clientCreatorAssessments = useMemo(
    () => engineBootstrap.clientCreatorEvaluations.map(assessClientCreator),
    [engineBootstrap.clientCreatorEvaluations]
  );

  const topRecommendation = useMemo(() => {
    if (selectedScenario?.recommendations[0]) return selectedScenario.recommendations[0];
    return engineBootstrap.recommendations[0] ?? null;
  }, [selectedScenario, engineBootstrap.recommendations]);

  const timeline = useMemo(() => storeRef.current?.getTimeline() ?? [], [scenarios]);

  const baselineScore = baselineScenario?.thinkwayScore.total ?? baseline.successProbability;

  const metricComparisons = useMemo(
    () =>
      selectedScenario
        ? buildMetricComparisons(baseline, baselineScore, selectedScenario)
        : [],
    [baseline, baselineScore, selectedScenario]
  );

  const persistStore = useCallback(
    (nextScenarios: WorkspaceScenarioRecord[], selectedId: string, comparisonIds: string[]) => {
      setScenarios(nextScenarios);
      setSelectedScenarioId(selectedId);
      setComparisonScenarioIds(comparisonIds);
      storeRef.current?.persist(selectedId, comparisonIds);
    },
    []
  );

  const addScenario = useCallback(
    (scenario: CampaignScenario, meta?: { reason?: string }) => {
      const store = storeRef.current;
      if (!store) return;
      const record = store.add(scenario, { createdBy: userId, reason: meta?.reason });
      const next = store.list();
      const comparisonIds = [...new Set([...comparisonScenarioIds, record.id])];
      persistStore(next, record.id, comparisonIds);
    },
    [userId, comparisonScenarioIds, persistStore]
  );

  const selectScenario = useCallback(
    (id: string) => {
      persistStore(scenarios, id, comparisonScenarioIds);
    },
    [scenarios, comparisonScenarioIds, persistStore]
  );

  const toggleComparisonScenario = useCallback(
    (id: string) => {
      const next = comparisonScenarioIds.includes(id)
        ? comparisonScenarioIds.filter((x) => x !== id)
        : [...comparisonScenarioIds, id];
      persistStore(scenarios, selectedScenarioId, next);
    },
    [comparisonScenarioIds, scenarios, selectedScenarioId, persistStore]
  );

  const simulateChanges = useCallback(
    (name: string, changes: ScenarioChanges, existingId?: string): CampaignScenario => {
      return createScenario(name, baseline, changes);
    },
    [baseline]
  );

  const createCustomScenario = useCallback(
    (name: string, changes: ScenarioChanges, reason?: string) => {
      const scenario = simulateChanges(name, changes);
      addScenario({ ...scenario, name }, { reason });
    },
    [addScenario, simulateChanges]
  );

  const createScenarioFromPreset = useCallback(
    (presetId: string, reason?: string) => {
      const preset = SCENARIO_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      const creatorIds = baseline.creators.map((c) => c.id);
      const changes = preset.buildChanges(creatorIds);
      const count = scenarios.filter((s) => s.name.startsWith(preset.label)).length;
      const name = count > 0 ? `${preset.label} ${count + 1}` : preset.label;
      createCustomScenario(name, changes, reason);
    },
    [baseline.creators, createCustomScenario, scenarios]
  );

  const updateScenarioInPlace = useCallback(
    (scenarioId: string, changes: ScenarioChanges) => {
      const store = storeRef.current;
      if (!store) return;
      const existing = store.get(scenarioId);
      if (!existing || existing.isOriginal) return;

      const scenario = simulateChanges(existing.name, changes);
      const updated = store.update({ ...scenario, id: scenarioId, name: existing.name });
      const next = store.list();
      persistStore(next, scenarioId, comparisonScenarioIds);
    },
    [simulateChanges, comparisonScenarioIds, persistStore]
  );

  const updateScenarioChanges = useCallback(
    (scenarioId: string, changes: ScenarioChanges) => {
      updateScenarioInPlace(scenarioId, changes);
    },
    [updateScenarioInPlace]
  );

  const applyBudgetChange = useCallback(
    (percentChange: number) => {
      if (!selectedScenario || selectedScenario.isOriginal) {
        createCustomScenario(
          `Budget ${percentChange > 0 ? "+" : ""}${percentChange}%`,
          { budgetChange: { percentChange, label: `Budget ${percentChange > 0 ? "+" : ""}${percentChange}%` } }
        );
        return;
      }
      updateScenarioInPlace(selectedScenario.id, {
        ...selectedScenario.changes,
        budgetChange: { percentChange, label: `Budget ${percentChange > 0 ? "+" : ""}${percentChange}%` },
      });
    },
    [selectedScenario, createCustomScenario, updateScenarioInPlace]
  );

  const applyCreatorAction = useCallback(
    (action: import("@/features/campaign-decision-engine").CreatorChangeDelta) => {
      const baseChanges = selectedScenario?.isOriginal
        ? { creatorChanges: [action] }
        : {
            ...selectedScenario.changes,
            creatorChanges: [...(selectedScenario.changes.creatorChanges ?? []), action],
          };

      if (selectedScenario?.isOriginal) {
        createCustomScenario(`Creator ${action.action}`, baseChanges);
      } else if (selectedScenario) {
        updateScenarioInPlace(selectedScenario.id, baseChanges);
      }
    },
    [selectedScenario, createCustomScenario, updateScenarioInPlace]
  );

  const evaluateClientCreatorUrls = useCallback(
    (urls: string[]) => {
      const ids = urls
        .map((url) => creatorIdFromUrl(url))
        .filter((id): id is string => !!id);

      if (ids.length === 0) return clientCreatorAssessments;

      return evaluateClientCreators(baseline, ids).map(assessClientCreator);
    },
    [baseline, clientCreatorAssessments]
  );

  const promoteSelectedScenario = useCallback(
    async (reason?: string): Promise<PromoteScenarioResult | null> => {
      if (!selectedScenario || selectedScenario.isOriginal) {
        setPromoteError("Select a scenario to promote (not Original).");
        return null;
      }

      setIsPromoting(true);
      setPromoteError(null);

      try {
        const snapshotBefore = snapshotCampaignObject(frozenCampaignRef.current);
        const { promoted } = buildPromotedCampaignObject({
          campaignObject: frozenCampaignRef.current,
          scenario: selectedScenario,
          conversationId,
          userId,
        });

        const snapshotAfter = snapshotCampaignObject(frozenCampaignRef.current);
        if (snapshotBefore !== snapshotAfter) {
          throw new Error("CampaignObject was mutated before promotion");
        }

        const response = await fetch(
          `/api/ai/campaign-objects/${frozenCampaignRef.current.id}/promote-scenario`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              conversationId,
              scenario: selectedScenario,
              reason,
            }),
          }
        );

        if (!response.ok) {
          const body = (await response.json()) as { error?: string };
          throw new Error(body.error ?? "Promotion failed");
        }

        const result = (await response.json()) as PromoteScenarioResult & {
          campaignObject: CampaignObject;
        };

        frozenCampaignRef.current = result.campaignObject;
        storeRef.current?.markPromoted(selectedScenario.id, userId);
        onCampaignObjectPromoted?.(result.campaignObject);

        return {
          campaignObjectId: result.campaignObjectId,
          version: result.version,
          versionId: result.versionId,
          promotedScenarioName: selectedScenario.name,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Promotion failed";
        setPromoteError(message);
        return null;
      } finally {
        setIsPromoting(false);
      }
    },
    [selectedScenario, conversationId, userId, onCampaignObjectPromoted]
  );

  return {
    baseline,
    baselineScenario,
    scenarios,
    selectedScenario,
    selectedScenarioId,
    comparisonScenarioIds,
    comparison,
    clientCreatorAssessments,
    topRecommendation,
    timeline,
    metricComparisons,
    isPromoting,
    promoteError,
    selectScenario,
    toggleComparisonScenario,
    createScenarioFromPreset,
    createCustomScenario,
    updateScenarioChanges,
    applyBudgetChange,
    applyCreatorAction,
    evaluateClientCreatorUrls,
    promoteSelectedScenario,
  };
}
