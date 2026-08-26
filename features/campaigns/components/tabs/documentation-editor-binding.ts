/**
 * Deliverables documentation editor — selection binding guards.
 * Every write must prove the editor is still attached to the intended unit.
 */

import type {
  DocumentationUnitDetail,
  DocumentationUnitSummary,
} from "@/lib/services/deliverables/documentation-types";

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
  if (!selectedAssignmentLineId || selectedAssignmentLineId !== writeAssignmentLineId) {
    return { ok: false, message: DOCUMENTATION_SELECTION_MISMATCH_MESSAGE };
  }
  // Detail payloads historically stub assignmentLineId as "". Treat that as
  // "not provided" — unitKey already proves the editor is on this row.
  const boundLine = boundAssignmentLineId?.trim() || null;
  if (boundLine && boundLine !== writeAssignmentLineId) {
    return { ok: false, message: DOCUMENTATION_SELECTION_MISMATCH_MESSAGE };
  }
  return { ok: true };
}

/**
 * Copy list-row identity onto a detail payload. The detail service does not
 * load assignment/creator fields, so the editor must stamp them from the
 * selected repository unit before any write guard runs.
 */
export function stampDocumentationDetailIdentity(
  detail: DocumentationUnitDetail,
  unit: DocumentationUnitSummary
): DocumentationUnitDetail | null {
  if (detail.assignmentDeliverableId !== unit.assignmentDeliverableId) {
    return null;
  }
  if (
    (detail.assignmentPostScheduleId ?? null) !==
    (unit.assignmentPostScheduleId ?? null)
  ) {
    return null;
  }
  return {
    ...detail,
    unitKey: unit.unitKey,
    assignmentLineId: unit.assignmentLineId,
    assignmentName: unit.assignmentName,
    creatorId: unit.creatorId,
    creatorName: unit.creatorName,
    label: unit.label,
    sequenceNumber: unit.sequenceNumber,
    platform: unit.platform,
    deliverableType: unit.deliverableType,
    quantity: unit.quantity,
  };
}
