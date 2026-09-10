/**
 * ONE readiness status, for every surface that shows one.
 *
 * Three different authorities were answering the same question, and the screen
 * showed all three answers at once:
 *
 *   - the campaign mast: `resolvePresentationCompletion().completionPercent`
 *     put through `resolveStudioReadinessLabel`, which called anything at or
 *     above 75% "Ready" — a COMPLETION percentage relabelled as readiness;
 *   - the workspace nav: the Package step's own `complete` flag, which is just
 *     `sections.presentation.status === "complete"` with no outdated steps;
 *   - the Package screen: `resolveStudioPackageReadiness().overall`, the
 *     service that actually evaluates every dimension.
 *
 * So the header said "Ready · 89%", the nav said "Package — Ready", and the
 * Package screen said "Not ready · 4 items need attention".
 *
 * `resolveStudioPackageReadiness` is the authority — it is the only one that
 * looks at Intake, Strategy, Discovery, Creators, Content, Commercial and
 * Timeline. Completion stays what it is: a percentage of progress, which this
 * reports ALONGSIDE the status instead of as a substitute for it.
 */

import {
  STUDIO_PACKAGE_OVERALL_LABEL,
  type StudioPackageOverallState,
} from "./studio-package-readiness";

export type StudioReadinessStatus = {
  /** The authoritative package state. */
  state: StudioPackageOverallState;
  /** True only when the package itself is ready. */
  ready: boolean;
  /** Short label: "Ready" / "Not ready" / "In progress". */
  label: string;
  /** Progress, which is not readiness. */
  completionPercent: number;
  /** The one line every surface shows: "Not ready · 89% complete". */
  summary: string;
};

const SHORT_LABEL: Record<StudioPackageOverallState, string> = {
  blocked: "Not ready",
  in_progress: "In progress",
  outdated: "Not ready",
  ready_for_internal_review: "Ready",
  ready_for_client: "Ready",
};

export function resolveStudioReadinessStatus(input: {
  /** `resolveStudioPackageReadiness(...).overall`. */
  packageState: StudioPackageOverallState;
  /** `resolvePresentationCompletion(...).completionPercent`. */
  completionPercent: number;
}): StudioReadinessStatus {
  const percent = Math.max(0, Math.min(100, Math.round(input.completionPercent)));
  const ready =
    input.packageState === "ready_for_client" ||
    input.packageState === "ready_for_internal_review";
  const label = SHORT_LABEL[input.packageState];

  return {
    state: input.packageState,
    ready,
    label,
    completionPercent: percent,
    // A ready package reads "Ready · 100%"; anything else must say what it is
    // and how far along it is, never "Ready" on the strength of the percentage.
    summary: ready ? `${label} · ${percent}%` : `${label} · ${percent}% complete`,
  };
}

/** The full package label, for the Package screen's own headline. */
export function studioPackageStateLabel(state: StudioPackageOverallState): string {
  return STUDIO_PACKAGE_OVERALL_LABEL[state];
}
