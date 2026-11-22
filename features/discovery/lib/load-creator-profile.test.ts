import assert from "node:assert/strict";
import test from "node:test";
import { loadCreatorProfile } from "./load-creator-profile";

test("profile reads deduplicate in flight, isolate creators, and reload after completion", async () => {
  const original = globalThis.fetch;
  const calls: string[] = [];
  const releases: Array<() => void> = [];
  globalThis.fetch = (async (url) => {
    calls.push(String(url));
    await new Promise<void>(resolve => releases.push(resolve));
    return new Response(JSON.stringify({ unified_id: String(url) }), { status: 200 });
  }) as typeof fetch;
  try {
    const first = loadCreatorProfile("one");
    assert.equal(first, loadCreatorProfile("inf:one"));
    const other = loadCreatorProfile("inf:two");
    assert.equal(calls.length, 2);
    assert.match(calls[0], /inf%3Aone\/profile$/);
    releases.splice(0).forEach(release => release());
    const [a, b] = await Promise.all([first, other]);
    assert.notEqual(a?.unified_id, b?.unified_id);
    const again = loadCreatorProfile("one");
    assert.equal(calls.length, 3);
    releases.splice(0).forEach(release => release());
    await again;
  } finally { globalThis.fetch = original; }
});

test("failed profile requests can retry and missing profiles return null", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = (async () => new Response("failed", { status: 500 })) as typeof fetch;
    await assert.rejects(loadCreatorProfile("retry"), /Could not load/);
    globalThis.fetch = (async () => new Response("missing", { status: 404 })) as typeof fetch;
    assert.equal(await loadCreatorProfile("retry"), null);
    assert.equal(await loadCreatorProfile("  "), null);
  } finally { globalThis.fetch = original; }
});
