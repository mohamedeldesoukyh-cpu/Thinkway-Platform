/**
 * End-to-end validation for MEDIA_PLAN_VERSIONING.md (SSOT).
 * Release 2.0 inclusion gate — all scenarios must pass.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { CampaignObject } from "@/features/campaign-intelligence";

import { asMediaPlanData } from "./generators/media-plan";
import {
  approveMediaPlanOnCampaignObject,
  ensureMediaPlanLifecycle,
  lockMediaPlanOnCampaignObject,
} from "./media-plan-mutations";
import {
  regenerateMediaPlanOutput,
  reviseMediaPlanOutput,
} from "./media-plan-revise-regenerate";
import {
  compareOutputVersions,
  generateCampaignOutput,
  restoreOutputVersion,
} from "./output-registry";
import { parseStudioIntentFallback } from "@/features/campaign-studio/services/copilot/studio-copilot-parse";

function emptyCampaign(): CampaignObject {
  return {
    id: "co-e2e",
    conversationId: "conv-e2e",
    workflowId: "create-campaign",
    updatedAt: new Date().toISOString(),
    sections: {
      summary: { status: "complete", content: "", data: {} },
      creators: {
        status: "complete",
        content: "",
        data: {
          recommendations: {
            creatorIds: ["c1"],
            selectedReasoning: [
              {
                creatorId: "c1",
                displayName: "Creator One",
                tier: "Macro",
                platform: "Instagram",
              },
            ],
          },
        },
      },
      budget: { status: "complete", content: "", data: {} },
      timeline: { status: "complete", content: "", data: {} },
      performance: { status: "complete", content: "", data: {} },
    },
    meta: {
      status: "complete",
      specialistProgress: [],
      campaignFacts: {
        brandName: "Acme",
        durationWeeks: 4,
        campaignStartDate: "2026-07-27",
        requestedStartDate: "2026-07-27",
        scheduledStartDate: "2026-07-27",
        platforms: ["Instagram"],
      },
    },
  } as unknown as CampaignObject;
}

test("E2E SSOT: full Media Plan version governance lifecycle", () => {
  let obj = ensureMediaPlanLifecycle(emptyCampaign());

  // 1) Initial → v1.0 Draft
  obj = generateCampaignOutput(obj, "media_plan", {
    now: "2026-07-01T09:00:00.000Z",
  }).campaignObject;
  let tip = obj.meta.campaignOutputs!.media_plan!;
  assert.equal(tip.versionLabel, "v1.0");
  assert.equal(tip.businessStatus, "draft");
  assert.equal(tip.history?.length ?? 0, 0);

  // 2) Multiple edits before approval remain on v1.0 + independent audit
  const data0 = asMediaPlanData(tip.content?.data)!;
  obj = reviseMediaPlanOutput(obj, { ...data0, durationWeeks: 5 }, {
    now: "2026-07-01T09:30:00.000Z",
    changeReason: "User changed start / duration",
    before: { durationWeeks: 4 },
    after: { durationWeeks: 5 },
  })!.campaignObject;
  tip = obj.meta.campaignOutputs!.media_plan!;
  assert.equal(tip.versionLabel, "v1.0");
  const auditAfterEdit1 = tip.auditHistory?.length ?? 0;
  assert.ok(auditAfterEdit1 >= 1);

  obj = reviseMediaPlanOutput(
    obj,
    { ...asMediaPlanData(tip.content?.data)!, durationWeeks: 6 },
    {
      now: "2026-07-01T10:15:00.000Z",
      changeReason: "User moved Creator A / posting dates",
    }
  )!.campaignObject;
  tip = obj.meta.campaignOutputs!.media_plan!;
  assert.equal(tip.versionLabel, "v1.0");
  assert.ok((tip.auditHistory?.length ?? 0) > auditAfterEdit1);
  assert.equal(tip.history?.length ?? 0, 0, "audit must not create business history");

  // 3) Draft → Under Review (lock) — still v1.0
  const locked = lockMediaPlanOnCampaignObject(obj, {
    at: "2026-07-01T11:00:00.000Z",
    actorUserId: "am-1",
  });
  assert.ok(locked.ok);
  obj = locked.campaignObject;
  tip = obj.meta.campaignOutputs!.media_plan!;
  assert.equal(tip.versionLabel, "v1.0");
  assert.equal(tip.businessStatus, "under_review");

  // 4) Under Review → Approved — freezes v1.0, governance fields set
  const approved = approveMediaPlanOnCampaignObject(obj, {
    at: "2026-07-01T12:00:00.000Z",
    actorUserId: "client-1",
    method: "client_portal",
  });
  assert.ok(approved.ok);
  obj = approved.campaignObject;
  tip = obj.meta.campaignOutputs!.media_plan!;
  assert.equal(tip.versionLabel, "v1.0");
  assert.equal(tip.businessStatus, "approved");
  assert.equal(tip.approvedBy, "client-1");
  assert.equal(tip.approvalSource, "client");
  assert.ok(tip.approvedAt);

  // 5) Revision after approval → v1.1
  const dataApproved = asMediaPlanData(tip.content?.data)!;
  obj = reviseMediaPlanOutput(obj, { ...dataApproved, durationWeeks: 8 }, {
    now: "2026-07-01T13:00:00.000Z",
    changeSummary: "Client delayed campaign",
  })!.campaignObject;
  tip = obj.meta.campaignOutputs!.media_plan!;
  assert.equal(tip.versionLabel, "v1.1");
  assert.equal(tip.operation, "revise");
  assert.equal(tip.businessStatus, "draft");
  assert.equal(tip.approvalImpact, "internal");
  assert.equal(tip.approvedBy, null);
  assert.equal(tip.history?.length, 1);

  // Working edit on v1.1 Draft — still v1.1
  obj = reviseMediaPlanOutput(
    obj,
    { ...asMediaPlanData(tip.content?.data)!, durationWeeks: 9 },
    { now: "2026-07-01T13:30:00.000Z", changeReason: "Internal schedule tweak" }
  )!.campaignObject;
  tip = obj.meta.campaignOutputs!.media_plan!;
  assert.equal(tip.versionLabel, "v1.1");

  // Compare reflects business versions clearly
  const diff = compareOutputVersions(obj, "media_plan");
  assert.ok(diff);
  assert.equal(diff!.fromVersionLabel, "v1.0");
  assert.equal(diff!.toVersionLabel, "v1.1");

  // Approve v1.1 then Regenerate → v2.0
  const approved2 = approveMediaPlanOnCampaignObject(obj, {
    at: "2026-07-01T14:00:00.000Z",
    actorUserId: "am-1",
    method: "on_behalf",
  });
  assert.ok(approved2.ok);
  obj = approved2.campaignObject;
  assert.equal(obj.meta.campaignOutputs!.media_plan!.versionLabel, "v1.1");
  assert.equal(obj.meta.campaignOutputs!.media_plan!.approvalSource, "internal");

  obj = regenerateMediaPlanOutput(obj, {
    now: "2026-07-01T15:00:00.000Z",
  }).campaignObject;
  tip = obj.meta.campaignOutputs!.media_plan!;
  assert.equal(tip.versionLabel, "v2.0");
  assert.equal(tip.operation, "regenerate");
  assert.equal(tip.approvalImpact, "client_reapproval");

  // 6) Restore creates append-only new version
  const restored = restoreOutputVersion(obj, "media_plan", 1, {
    now: "2026-07-01T16:00:00.000Z",
    origin: "user",
  });
  assert.ok(restored);
  assert.equal(restored!.record.operation, "restore");
  assert.equal(restored!.record.versionLabel, "v2.1");
  assert.equal(restored!.record.businessStatus, "draft");
  // Prior business versions remain in history
  assert.ok((restored!.record.history?.length ?? 0) >= 2);
});

test("E2E SSOT: AI intent hierarchy — Revise path preferred; regenerate only when explicit", () => {
  // Operational date change → update_timeline (Revise), never generate/regenerate
  assert.equal(
    parseStudioIntentFallback("Change the campaign start date to 24 July 2026").kind,
    "update_timeline"
  );
  assert.equal(
    parseStudioIntentFallback("Move the start date forward by one week").kind,
    "update_timeline"
  );

  // Explicit regenerate wording → regenerate_output
  assert.equal(
    parseStudioIntentFallback("Regenerate the Media Plan").kind,
    "regenerate_output"
  );
  assert.equal(
    parseStudioIntentFallback("Rebuild the media plan from scratch").kind,
    "regenerate_output"
  );

  // Copilot system prompt encodes Ask-before-Regenerate when ambiguous
  const copilotSrc = readFileSync(
    join(process.cwd(), "features/campaign-studio/services/copilot/studio-copilot.ts"),
    "utf8"
  );
  assert.match(copilotSrc, /ask the user to confirm/i);
  assert.match(copilotSrc, /never silently regenerate/i);
  assert.match(copilotSrc, /prefer \*\*Revise\*\*/i);
});
