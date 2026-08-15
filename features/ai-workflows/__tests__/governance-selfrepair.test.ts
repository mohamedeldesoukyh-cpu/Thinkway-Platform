import "./test-env-preload";

import assert from "node:assert/strict";

import type { AiContext, AiOrchestrator, AiRequest } from "@/features/ai";
import { createCampaignWorkflow } from "@/features/ai-workflows/definitions/create-campaign";
import { executeWorkflow, resumeWorkflow } from "@/features/ai-workflows/engine/workflow-engine";
import { getDirectorPipelineFromState } from "@/features/campaign-director/integrations/workflow-integration";
import { runCampaignDirectorPipeline } from "@/features/campaign-director/services/campaign-director";
import type { CampaignFacts } from "@/features/campaign-director/facts/campaign-facts-types";
import type { DirectorPipelineResult } from "@/features/campaign-director/types/pipeline";

const dummyOrchestrator = {} as unknown as AiOrchestrator;

const baseContext: AiContext = { workspace: { type: "general" }, user: { id: "test-user" } };

function request(message: string): AiRequest {
  return { id: `req_${Math.random().toString(36).slice(2)}`, message };
}

function factsWithPlaceholderKpi(): CampaignFacts {
  return {
    brandName: "BabyJoy",
    objective: "brand awareness and trial",
    budget: { amount: 500_000, currency: "EGP" },
    durationWeeks: 6,
    geography: ["Egypt"],
    audience: "mothers 25-34",
    platforms: ["Instagram", "TikTok"],
    // Placeholder vocabulary straight from a client brief — the QA gate
    // hard-fails it; the self-repair loop must fix it without user input.
    kpis: ["Reach: TBD"],
    extractedAt: new Date().toISOString(),
    confidence: {},
    sources: {},
  };
}

async function run(): Promise<void> {
  // 1) Auto-fixable blocker → repaired without user input, fully logged.
  const repaired: DirectorPipelineResult = runCampaignDirectorPipeline({
    brief: {
      rawMessage:
        "Create a campaign for BabyJoy diapers in Egypt. Budget 500,000 EGP. 6 weeks. Target mothers 25-34 on Instagram and TikTok. Objective: brand awareness and trial.",
      brandName: "BabyJoy",
    },
    campaignFacts: factsWithPlaceholderKpi(),
  });
  assert.equal(repaired.approvalGate.approved, true, "placeholder KPI must be auto-repaired");
  assert.ok(repaired.governanceRepair, "repair summary must be present");
  assert.equal(repaired.governanceRepair!.outcome, "approved_after_repair");
  assert.ok(repaired.governanceRepair!.attempts >= 1);
  assert.ok(
    repaired.governanceRepair!.log.some((entry) => entry.checkId === "qa_no_placeholder"),
    "repair log must record the placeholder blocker and its repair"
  );
  assert.ok(repaired.approvedSections.length > 0, "approved sections must be released");
  assert.ok(
    !JSON.stringify(repaired.strategyDocument.understanding.kpis).match(/\btbd\b/i),
    "placeholder vocabulary must be scrubbed from the strategy"
  );

  // 2) User-required blocker (no budget) → workflow pauses with a specific question.
  // Wave 0: regex extract is not Campaign Facts SSOT. Seed facts as a confirmed CIP would.
  const briefWithoutBudget =
    "Create a campaign for Nova Skincare in Egypt. Target women 25-34 on Instagram. Objective: brand awareness. Duration 6 weeks.";
  const seededFacts: CampaignFacts = {
    brandName: "Nova Skincare",
    objective: "brand awareness",
    durationWeeks: 6,
    geography: ["Egypt"],
    audience: "women 25-34",
    platforms: ["Instagram"],
    extractedAt: new Date().toISOString(),
    confidence: {},
    sources: {},
  };
  const first = await executeWorkflow(createCampaignWorkflow, request(briefWithoutBudget), baseContext, {
    orchestrator: dummyOrchestrator,
    dryRun: true,
    initialState: {
      workflowId: createCampaignWorkflow.id,
      workflowName: createCampaignWorkflow.name,
      currentTaskIndex: 0,
      taskResults: {},
      data: { campaignFacts: seededFacts },
      status: "running",
    },
  });
  assert.equal(first.state.status, "paused", "missing budget must pause, not fail silently");
  assert.equal(first.state.pauseReason, "missing_info");
  assert.match(
    first.state.pauseMessage ?? "",
    /budget/i,
    "pause message must ask specifically for the budget"
  );
  const pausedPipeline = getDirectorPipelineFromState(first.state.data);
  assert.ok(pausedPipeline?.governanceRepair, "paused run must carry the repair audit");
  assert.ok(
    pausedPipeline!.governanceRepair!.userQuestions.some((q) => /budget/i.test(q.question)),
    "user questions must include the budget question"
  );
  // Completed work is preserved — task results survive the pause.
  assert.ok(Object.keys(first.state.taskResults).length > 0, "completed tasks must be preserved");
  const factsBeforeResume = first.state.data.campaignFacts as CampaignFacts;
  const brandBeforeResume = factsBeforeResume.brandName;

  // 3) Resume with the answer → facts merge fills the budget, governance approves.
  const resumed = await resumeWorkflow(
    createCampaignWorkflow,
    first.state,
    request(`${briefWithoutBudget}\n\nAdditional details: Budget is 750,000 EGP.`),
    baseContext,
    { orchestrator: dummyOrchestrator, dryRun: true }
  );
  assert.equal(resumed.state.status, "completed", "answer must complete the workflow");
  const finalPipeline = getDirectorPipelineFromState(resumed.state.data);
  assert.ok(finalPipeline, "director pipeline must finalize on resume");
  assert.equal(finalPipeline!.approvalGate.approved, true, "governance must approve after the answer");
  assert.ok(finalPipeline!.approvedSections.length > 0, "approved sections must be released on resume");
  const facts = resumed.state.data.campaignFacts as CampaignFacts;
  assert.equal(facts.budget?.amount, 750_000, "resume must fill ONLY the missing budget fact");
  assert.equal(facts.brandName, brandBeforeResume, "existing facts must be preserved");

  console.log("governance-selfrepair.test.ts: PASS");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
