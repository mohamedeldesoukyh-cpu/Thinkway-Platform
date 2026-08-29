import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildCampaignScriptOriginalStoragePath,
  campaignScriptOriginalMimeType,
  campaignScriptOriginalPathBelongsToUnit,
  campaignScriptOriginalPreviewKind,
  campaignScriptOriginalSlot,
  CAMPAIGN_SCRIPT_ORIGINAL_QTY1_SLOT,
  resolveOriginalDocumentForSave,
  sanitizeCampaignScriptOriginalFileName,
} from "./original-document";

const HEADER = "campaign-1";
const REEL = "del-reel-1";
const STORY = "del-story-1";
const POST_1 = "post-story-1";
const POST_2 = "post-story-2";

test("qty=1 original files use the deliverable slot, not a post folder", () => {
  assert.equal(campaignScriptOriginalSlot(null), CAMPAIGN_SCRIPT_ORIGINAL_QTY1_SLOT);
  const path = buildCampaignScriptOriginalStoragePath({
    campaignHeaderId: HEADER,
    assignmentDeliverableId: REEL,
    revisionId: "rev-1",
    fileName: "Original Script.pdf",
  });
  assert.equal(path, `${HEADER}/${REEL}/deliverable/rev-1/Original_Script.pdf`);
  assert.equal(
    campaignScriptOriginalPathBelongsToUnit(path, {
      campaignHeaderId: HEADER,
      assignmentDeliverableId: REEL,
    }),
    true
  );
  assert.equal(
    campaignScriptOriginalPathBelongsToUnit(path, {
      campaignHeaderId: HEADER,
      assignmentDeliverableId: REEL,
      assignmentPostScheduleId: POST_1,
    }),
    false
  );
});

test("qty>1 original files stay on the post unit", () => {
  const path = buildCampaignScriptOriginalStoragePath({
    campaignHeaderId: HEADER,
    assignmentDeliverableId: STORY,
    assignmentPostScheduleId: POST_1,
    revisionId: "rev-2",
    fileName: "Original Script.docx",
  });
  assert.equal(path.includes(POST_1), true);
  assert.equal(path.includes(POST_2), false);
  assert.equal(
    campaignScriptOriginalPathBelongsToUnit(path, {
      campaignHeaderId: HEADER,
      assignmentDeliverableId: STORY,
      assignmentPostScheduleId: POST_1,
    }),
    true
  );
  assert.equal(
    campaignScriptOriginalPathBelongsToUnit(path, {
      campaignHeaderId: HEADER,
      assignmentDeliverableId: STORY,
      assignmentPostScheduleId: POST_2,
    }),
    false
  );
});

test("text edits carry the previous original document onto the next revision", () => {
  const previous = {
    fileName: "Original Script.pdf",
    storageBucket: "deliverable-assets",
    storagePath: `${HEADER}/${REEL}/deliverable/rev-1/Original_Script.pdf`,
    mimeType: "application/pdf",
    fileSize: 12,
  };
  const carried = resolveOriginalDocumentForSave({ previous });
  assert.deepEqual(carried, previous);
  const incoming = {
    ...previous,
    storagePath: `${HEADER}/${REEL}/deliverable/rev-2/Replacement.pdf`,
    fileName: "Replacement.pdf",
  };
  assert.equal(resolveOriginalDocumentForSave({ incoming, previous })?.storagePath, incoming.storagePath);
});

test("preview uses existing PDF capability and leaves docx as download-only", () => {
  assert.equal(sanitizeCampaignScriptOriginalFileName("Original Script.pdf"), "Original_Script.pdf");
  assert.equal(campaignScriptOriginalMimeType("brief.docx", null).includes("wordprocessingml"), true);
  assert.equal(campaignScriptOriginalPreviewKind("application/pdf", "Original Script.pdf"), "pdf");
  assert.equal(
    campaignScriptOriginalPreviewKind(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Original Script.docx"
    ),
    null
  );
});
