import assert from "node:assert/strict";
import test from "node:test";

import { buildProposalExportHref } from "./campaign-proposal-export-actions";

const OBJECT_ID = "0b6d5f9e-6f0e-4a7f-9c2d-2f6a1f5f2f11";

test("preview href targets the html format with conversation context", () => {
  const href = buildProposalExportHref(OBJECT_ID, "html", "conv-1");
  assert.equal(
    href,
    `/api/ai/campaign-objects/${OBJECT_ID}/export?format=html&conversationId=conv-1`
  );
});

test("download hrefs cover pdf and pptx and omit missing conversation", () => {
  assert.equal(
    buildProposalExportHref(OBJECT_ID, "pdf"),
    `/api/ai/campaign-objects/${OBJECT_ID}/export?format=pdf`
  );
  assert.equal(
    buildProposalExportHref(OBJECT_ID, "pptx"),
    `/api/ai/campaign-objects/${OBJECT_ID}/export?format=pptx`
  );
});

test("conversation ids are url-encoded", () => {
  const href = buildProposalExportHref(OBJECT_ID, "pptx", "conv/with space");
  assert.ok(href.includes("conversationId=conv%2Fwith+space"));
});
