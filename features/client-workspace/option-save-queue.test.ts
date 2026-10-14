import assert from "node:assert/strict";
import test from "node:test";
import { createOptionSaveQueue } from "./option-save-queue";
function deferred() { let resolve!: () => void; const promise = new Promise<void>(r => { resolve = r; }); return { promise, resolve }; }
test("option writes serialize across creators and coalesce queued choices", async () => {
  const queue = createOptionSaveQueue(), gate = deferred(), started = deferred();
  const calls: string[] = [];
  const first = queue.enqueue("a", async isLatest => { calls.push("a1"); started.resolve(); await gate.promise; assert.equal(isLatest(), false); });
  await started.promise;
  const stale = queue.enqueue("a", async () => { calls.push("a2"); });
  const other = queue.enqueue("b", async () => { calls.push("b1"); });
  const newest = queue.enqueue("a", async isLatest => { assert.equal(isLatest(), true); calls.push("a3"); });
  assert.deepEqual(calls, ["a1"]);
  gate.resolve(); await Promise.all([first, stale, other, newest]);
  assert.deepEqual(calls, ["a1", "b1", "a3"]);
});
test("a failed save does not block a later choice", async () => {
  const queue = createOptionSaveQueue(); let saved = false;
  const failed = queue.enqueue("a", async () => { throw new Error("offline"); });
  const next = queue.enqueue("b", async () => { saved = true; });
  await assert.rejects(failed, /offline/); await next; assert.equal(saved, true);
});
