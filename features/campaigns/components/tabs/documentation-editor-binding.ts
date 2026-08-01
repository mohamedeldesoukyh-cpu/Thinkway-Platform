/**
 * Deliverables documentation editor — selection binding guards.
 * Every write must prove the editor is still attached to the intended unit.
 */

export type DocumentationEditorBindingInput = {
  selectedKey: string | null;
  boundDetailUnitKey: string | null;
  selectedAssignmentLineId: string | null;
  boundAssignmentLineId: string | null;
  /** Assignment line id captured when the write was initiated. */
  writeAssignmentLineId: string;
  /** Unit key captured when the write was initiated. */
  writeUnitKey: string;
};

export type DocumentationEditorBindingResult =
  | { ok: true }
  | { ok: false; message: string };

export const DOCUMENTATION_SELECTION_MISMATCH_MESSAGE =
  "Save cancelled — the selected deliverable changed. Nothing was written to the wrong creator.";

export const DOCUMENTATION_UPLOAD_CANCELLED_MESSAGE =
  "Upload cancelled — the selected creator changed while the file was processing. Please select the creator again and retry.";

export const DOCUMENTATION_SELECTION_LOCKED_MESSAGE =
  "A file upload is in progress for this creator. Wait for it to finish before switching.";

/**
 * Validate that selection, bound detail, and assignment identity still match
 * before any documentation write.
 */
export function assertDocumentationEditorBinding(
  input: DocumentationEditorBindingInput
): DocumentationEditorBindingResult {
  const {
    selectedKey,
    boundDetailUnitKey,
    selectedAssignmentLineId,
    boundAssignmentLineId,
    writeAssignmentLineId,
    writeUnitKey,
  } = input;

  if (!selectedKey || selectedKey !== writeUnitKey) {
    return { ok: false, message: DOCUMENTATION_SELECTION_MISMATCH_MESSAGE };
  }
  if (!boundDetailUnitKey || boundDetailUnitKey !== writeUnitKey) {
    return { ok: false, message: DOCUMENTATION_SELECTION_MISMATCH_MESSAGE };
  }
  if (boundDetailUnitKey !== selectedKey) {
    return { ok: false, message: DOCUMENTATION_SELECTION_MISMATCH_MESSAGE };
  }
  if (
    !selectedAssignmentLineId ||
    !boundAssignmentLineId ||
    selectedAssignmentLineId !== writeAssignmentLineId ||
    boundAssignmentLineId !== writeAssignmentLineId ||
    selectedAssignmentLineId !== boundAssignmentLineId
  ) {
    return { ok: false, message: DOCUMENTATION_SELECTION_MISMATCH_MESSAGE };
  }
  return { ok: true };
}
