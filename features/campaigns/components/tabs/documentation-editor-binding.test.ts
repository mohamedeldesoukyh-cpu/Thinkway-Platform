import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DOCUMENTATION_SELECTION_MISMATCH_MESSAGE,
  assertDocumentationEditorBinding,
} from "./documentation-editor-binding";

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
});
