/**
 * Assignments tab progressive restore stages (set NEXT_PUBLIC_ASSIGNMENTS_DEBUG_STAGE).
 * Omit env for normal full UI (with safe lazy mounts).
 */
export const ASSIGNMENTS_DEBUG_STAGES = [
  "static",
  "container",
  "table",
  "full",
] as const;

export type AssignmentsDebugStage = (typeof ASSIGNMENTS_DEBUG_STAGES)[number];

export function getAssignmentsDebugStage(): AssignmentsDebugStage | null {
  const raw = process.env.NEXT_PUBLIC_ASSIGNMENTS_DEBUG_STAGE?.trim().toLowerCase();
  if (!raw) return null;
  if (ASSIGNMENTS_DEBUG_STAGES.includes(raw as AssignmentsDebugStage)) {
    return raw as AssignmentsDebugStage;
  }
  return null;
}
