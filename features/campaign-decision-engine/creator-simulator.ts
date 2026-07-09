/**
 * Creator simulator — remove/replace/add creators, posts, platform changes.
 */

import type { CreatorDNADocument } from "@/features/creator-dna/types";
import { createEmptyCreatorDNADocument } from "@/features/creator-dna/services/document-factory";

import {
  findBaselineCreatorMatch,
  lookupCreatorDna,
  normalizeInfluencerLookupId,
  parseClientCreatorSlug,
  resolveClientCreatorDisplayName,
} from "./client-creator-identity";
import type {
  CampaignDecisionContext,
  ClientCreatorEvaluation,
  CreatorChangeDelta,
  ScenarioChanges,
  SimulationCreator,
} from "./decision-types";
import { simulateKpis } from "./kpi-simulator";

type CreatorIdentityHint = Pick<SimulationCreator, "displayName" | "handle" | "platform">;

function creatorFromDna(
  id: string,
  dna: CreatorDNADocument | undefined,
  source: "thinkway" | "client",
  hint?: CreatorIdentityHint
): SimulationCreator {
  const doc = dna ?? createEmptyCreatorDNADocument();
  const parsedSlug = parseClientCreatorSlug(id);
  const resolved = resolveClientCreatorDisplayName(id, {
    displayName: doc.identity.displayName.value ?? hint?.displayName,
    handle: doc.identity.handle.value ?? hint?.handle,
  });
  const followers = doc.metrics.followers.value ?? 50_000;
  const er = doc.metrics.engagementRate.value ?? 3.8;
  const platform =
    doc.identity.platform.value ?? parsedSlug.platform ?? hint?.platform ?? "instagram";
  const fitScore = doc.scores.brandFit.value ?? doc.scores.thinkwayScore.value ?? 65;

  return {
    id,
    handle: resolved.handle,
    displayName: resolved.displayName,
    platform,
    followers,
    engagementRate: er,
    postCount: 2,
    fitScore: fitScore ?? 65,
    source,
    cpm: followers > 300_000 ? 78 : 48,
  };
}

export function applyCreatorChanges(
  baselineCreators: SimulationCreator[],
  changes: CreatorChangeDelta[]
): SimulationCreator[] {
  let creators = baselineCreators.map((c) => ({ ...c }));

  for (const change of changes) {
    switch (change.action) {
      case "remove": {
        creators = creators.filter((c) => c.id !== change.creatorId);
        break;
      }
      case "replace": {
        creators = creators.map((c) => {
          if (c.id !== change.creatorId) return c;
          return {
            ...c,
            id: change.replacementCreatorId ?? c.id,
            source: change.source ?? "client",
            fitScore: Math.max(50, c.fitScore - 8),
          };
        });
        break;
      }
      case "add": {
        if (!creators.some((c) => c.id === change.creatorId)) {
          const hint = findBaselineCreatorMatch(baselineCreators, change.creatorId);
          creators.push(
            creatorFromDna(change.creatorId, undefined, change.source ?? "client", hint)
          );
        }
        break;
      }
      case "increase_posts": {
        creators = creators.map((c) =>
          c.id === change.creatorId
            ? { ...c, postCount: c.postCount + (change.postCountDelta ?? 1) }
            : c
        );
        break;
      }
      case "decrease_posts": {
        creators = creators.map((c) =>
          c.id === change.creatorId
            ? { ...c, postCount: Math.max(1, c.postCount - (change.postCountDelta ?? 1)) }
            : c
        );
        break;
      }
      case "switch_platform": {
        creators = creators.map((c) =>
          c.id === change.creatorId
            ? {
                ...c,
                platform: change.targetPlatform ?? "tiktok",
                engagementRate: c.platform === "tiktok" ? c.engagementRate * 0.95 : c.engagementRate * 1.05,
              }
            : c
        );
        break;
      }
    }
  }

  return creators;
}

