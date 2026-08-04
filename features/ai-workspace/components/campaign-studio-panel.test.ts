import assert from "node:assert/strict";
import test from "node:test";

import {
  findLatestStudioMessage,
  studioCampaignObjectBindKey,
} from "./campaign-studio-panel-utils";
import type { AiMessage } from "../types";

function msg(id: string, role: AiMessage["role"], metadata: Record<string, unknown>): AiMessage {
  return { id, role, content: "", metadata, createdAt: new Date().toISOString() } as AiMessage;
}

const studioMeta = {
  workflow: true,
  workflowId: "create-campaign",
  workflowStatus: "complete",
  campaignObject: { id: "co-1", sections: {}, meta: {} },
};

test("finds the most recent campaign-studio message (copilot-edit shape)", () => {
  const messages = [
    msg("u1", "user", {}),
    msg("a1", "assistant", studioMeta),
    msg("u2", "user", {}),
    msg("a2", "assistant", { ...studioMeta, copilotEdit: true }),
  ];
  const found = findLatestStudioMessage(messages);
  assert.equal(found?.id, "a2");
});

test("STAB-036: prefers a completed studio package over a later mid-build chip reply", () => {
  const completeMeta = {
    workflow: true,
    workflowId: "create-campaign",
    workflowStatus: "completed",
    campaignObject: {
      id: "co-complete",
      sections: { summary: { status: "complete" } },
      meta: { status: "complete", progressPercent: 100 },
    },
  };
  const buildingMeta = {
    workflow: true,
    workflowId: "create-campaign",
    workflowStatus: "building",
    campaignObject: {
      id: "co-building",
      sections: { summary: { status: "working" } },
      meta: { status: "building", progressPercent: 88 },
    },
  };
  const messages = [
    msg("u1", "user", {}),
    msg("a1", "assistant", completeMeta),
    msg("u2", "user", {}),
    msg("a2", "assistant", buildingMeta),
  ];
  const found = findLatestStudioMessage(messages);
  assert.equal(found?.id, "a1");
});

test("ignores plain chat messages and returns null when no studio exists", () => {
  const messages = [
    msg("u1", "user", {}),
    msg("a1", "assistant", { agentId: "campaign-copilot", copilotIntent: "answer_question" }),
  ];
  assert.equal(findLatestStudioMessage(messages), null);
});

test("a studio message without a campaign object is not a match", () => {
  const messages = [
    msg("a1", "assistant", { workflow: true, workflowId: "create-campaign" }),
  ];
  assert.equal(findLatestStudioMessage(messages), null);
});

test("studio bind key changes when Media Plan start shifts even if updatedAt is unchanged", () => {
  const base = {
    id: "co-1",
    updatedAt: "2026-07-28T10:00:00.000Z",
    meta: {
      campaignFacts: { scheduledStartDate: "2026-07-27", requestedStartDate: "2026-07-24" },
      campaignOutputs: {
        media_plan: {
          version: 1,
          updatedAt: "2026-07-28T10:00:00.000Z",
          content: { data: { campaignStartDate: "2026-07-27", scheduledStartDate: "2026-07-27" } },
        },
      },
      copilotChangeLog: [],
    },
  };
  const shifted = {
    ...base,
    meta: {
      ...base.meta,
      campaignFacts: { scheduledStartDate: "2026-08-03", requestedStartDate: "2026-08-03" },
      campaignOutputs: {
        media_plan: {
          version: 2,
          updatedAt: "2026-07-28T10:05:00.000Z",
          content: { data: { campaignStartDate: "2026-08-03", scheduledStartDate: "2026-08-03" } },
        },
      },
      copilotChangeLog: [{ summary: "start shifted" }],
    },
  };
  assert.notEqual(
    studioCampaignObjectBindKey("m1", base),
    studioCampaignObjectBindKey("m2", shifted)
  );
});
