import assert from "node:assert/strict";
import test from "node:test";
import { createPlatformDialogSession, queuePlatformAddition, splitPlatformLinks } from "./platform-add-queue";

test("accepts multiple links and removes duplicates", () => {
  assert.deepEqual(splitPlatformLinks("https://instagram.com/a, https://tiktok.com/@a\nhttps://instagram.com/a"), ["https://instagram.com/a", "https://tiktok.com/@a"]);
});

test("serializes one creator but allows another creator to proceed", async () => {
  const events: string[] = [];
  let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const first = queuePlatformAddition("a", async () => { events.push("a1"); await barrier; });
  const second = queuePlatformAddition("a", async () => { events.push("a2"); });
  await queuePlatformAddition("b", async () => { events.push("b"); });
  assert.deepEqual(events, ["a1", "b"]);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(events, ["a1", "b", "a2"]);
});

test("a failed addition does not discard the remaining queue", async () => {
  const first = queuePlatformAddition("failure", async () => { throw new Error("conflict"); });
  const second = queuePlatformAddition("failure", async () => "linked");
  await assert.rejects(first, /conflict/);
  assert.equal(await second, "linked");
});

test("UUID and unified internal identity share the same creator queue", async () => {
  let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const events: string[] = [];
  const first = queuePlatformAddition("identity-a", async () => { events.push("first"); await barrier; });
  const second = queuePlatformAddition("inf:identity-a", async () => { events.push("second"); });
  await queuePlatformAddition("identity-b", async () => { events.push("other creator"); });
  assert.deepEqual(events, ["first", "other creator"]);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(events, ["first", "other creator", "second"]);
});

test("background completion cannot close or show errors in a reopened dialog", () => {
  const dialog = createPlatformDialogSession();
  dialog.open();
  const oldRequestCanUpdate = dialog.capture();
  assert.equal(oldRequestCanUpdate(), true);
  dialog.close();
  assert.equal(oldRequestCanUpdate(), false);
  dialog.open();
  const newRequestCanUpdate = dialog.capture();
  assert.equal(oldRequestCanUpdate(), false);
  assert.equal(newRequestCanUpdate(), true);
  dialog.close();
  assert.equal(newRequestCanUpdate(), false);
});

test("closing after linking leaves enrichment and the next queued platform running", async () => {
  const dialog = createPlatformDialogSession();
  dialog.open();
  const canUpdate = dialog.capture();
  const events: string[] = [];
  let completeEnrichment!: () => void;
  const enrichment = new Promise<void>(resolve => { completeEnrichment = resolve; });
  const first = queuePlatformAddition("background-a", async () => {
    events.push("linked");
    if (canUpdate()) dialog.close();
    await enrichment;
    events.push("enriched");
  });
  const next = queuePlatformAddition("background-a", async () => { events.push("next platform"); });
  await queuePlatformAddition("background-b", async () => { events.push("other creator linked"); });
  assert.equal(canUpdate(), false);
  assert.deepEqual(events, ["linked", "other creator linked"]);
  completeEnrichment();
  await Promise.all([first, next]);
  assert.deepEqual(events, ["linked", "other creator linked", "enriched", "next platform"]);
});
