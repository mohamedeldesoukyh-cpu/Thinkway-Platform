/**
 * Intake does not wait for the eight workflow tasks.
 *
 * The Copilot typed-brief journey persists the Campaign Intelligence at
 * workflow BOOTSTRAP (`workflow-engine.ts` create-campaign block), before the
 * first task runs and before the Director debate. Everything Intake needs to
 * render it is available at that moment:
 *
 *   1. The client already has the conversation id — the chat route sends it as
 *      the SSE `start` event before the workflow begins.
 *   2. Studio renders while streaming: `buildCampaignStudioState` returns a
 *      progress-only state when no campaign object exists yet.
 *   3. Intake is the active step in that state, so IntakeScreen mounts and its
 *      poll (a pure read of the persisted profile) runs.
 *   4. The Intake rows come from the persisted profile alone — no campaign
 *      object required.
 *
 * These tests pin 2–4, so a change that makes Intake depend on a completed
 * workflow fails here rather than in Dev. Point 1 is route/stream wiring and is
 * not exercised.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { buildKerastaseEgyptDocx } from "@/features/campaign-intelligence-profile/fixtures/build-kerastase-docx";
import { profileToCampaignFacts } from "@/features/campaign-intelligence-profile/services/profile-to-facts";
import { runCampaignIntelligencePipeline } from "@/features/campaign-intelligence-profile/services/run-intelligence-pipeline";
import { parseStructuredBriefDocument } from "@/features/campaign-intelligence-profile/services/structured-brief-parser";

import { buildCampaignStudioState } from "../hooks/use-campaign-studio";
import {
  defaultStudioWorkspaceStep,
  resolveStudioWorkspaceSteps,
} from "./studio-workspace-status";
import { mergeIntakeDisplayFacts, requiredIntakeFacts } from "./studio-intake-facts";

/** Exactly what createCampaignStreamingInput produces mid-run: no campaign object. */
function streamingInput(currentStep: number) {
  return {
    workflowId: "create-campaign",
    workflowName: "Create Campaign",
    workflowStatus: "running" as const,
    currentStep,
    totalSteps: 8,
    progressPercent: Math.round((currentStep / 8) * 100),
    taskId: "analyze-request",
    taskTitle: "Analyze request",
    taskStatus: "running" as const,
  };
}

test("Studio renders while the workflow streams, with no campaign object yet", () => {
  const studio = buildCampaignStudioState(streamingInput(1) as never);

  assert.ok(studio, "a progress-only state must render — returning null would hide Intake");
  assert.equal(studio.campaignObject, undefined);
  assert.equal(studio.workflowStatus, "running");
});

test("Intake is the active step throughout the run, so it stays mounted", () => {
  // Every step of the eight, including the last: Intake is unconfirmed the whole
  // time, so it remains the default step and its poll keeps running.
  for (const currentStep of [0, 1, 4, 8]) {
    const studio = buildCampaignStudioState(streamingInput(currentStep) as never)!;
    const steps = resolveStudioWorkspaceSteps({
      campaignObject: studio.campaignObject,
      sections: studio.sections ?? [],
      outdatedSections: new Set<string>(),
    });

    assert.equal(
      defaultStudioWorkspaceStep(steps),
      "intake",
      `step ${currentStep}: Intake must be active for IntakeScreen to be mounted`
    );
  }
});

test("the Intake rows come from the persisted profile alone — no campaign object", async () => {
  // The state during streaming: intelligence persisted at bootstrap, campaign
  // object not yet written by the workflow.
  const parsed = await parseStructuredBriefDocument(
    await buildKerastaseEgyptDocx(),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "kerastase-egypt-brief.docx"
  );
  const { profile } = await runCampaignIntelligencePipeline({
    briefText: parsed.llmText,
    briefTextSource: "upload",
    structuredParserOutput: parsed.document,
  });

  // `facts` is undefined — exactly what getCampaignFacts(undefined) yields.
  const displayFacts = mergeIntakeDisplayFacts(undefined, profileToCampaignFacts(profile));
  const view = requiredIntakeFacts(displayFacts);
  const valueOf = (key: string) => view.rows.find((row) => row.key === key)?.value ?? null;

  assert.equal(valueOf("brand"), "Kérastase");
  assert.equal(valueOf("country"), "Egypt");
  assert.equal(valueOf("budget"), "EGP 3,000,000");
  assert.equal(valueOf("category"), "Beauty & Personal Care");
  assert.match(valueOf("audience") ?? "", /Women aged 20[–-]40 in Egypt/i);
  assert.ok(valueOf("deliverables"), "deliverables must render before the workflow finishes");
  assert.ok(valueOf("kpis"), "KPIs must render before the workflow finishes");

  assert.ok(
    view.rows.some((row) => row.state === "confirmed"),
    "Intake must be populated from the profile with no completed workflow at all"
  );
});
