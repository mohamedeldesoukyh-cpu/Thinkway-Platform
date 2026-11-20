import assert from "node:assert/strict";
import test from "node:test";
import { queuePlatformAddition, splitPlatformLinks } from "./platform-add-queue";

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
