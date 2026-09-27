import assert from "node:assert/strict";
import { test } from "node:test";
import { watchShortlistEnrichment } from "./enrichment-live-poll";

const delay = (ms = 15) => new Promise((resolve) => setTimeout(resolve, ms));

test("patches each creator as it completes instead of waiting for the whole batch", async () => {
  const frames = [
    [{ id: "a", status: "running", followers: 0 }, { id: "b", status: "queued", followers: 0 }],
    [{ id: "a", status: "enriched", followers: 1234 }, { id: "b", status: "running", followers: 0 }],
    [{ id: "a", status: "enriched", followers: 1234 }, { id: "b", status: "partial", followers: 5678 }],
  ];
  const received: typeof frames = [];
  let calls = 0;
  let complete!: () => void;
  const done = new Promise<void>((resolve) => { complete = resolve; });
  const stop = watchShortlistEnrichment({
    fetch: async () => frames[calls++],
    onData: (data) => {
      received.push(data);
      if (received.length === 3) { stop(); complete(); }
    },
    onError: () => {}, intervalMs: 1,
  });
  await done;
  await delay();
  assert.deepEqual(received, frames);
  assert.equal(received[1][0].followers, 1234);
  assert.equal(received[1][1].status, "running");
  assert.equal(calls, 3, "completed creators do not keep polling");
});

test("retries a transient read failure without marking jobs complete", async () => {
  const errors: boolean[] = [];
  let calls = 0;
  let complete!: () => void;
  const done = new Promise<void>((resolve) => { complete = resolve; });
  const stop = watchShortlistEnrichment({
    fetch: async () => { if (++calls === 1) throw new Error("temporary"); return "fresh metrics"; },
    onData: (data) => { assert.equal(data, "fresh metrics"); stop(); complete(); },
    onError: (failed) => { errors.push(failed); }, intervalMs: 1,
  });
  await done;
  assert.deepEqual(errors, [true, false]);
});

test("navigation cancels timers and ignores a late response", async () => {
  let resolve!: (value: string) => void;
  let updates = 0;
  let calls = 0;
  const stop = watchShortlistEnrichment({
    fetch: () => { calls++; return new Promise<string>((done) => { resolve = done; }); },
    onData: () => { updates++; }, onError: () => { updates++; }, intervalMs: 1,
  });
  stop();
  resolve("stale shortlist");
  await delay();
  assert.equal(updates, 0);
  assert.equal(calls, 1);
});

test("slow reads never overlap", async () => {
  let calls = 0;
  let resolve!: (value: string) => void;
  const stop = watchShortlistEnrichment({
    fetch: () => { calls++; return new Promise<string>((done) => { resolve = done; }); },
    onData: () => {}, onError: () => {}, intervalMs: 1,
  });
  await delay();
  assert.equal(calls, 1);
  stop();
  resolve("done");
});
