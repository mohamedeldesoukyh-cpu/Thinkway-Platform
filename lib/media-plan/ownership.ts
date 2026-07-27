/**
 * Output ownership boundary.
 *
 * Media Plan owns scheduling. Campaign Outputs consume the Media Plan and must
 * never modify or regenerate schedule authority.
 */

export type MediaPlanMutationSource =
  | "media_plan_engine"
  | "studio_media_plan_ui"
  | "campaign_media_plan_ui"
  | "client_portal_approval"
  | "campaign_output_generator"
  | "campaign_output_regenerate"
  | "unknown";

const FORBIDDEN_SCHEDULE_MUTATORS: ReadonlySet<MediaPlanMutationSource> = new Set([
  "campaign_output_generator",
  "campaign_output_regenerate",
]);

export function canSourceMutateMediaPlanSchedule(
  source: MediaPlanMutationSource
): boolean {
  return !FORBIDDEN_SCHEDULE_MUTATORS.has(source);
}

export function assertSourceCanMutateMediaPlanSchedule(
  source: MediaPlanMutationSource
): { ok: true } | { ok: false; error: string } {
  if (!canSourceMutateMediaPlanSchedule(source)) {
    return {
      ok: false,
      error:
        "Campaign Outputs consume the Media Plan and must never modify or regenerate the schedule.",
    };
  }
  return { ok: true };
}
