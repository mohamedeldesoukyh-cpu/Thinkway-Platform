import assert from "node:assert/strict";
import test from "node:test";

import {
  formatMediaPlanVersionLabel,
  nextMediaPlanVersion,
  resolveMediaPlanVersionParts,
  shouldCreateNewBusinessVersion,
  toBusinessStatus,
} from "./media-plan-versioning";
import {
  regenerateMediaPlanOutput,
  reviseMediaPlanOutput,
} from "./media-plan-revise-regenerate";
import {
  approveMediaPlanOnCampaignObject,
  ensureMediaPlanLifecycle,
  lockMediaPlanOnCampaignObject,
} from "./media-plan-mutations";
import { generateCampaignOutput, restoreOutputVersion } from "./output-registry";
import { asMediaPlanData } from "./generators/media-plan";
import type { CampaignObject } from "@/features/campaign-intelligence";

function emptyCampaign(): CampaignObject {
  return {
    id: "co-mp",
    conversationId: "conv-mp",
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

test("version helpers: revise minor, regenerate major", () => {
  assert.equal(formatMediaPlanVersionLabel(1, 2), "v1.2");
  assert.deepEqual(resolveMediaPlanVersionParts({ version: 3 }), { major: 3, minor: 0 });

  const initial = nextMediaPlanVersion(null, "initial");
  assert.equal(initial.versionLabel, "v1.0");

  const revise = nextMediaPlanVersion(
    { version: 1, versionMajor: 1, versionMinor: 0 },
    "revise"
  );
  assert.equal(revise.versionLabel, "v1.1");
  assert.equal(revise.version, 2);

  const regenerate = nextMediaPlanVersion(
    { version: 2, versionMajor: 1, versionMinor: 1 },
    "regenerate"
  );
  assert.equal(regenerate.versionLabel, "v2.0");
  assert.equal(regenerate.version, 3);
});

test("SSOT mapping: locked → Under Review; approval is version boundary", () => {
  assert.equal(toBusinessStatus("draft"), "draft");
  assert.equal(toBusinessStatus("locked"), "under_review");
  assert.equal(toBusinessStatus("approved_by_client"), "approved");

  assert.equal(
    shouldCreateNewBusinessVersion({
      engineStatus: "draft",
      operation: "revise",
    }),
    false
  );
  assert.equal(
    shouldCreateNewBusinessVersion({
      engineStatus: "locked",
      operation: "regenerate",
    }),
    false
  );
  assert.equal(
    shouldCreateNewBusinessVersion({
      engineStatus: "approved_by_client",
      operation: "revise",
    }),
    true
  );
  assert.equal(
    shouldCreateNewBusinessVersion({
      engineStatus: "draft",
      forkedFromApproved: true,
      operation: "revise",
    }),
    true
  );
});

test("pre-approval edits stay on v1.0 and append audit history", () => {
  let obj = ensureMediaPlanLifecycle(emptyCampaign());
  const first = generateCampaignOutput(obj, "media_plan", {
    now: "2026-07-01T00:00:00.000Z",
  });
  assert.equal(first.record.versionLabel, "v1.0");
  assert.equal(first.record.operation, "initial");
  assert.equal(first.record.businessStatus, "draft");
  obj = first.campaignObject;

  const data = asMediaPlanData(first.record.content?.data);
  assert.ok(data);

  const edit1 = reviseMediaPlanOutput(obj, { ...data!, durationWeeks: 5 }, {
    now: "2026-07-01T01:00:00.000Z",
    changeReason: "User changed duration",
    before: { durationWeeks: 4 },
    after: { durationWeeks: 5 },
  });
  assert.ok(edit1);
  assert.equal(edit1!.record.versionLabel, "v1.0");
  assert.ok((edit1!.record.auditHistory?.length ?? 0) >= 1);
  obj = edit1!.campaignObject;

  const edit2 = reviseMediaPlanOutput(
    obj,
    { ...asMediaPlanData(obj.meta.campaignOutputs!.media_plan!.content!.data)!, durationWeeks: 6 },
    {
      now: "2026-07-01T02:00:00.000Z",
      changeReason: "User changed duration again",
    }
  );
  assert.ok(edit2);
  assert.equal(edit2!.record.versionLabel, "v1.0");
  assert.ok((edit2!.record.auditHistory?.length ?? 0) >= 2);
  // Business history must not grow for working edits
  assert.equal((edit2!.record.history?.length ?? 0), 0);

  const locked = lockMediaPlanOnCampaignObject(edit2!.campaignObject, {
    at: "2026-07-01T03:00:00.000Z",
  });
  assert.ok(locked.ok);
  assert.equal(locked.campaignObject.meta.campaignOutputs?.media_plan?.versionLabel, "v1.0");
  assert.equal(
    locked.campaignObject.meta.campaignOutputs?.media_plan?.businessStatus,
    "under_review"
  );
});

test("post-approval revise opens v1.1; regenerate opens v2.0", () => {
  let obj = ensureMediaPlanLifecycle(emptyCampaign());
  obj = generateCampaignOutput(obj, "media_plan", {
    now: "2026-07-01T00:00:00.000Z",
  }).campaignObject;

  const approved = approveMediaPlanOnCampaignObject(obj, {
    at: "2026-07-01T04:00:00.000Z",
    actorUserId: "user-1",
    method: "client_portal",
  });
  assert.ok(approved.ok);
  obj = approved.campaignObject;
  const tip = obj.meta.campaignOutputs!.media_plan!;
  assert.equal(tip.versionLabel, "v1.0");
  assert.equal(tip.businessStatus, "approved");
  assert.equal(tip.approvedBy, "user-1");
  assert.equal(tip.approvalSource, "client");
  assert.ok(tip.approvedAt);

  const data = asMediaPlanData(tip.content?.data)!;
  const revised = reviseMediaPlanOutput(obj, { ...data, durationWeeks: 8 }, {
    now: "2026-07-01T05:00:00.000Z",
    changeSummary: "Client delayed campaign.",
  });
  assert.ok(revised);
  assert.equal(revised!.record.versionLabel, "v1.1");
  assert.equal(revised!.record.operation, "revise");
  assert.equal(revised!.record.businessStatus, "draft");
  assert.equal(revised!.record.approvalImpact, "internal");
  assert.equal(revised!.record.approvedBy, null);
  assert.equal((revised!.record.history?.length ?? 0), 1);
  obj = revised!.campaignObject;

  // Working edit on v1.1 Draft — still v1.1
  const data2 = asMediaPlanData(obj.meta.campaignOutputs!.media_plan!.content!.data)!;
  const working = reviseMediaPlanOutput(obj, { ...data2, durationWeeks: 9 }, {
    now: "2026-07-01T06:00:00.000Z",
  });
  assert.ok(working);
  assert.equal(working!.record.versionLabel, "v1.1");
  obj = working!.campaignObject;

  // Approve v1.1 then regenerate → v2.0
  const approved2 = approveMediaPlanOnCampaignObject(obj, {
    at: "2026-07-01T07:00:00.000Z",
    actorUserId: "user-1",
    method: "on_behalf",
  });
  assert.ok(approved2.ok);
  obj = approved2.campaignObject;
  assert.equal(obj.meta.campaignOutputs!.media_plan!.versionLabel, "v1.1");
  assert.equal(obj.meta.campaignOutputs!.media_plan!.approvalSource, "internal");

  const regenerated = regenerateMediaPlanOutput(obj, {
    now: "2026-07-01T08:00:00.000Z",
  });
  assert.equal(regenerated.record.versionLabel, "v2.0");
  assert.equal(regenerated.record.operation, "regenerate");
  assert.equal(regenerated.record.approvalImpact, "client_reapproval");
});

test("restore creates a new minor business version (append-only)", () => {
  let obj = ensureMediaPlanLifecycle(emptyCampaign());
  obj = generateCampaignOutput(obj, "media_plan", {
    now: "2026-07-01T00:00:00.000Z",
  }).campaignObject;

  obj = approveMediaPlanOnCampaignObject(obj, {
    at: "2026-07-01T01:00:00.000Z",
    method: "client_portal",
    actorUserId: "u1",
  }).campaignObject as CampaignObject;

  const data = asMediaPlanData(obj.meta.campaignOutputs!.media_plan!.content!.data)!;
  obj = reviseMediaPlanOutput(obj, { ...data, durationWeeks: 8 }, {
    now: "2026-07-01T02:00:00.000Z",
  })!.campaignObject;

  assert.equal(obj.meta.campaignOutputs!.media_plan!.versionLabel, "v1.1");

  const restored = restoreOutputVersion(obj, "media_plan", 1, {
    now: "2026-07-01T03:00:00.000Z",
    origin: "user",
  });
  assert.ok(restored);
  assert.equal(restored!.record.operation, "restore");
  assert.equal(restored!.record.versionLabel, "v1.2");
  assert.match(restored!.record.changeSummary ?? "", /Restored/);
  assert.equal(restored!.record.businessStatus, "draft");
});

test("working regenerate before approval does not bump business version", () => {
  let obj = ensureMediaPlanLifecycle(emptyCampaign());
  obj = generateCampaignOutput(obj, "media_plan", {
    now: "2026-07-01T00:00:00.000Z",
  }).campaignObject;
  assert.equal(obj.meta.campaignOutputs!.media_plan!.versionLabel, "v1.0");

  const again = regenerateMediaPlanOutput(obj, {
    now: "2026-07-01T01:00:00.000Z",
  });
  assert.equal(again.record.versionLabel, "v1.0");
  assert.ok((again.record.auditHistory?.length ?? 0) >= 1);
  assert.equal((again.record.history?.length ?? 0), 0);
});
