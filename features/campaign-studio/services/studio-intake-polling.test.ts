/**
 * Intake waits for the intelligence it is told is coming.
 *
 * The Copilot typed-brief journey persists the CIP at workflow BOOTSTRAP,
 * before the first of the eight tasks, and Intake renders during streaming —
 * so the downstream tasks never blocked Intake from displaying it. What did
 * block it was Intake's own poll giving up after a fixed 20 attempts (50 s)
 * while blind to whether the analysis was still being produced. The bootstrap
 * extraction allows the model call alone 45 s, plus brand detection and two
 * profile writes, so a slow-but-successful analysis landed after Intake had
 * stopped looking — and the poll is keyed on the conversation, so it never
 * resumed until the operator left Studio and came back.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  INTAKE_CIP_POLL_ABSOLUTE_MAX_ATTEMPTS,
  INTAKE_CIP_POLL_IDLE_MAX_ATTEMPTS,
  INTAKE_CIP_POLL_INTERVAL_MS,
  shouldContinueIntakeIntelligencePoll,
} from "./studio-intake-polling";

const poll = shouldContinueIntakeIntelligencePoll;

test("the old fixed deadline was shorter than what it waited for", () => {
  // The single bootstrap extraction: 45 s allowed for the model call
  // (AI_TIMEOUT_MS in extract-profile-llm) before brand detection and two
  // profile writes. The old budget expired at 50 s, blind to all of it.
  const oldDeadlineMs = INTAKE_CIP_POLL_IDLE_MAX_ATTEMPTS * INTAKE_CIP_POLL_INTERVAL_MS;
  assert.equal(oldDeadlineMs, 50_000);
  assert.ok(
    oldDeadlineMs < 45_000 + 10_000,
    "the deadline left under 5 s of slack for brand detection and two writes"
  );
});

test("a running workflow is never given up on", () => {
  for (const attempts of [1, INTAKE_CIP_POLL_IDLE_MAX_ATTEMPTS, 100]) {
    assert.equal(
      poll({ found: false, attempts, idleAttempts: 0, workflowRunning: true }),
      true,
      `attempt ${attempts} must keep waiting while the run is still producing intelligence`
    );
  }
});

test("the idle budget is unchanged when nothing is producing intelligence", () => {
  assert.equal(
    poll({ found: false, attempts: 5, idleAttempts: 5, workflowRunning: false }),
    true
  );
  assert.equal(
    poll({
      found: false,
      attempts: INTAKE_CIP_POLL_IDLE_MAX_ATTEMPTS,
      idleAttempts: INTAKE_CIP_POLL_IDLE_MAX_ATTEMPTS,
      workflowRunning: false,
    }),
    false,
    "the original 20-attempt budget still applies to an idle conversation"
  );
});

test("idle attempts accumulated before a run do not shorten the wait during it", () => {
  // Operator opens Intake on an idle campaign, then starts a brief in Copilot.
  assert.equal(
    poll({
      found: false,
      attempts: INTAKE_CIP_POLL_IDLE_MAX_ATTEMPTS + 5,
      idleAttempts: INTAKE_CIP_POLL_IDLE_MAX_ATTEMPTS,
      workflowRunning: true,
    }),
    true
  );
  // And once that run ends without producing a profile, it stops.
  assert.equal(
    poll({
      found: false,
      attempts: INTAKE_CIP_POLL_IDLE_MAX_ATTEMPTS + 5,
      idleAttempts: INTAKE_CIP_POLL_IDLE_MAX_ATTEMPTS,
      workflowRunning: false,
    }),
    false
  );
});

test("finding the profile stops the poll immediately, running or not", () => {
  for (const workflowRunning of [true, false]) {
    assert.equal(
      poll({ found: true, attempts: 1, idleAttempts: 0, workflowRunning }),
      false,
      "the persisted profile is the thing being waited for — nothing follows it"
    );
  }
});

test("the absolute cap bounds the interval even for a run that never ends", () => {
  assert.equal(
    poll({
      found: false,
      attempts: INTAKE_CIP_POLL_ABSOLUTE_MAX_ATTEMPTS,
      idleAttempts: 0,
      workflowRunning: true,
    }),
    false,
    "a stuck or abandoned run must not leave an interval polling forever"
  );
  assert.ok(
    INTAKE_CIP_POLL_ABSOLUTE_MAX_ATTEMPTS * INTAKE_CIP_POLL_INTERVAL_MS >= 600_000,
    "the cap is a leak guard, not a product timeout — it must sit well beyond a real run"
  );
});
