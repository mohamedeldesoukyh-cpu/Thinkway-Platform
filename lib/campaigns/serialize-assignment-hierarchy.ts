import type { AssignmentHierarchy } from "@/features/campaigns/types/assignment-hierarchy";

/** Ensure hierarchy is RSC-safe plain JSON before crossing into client components. */
export function toPlainAssignmentHierarchy(
  hierarchy: AssignmentHierarchy
): AssignmentHierarchy {
  try {
    return JSON.parse(JSON.stringify(hierarchy)) as AssignmentHierarchy;
  } catch (error) {
    console.error("[Assignments] hierarchy serialization failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return {
      groups: [],
      currency_code: hierarchy.currency_code ?? "USD",
      load_error:
        hierarchy.load_error ??
        "Assignment hierarchy could not be serialized for the client.",
      skipped_line_ids: [],
      sanitize_warnings: [],
    };
  }
}
