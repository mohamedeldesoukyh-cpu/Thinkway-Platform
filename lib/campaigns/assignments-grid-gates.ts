import {
  assignmentsStageAtLeast,
  type AssignmentsRenderStage,
} from "@/lib/campaigns/assignments-render-stage";

export type AssignmentsGridGates = {
  enableRowStyling: boolean;
  enablePills: boolean;
  usePreparedData: boolean;
  enableExpansion: boolean;
  enableDeliverableChildren: boolean;
  enableCheckboxes: boolean;
  enableFooter: boolean;
};

/** Map render-isolation stage → safe grid feature flags (bisect one layer at a time). */
export function resolveAssignmentsGridGates(
  renderStage: AssignmentsRenderStage
): AssignmentsGridGates {
  if (renderStage === "full") {
    return {
      enableRowStyling: true,
      enablePills: true,
      usePreparedData: true,
      enableExpansion: true,
      enableDeliverableChildren: true,
      enableCheckboxes: true,
      enableFooter: true,
    };
  }

  return {
    enableRowStyling: assignmentsStageAtLeast(renderStage, "row-styling"),
    enablePills: assignmentsStageAtLeast(renderStage, "pills"),
    usePreparedData: assignmentsStageAtLeast(renderStage, "expansion"),
    enableExpansion: assignmentsStageAtLeast(renderStage, "expansion"),
    /** Nested deliverable/post rows — included at `expansion` (recovery checkpoint). */
    enableDeliverableChildren: assignmentsStageAtLeast(renderStage, "expansion"),
    enableCheckboxes: assignmentsStageAtLeast(renderStage, "checkboxes"),
    enableFooter:
      assignmentsStageAtLeast(renderStage, "footer") || renderStage === "dialogs",
  };
}
