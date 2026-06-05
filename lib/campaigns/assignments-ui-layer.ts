/**
 * Assignments UI always uses the full operational layer.
 * Legacy NEXT_PUBLIC_ASSIGNMENTS_UI_LAYER values are accepted but ignored.
 */

export type AssignmentsUiLayer =
  | "minimal"
  | "rows"
  | "expansion"
  | "billing_pills"
  | "operational_actions"
  | "invoice_dialogs";

const FULL_LAYER: AssignmentsUiLayer = "invoice_dialogs";

/** @deprecated Bisect layers removed — only full layer is active. */
export const ASSIGNMENTS_UI_LAYERS = [FULL_LAYER] as const;

export function getAssignmentsUiLayer(): AssignmentsUiLayer {
  return FULL_LAYER;
}

export function assignmentsLayerAtLeast(
  _current: AssignmentsUiLayer,
  _required: AssignmentsUiLayer
): boolean {
  return true;
}

export function assignmentsLayerLabel(_layer: AssignmentsUiLayer): string {
  return "full";
}
