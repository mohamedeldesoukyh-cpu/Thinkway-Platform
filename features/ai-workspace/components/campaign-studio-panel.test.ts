import assert from "node:assert/strict";
import test from "node:test";

import { findLatestStudioMessage } from "./campaign-studio-panel-utils";
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
