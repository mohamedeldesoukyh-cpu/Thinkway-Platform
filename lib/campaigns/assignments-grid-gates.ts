export type AssignmentsGridGates = {
  enableRowStyling: boolean;
  enablePills: boolean;
  usePreparedData: boolean;
  enableExpansion: boolean;
  enableDeliverableChildren: boolean;
  enableCheckboxes: boolean;
  enableFooter: boolean;
};

const FULL_GATES: AssignmentsGridGates = {
  enableRowStyling: true,
  enablePills: true,
  usePreparedData: true,
  enableExpansion: true,
  enableDeliverableChildren: true,
  enableCheckboxes: true,
  enableFooter: true,
};

/** Full operational assignments grid. */
export function resolveAssignmentsGridGates(): AssignmentsGridGates {
  return FULL_GATES;
}
