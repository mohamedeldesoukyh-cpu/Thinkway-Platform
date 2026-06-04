/**
 * Progressive Assignments tab layers — bump via NEXT_PUBLIC_ASSIGNMENTS_UI_LAYER.
 * Order: minimal → rows → expansion → billing_pills → operational_actions → invoice_dialogs
 */
export const ASSIGNMENTS_UI_LAYERS = [
  "minimal",
  "rows",
  "expansion",
  "billing_pills",
  "operational_actions",
  "invoice_dialogs",
] as const;

export type AssignmentsUiLayer = (typeof ASSIGNMENTS_UI_LAYERS)[number];

const LAYER_RANK: Record<AssignmentsUiLayer, number> = {
  minimal: 0,
  rows: 1,
  expansion: 2,
  billing_pills: 3,
  operational_actions: 4,
  invoice_dialogs: 5,
};

/**
 * Default after Assignments tab isolation: rows render safely; selection + VIO footer restored.
 * Set NEXT_PUBLIC_ASSIGNMENTS_UI_LAYER=rows to roll back. Use invoice_dialogs for invoice sheets.
 */
const DEFAULT_LAYER: AssignmentsUiLayer = "operational_actions";

function parseLayer(raw: string | undefined): AssignmentsUiLayer {
  const value = raw?.trim().toLowerCase();
  if (value && ASSIGNMENTS_UI_LAYERS.includes(value as AssignmentsUiLayer)) {
    return value as AssignmentsUiLayer;
  }
  return DEFAULT_LAYER;
}

export function getAssignmentsUiLayer(): AssignmentsUiLayer {
  return parseLayer(process.env.NEXT_PUBLIC_ASSIGNMENTS_UI_LAYER);
}

export function assignmentsLayerAtLeast(
  current: AssignmentsUiLayer,
  required: AssignmentsUiLayer
): boolean {
  return LAYER_RANK[current] >= LAYER_RANK[required];
}

export function assignmentsLayerLabel(layer: AssignmentsUiLayer): string {
  return layer.replace(/_/g, " ");
}
