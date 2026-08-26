import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DOCUMENTATION_SELECTION_MISMATCH_MESSAGE,
  assertDocumentationEditorBinding,
  stampDocumentationDetailIdentity,
} from "./documentation-editor-binding";
import { emptyAgg } from "@/lib/services/deliverables/build-documentation-units";
import type { DocumentationUnitDetail } from "@/lib/services/deliverables/documentation-types";

describe("assertDocumentationEditorBinding", () => {
  const base = {
    selectedKey: "d:del-1",
    boundDetailUnitKey: "d:del-1",
    selectedAssignmentLineId: "line-a",
    boundAssignmentLineId: "line-a",
    writeAssignmentLineId: "line-a",
    writeUnitKey: "d:del-1",
  };

  it("allows writes when selection, detail, and assignment ids match", () => {
    const result = assertDocumentationEditorBinding(base);
    assert.equal(result.ok, true);
  });

  it("rejects when selectedKey drifted", () => {
    const result = assertDocumentationEditorBinding({
      ...base,
      selectedKey: "d:del-2",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.message, DOCUMENTATION_SELECTION_MISMATCH_MESSAGE);
    }
  });

  it("rejects when bound detail belongs to another unit", () => {
    const result = assertDocumentationEditorBinding({
      ...base,
      boundDetailUnitKey: "d:del-2",
      boundAssignmentLineId: "line-b",
    });
    assert.equal(result.ok, false);
  });

  it("rejects when assignment ids diverge", () => {
    const result = assertDocumentationEditorBinding({
      ...base,
      boundAssignmentLineId: "line-b",
    });
    assert.equal(result.ok, false);
  });

  it("allows writes when detail stubs assignmentLineId as empty", () => {
    const result = assertDocumentationEditorBinding({
      ...base,
      boundAssignmentLineId: "",
    });
    assert.equal(result.ok, true);
  });

  it("stamps list-row identity onto a stub detail payload", () => {
    const unit = {
      unitKey: "p:post-1",
      campaignHeaderId: "hdr-1",
      assignmentDeliverableId: "del-1",
      assignmentPostScheduleId: "post-1",
      sequenceNumber: 1,
      label: "Instagram reel (#1)",
      creatorId: "c1",
      creatorName: "omar_dem",
      assignmentLineId: "line-a",
      assignmentName: "Assignment",
      platform: "instagram",
      deliverableType: "reel",
      dueDate: null,
      quantity: 7,
      received: false,
      ...emptyAgg(),
    };
    const detail: DocumentationUnitDetail = {
      ...unit,
      unitKey: "p:post-1",
      assignmentLineId: "",
      assignmentName: "",
      creatorId: null,
      creatorName: null,
      label: "",
      assets: [],
      comments: [],
      events: [],
    };
    const stamped = stampDocumentationDetailIdentity(detail, unit);
    assert.equal(stamped?.assignmentLineId, "line-a");
    assert.equal(stamped?.creatorName, "omar_dem");
    assert.equal(stamped?.unitKey, "p:post-1");
  });

  it("refuses to stamp detail onto a different deliverable", () => {
    const unit = {
      unitKey: "d:del-2",
      campaignHeaderId: "hdr-1",
      assignmentDeliverableId: "del-2",
      assignmentPostScheduleId: null,
      sequenceNumber: null,
      label: "Reel",
      creatorId: "c1",
      creatorName: "Omar",
      assignmentLineId: "line-b",
      assignmentName: "Assignment",
      platform: "instagram",
      deliverableType: "reel",
      dueDate: null,
      quantity: 1,
      received: false,
      ...emptyAgg(),
    };
    const detail: DocumentationUnitDetail = {
      ...unit,
      assignmentDeliverableId: "del-1",
      unitKey: "d:del-1",
      assets: [],
      comments: [],
      events: [],
    };
    assert.equal(stampDocumentationDetailIdentity(detail, unit), null);
  });
});
