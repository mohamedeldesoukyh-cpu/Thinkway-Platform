/**
 * When Intake stops waiting for the persisted Campaign Intelligence.
 *
 * Intake discovers the analysis by polling the persisted CIP row — it never
 * extracts anything itself. The workflow persists that row at bootstrap,
 * BEFORE its first task, so Intake can render the intelligence while the rest
 * of the run continues; it does not depend on the eight workflow tasks.
 *
 * The poll used to give up after a fixed 20 attempts (50 s) regardless of
 * whether the analysis was still being produced. That deadline is shorter than
 * the worst case for the single thing it waits on: the bootstrap extraction
 * allows the model call alone 45 s (`AI_TIMEOUT_MS`), plus brand detection and
 * two profile writes. A slow-but-successful analysis therefore landed after
 * Intake had stopped looking, and because the poll is keyed on the
 * conversation it never resumed — the operator had to leave Studio and come
 * back to see a result that was already stored.
 *
 * So the deadline now applies to being IDLE. While the workflow is running
 * there is a known producer and Intake keeps waiting; once it is not, the
 * original 20-attempt budget applies. The absolute cap exists only so the
 * interval cannot leak, never as a product timeout.
 */

export const INTAKE_CIP_POLL_INTERVAL_MS = 2_500;

/** Attempts allowed once no workflow is producing intelligence — the original budget. */
export const INTAKE_CIP_POLL_IDLE_MAX_ATTEMPTS = 20;

/** Leak guard for the interval itself (~10 minutes at the interval above). */
export const INTAKE_CIP_POLL_ABSOLUTE_MAX_ATTEMPTS = 240;

export function shouldContinueIntakeIntelligencePoll(input: {
  /** The persisted profile has been read — nothing left to wait for. */
  found: boolean;
  /** Total attempts made. */
  attempts: number;
  /** Attempts made while no workflow was running. */
  idleAttempts: number;
  /** A create-campaign run is still in flight, so intelligence is still coming. */
  workflowRunning: boolean;
}): boolean {
  if (input.found) return false;
  if (input.attempts >= INTAKE_CIP_POLL_ABSOLUTE_MAX_ATTEMPTS) return false;
  if (input.workflowRunning) return true;
  return input.idleAttempts < INTAKE_CIP_POLL_IDLE_MAX_ATTEMPTS;
}