export function simulateCreatorChanges(
  baseline: CampaignDecisionContext,
  changes: ScenarioChanges,
  dnaMap?: Map<string, CreatorDNADocument>
): { creators: SimulationCreator[]; kpis: ReturnType<typeof simulateKpis>["kpis"]; kpiDeltas: ReturnType<typeof simulateKpis>["kpiDeltas"] } {
  const creatorChanges = changes.creatorChanges ?? [];
  let creators = applyCreatorChanges(baseline.creators, creatorChanges);

  for (const change of creatorChanges) {
    if (change.action === "add" || change.action === "replace") {
      const newId = change.replacementCreatorId ?? change.creatorId;
      const dna = lookupCreatorDna(dnaMap, newId);
      const hint = findBaselineCreatorMatch(baseline.creators, newId);
      creators = creators.map((c) =>
        c.id === newId
          ? creatorFromDna(newId, dna, change.source ?? "client", hint)
          : c
      );
    }
  }

  const postCount = creators.reduce((sum, c) => sum + c.postCount, 0);
  const budgetMultiplier = changes.budgetChange
    ? 1 + changes.budgetChange.percentChange / 100
    : 1;

  const { kpis, kpiDeltas } = simulateKpis(baseline, {
    budgetMultiplier,
    creatorCount: creators.length,
    postCount,
    creators,
  });

  return { creators, kpis, kpiDeltas };
}

export function evaluateClientCreators(
  baseline: CampaignDecisionContext,
  clientCreatorIds: string[],
  dnaMap?: Map<string, CreatorDNADocument>
): ClientCreatorEvaluation[] {
  const thinkwayByFit = [...baseline.creators].sort((a, b) => b.fitScore - a.fitScore);

  return clientCreatorIds.map((creatorId) => {
    const baselineMatch = findBaselineCreatorMatch(baseline.creators, creatorId);
    const dna = lookupCreatorDna(dnaMap, creatorId);
    const clientCreator = creatorFromDna(creatorId, dna, "client", baselineMatch);
    const thinkwayAlternative =
      thinkwayByFit.find(
        (creator) =>
          normalizeInfluencerLookupId(creator.id) !== normalizeInfluencerLookupId(creatorId)
      ) ?? thinkwayByFit[0];

    const fitScore = clientCreator.fitScore;
    const thinkwayFitScore = thinkwayAlternative?.fitScore ?? 75;
    const audienceDiff = clientCreator.followers - (thinkwayAlternative?.followers ?? 0);
    const engagementRateDiff =
      clientCreator.engagementRate - (thinkwayAlternative?.engagementRate ?? 0);
    const cpmDiff = clientCreator.cpm - (thinkwayAlternative?.cpm ?? 50);

    const replaceRecommended = fitScore < thinkwayFitScore - 5 || engagementRateDiff < -1;
    const riskLevel: ClientCreatorEvaluation["riskLevel"] =
      fitScore < 60 ? "high" : fitScore < 72 ? "medium" : "low";

    const reason = replaceRecommended
      ? `Client creator fit score (${fitScore}) is below Thinkway recommendation (${thinkwayFitScore}). ER diff ${engagementRateDiff.toFixed(1)}%, CPM diff ${cpmDiff.toFixed(0)}.`
      : `Client creator meets fit threshold. Fit ${fitScore} vs Thinkway ${thinkwayFitScore}.`;

    return {
      creatorId,
      clientCreator,
      thinkwayAlternative,
      fitScore,
      thinkwayFitScore,
      audienceDiff,
      engagementRateDiff,
      cpmDiff,
      riskLevel,
      replaceRecommended,
      reason,
      dnaAvailable: !!dna,
    };
  });
}

export function buildClientCreatorScenarioChanges(
  clientCreatorIds: string[],
  baseline: CampaignDecisionContext
): ScenarioChanges {
  const changes: CreatorChangeDelta[] = baseline.creators.map((creator, index) => ({
    action: "replace" as const,
    creatorId: creator.id,
    replacementCreatorId: clientCreatorIds[index] ?? clientCreatorIds[0],
    source: "client" as const,
  }));

  if (clientCreatorIds.length > baseline.creators.length) {
    for (let i = baseline.creators.length; i < clientCreatorIds.length; i++) {
      changes.push({
        action: "add",
        creatorId: clientCreatorIds[i],
        source: "client",
      });
    }
  }

  return { creatorChanges: changes };
}
