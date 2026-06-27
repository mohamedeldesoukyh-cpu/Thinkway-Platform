import assert from "node:assert/strict";

/**
 * Documents enqueue-first queue semantics: DB `queued` status must only be written
 * after a BullMQ job is successfully enqueued (see requestMetricsCollection).
 */
function shouldMarkQueuedAfterEnqueue(enqueued: boolean, redisAvailable: boolean): boolean {
  return redisAvailable && enqueued;
}

function shouldUseInlineFallback(enqueued: boolean, redisAvailable: boolean): boolean {
  return !redisAvailable || !enqueued;
}

{
  assert.equal(shouldMarkQueuedAfterEnqueue(true, true), true);
  assert.equal(shouldMarkQueuedAfterEnqueue(false, true), false);
  assert.equal(shouldMarkQueuedAfterEnqueue(true, false), false);
}

{
  assert.equal(shouldUseInlineFallback(false, true), true);
  assert.equal(shouldUseInlineFallback(true, true), false);
  assert.equal(shouldUseInlineFallback(false, false), true);
}

console.log("request-metrics-collection tests passed");
