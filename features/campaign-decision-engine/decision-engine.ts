/**
 * Decision Engine orchestrator — reads CampaignObject, runs scenarios, returns results.
 * CampaignObject is immutable SSOT; this layer NEVER mutates it.
 */

import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CreatorDNADocument } from "@/features/creator-dna/types";

import type {
  DecisionEngineInput,
  DecisionEngineResult,
  ScenarioChanges,
} from "./decision-types";
import {
  assertCampaignObjectImmutable,
  extractCampaignDecisionContext,
  snapshotCampaignObject,
} from "./campaign-context";
import { evaluateClientCreators } from "./creator-simulator";
import {
  aggregateRecommendations,
  validateRecommendationStructure,
} from "./recommendation-engine";
import {
  buildStandardScenarios,
  compareScenarios,
  createScenario,
  ScenarioStore,
} from "./scenario-engine";
import { buildApprovalSummary } from "./approval-summary";

export class DecisionEngine {
  private readonly scenarioStore = new ScenarioStore();

  /**
   * Run the full decision intelligence pipeline.
   * Guarantees CampaignObject is not mutated.
   */
  run(input: DecisionEngineInput): DecisionEngineResult {
    const snapshotBefore = snapshotCampaignObject(input.campaignObject);

    const baseline = extractCampaignDecisionContext(
      input.campaignObject,
      input.creatorDna
    );

    const clientCreatorIds =
      input.clientCreatorIds ??
      baseline.creators.map((c) => `client_${c.id}`);

    const clientCreatorEvaluations = evaluateClientCreators(
      baseline,
      clientCreatorIds,
      input.creatorDna
    );

    let scenarios = buildStandardScenarios(
      baseline,
      input.creatorDna,
      clientCreatorIds
    );

    if (input.scenarioDeltas?.length) {
      for (const delta of input.scenarioDeltas) {
        scenarios.push(
          createScenario(delta.name, baseline, delta.changes, input.creatorDna)
        );
      }
    }

    for (const scenario of scenarios) {
      this.scenarioStore.add(scenario);
    }

    const comparison = compareScenarios(scenarios);
    const recommendations = aggregateRecommendations(scenarios);
    const approvalSummary = buildApprovalSummary(
      baseline,
      scenarios,
      recommendations,
      clientCreatorEvaluations
    );

    const snapshotAfter = snapshotCampaignObject(input.campaignObject);
    if (snapshotBefore !== snapshotAfter) {
      throw new Error(
        "CampaignObject mutation detected — decision engine must remain read-only"
      );
    }

    if (!assertCampaignObjectImmutable(input.campaignObject, input.campaignObject)) {
      throw new Error("CampaignObject immutability assertion failed");
    }

    return {
      campaignObjectId: input.campaignObject.id,
      baseline,
      scenarios,
      comparison,
      clientCreatorEvaluations,
      approvalSummary,
      recommendations,
    };
  }

  /** Run a single custom scenario against a campaign. */
  runScenario(
    campaignObject: CampaignObject,
    name: string,
    changes: ScenarioChanges,
    creatorDna?: Map<string, CreatorDNADocument>
  ) {
    const snapshotBefore = snapshotCampaignObject(campaignObject);
    const baseline = extractCampaignDecisionContext(campaignObject, creatorDna);
    const scenario = createScenario(name, baseline, changes, creatorDna);
    this.scenarioStore.add(scenario);

    const snapshotAfter = snapshotCampaignObject(campaignObject);
    if (snapshotBefore !== snapshotAfter) {
      throw new Error("CampaignObject mutation detected");
    }

    return scenario;
  }

  getScenarioStore(): ScenarioStore {
    return this.scenarioStore;
  }
}

/** Singleton-style convenience runner. */
export function runDecisionEngine(input: DecisionEngineInput): DecisionEngineResult {
  return new DecisionEngine().run(input);
}

export { validateRecommendationStructure };
