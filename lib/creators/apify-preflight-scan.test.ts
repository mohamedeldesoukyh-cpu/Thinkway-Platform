import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, readdir, readFile, writeFile, rm } from "node:fs/promises";
import { resolve, join, relative, isAbsolute } from "node:path";
import { ApifyPreflightCache } from "./apify-preflight-cache";
import { readDataset, scanDatasets } from "./apify-preflight-scan";
import { getPreflightJson, type ReadProgress } from "./preflight-get";
import { createReadOnlyStorage, TARGETS } from "./apify-publication-preflight";
import { runPreflight } from "@/scripts/backfill-apify-rich-publication-evidence";

const modifiedAt = "2026-01-01T00:00:00.000Z";
async function withCache(fn: (cache: ApifyPreflightCache, directory: string) => Promise<void>) {
  const base = resolve(".tmp");
  await mkdir(base, { recursive: true });
  const directory = await mkdtemp(join(base, "preflight-test-"));
  try { await fn(await ApifyPreflightCache.open(directory, ["sb_secret_TEST_MUST_NOT_PERSIST", "apify_TEST_MUST_NOT_PERSIST"]), directory); }
  finally {
    const rel = relative(base, resolve(directory));
    assert.ok(rel.startsWith("preflight-test-") && !rel.startsWith("..") && !isAbsolute(rel));
    await rm(directory, { recursive: true, force: true });
  }
}
function fixture(data: unknown[], cap = 10_000) {
  const calls: string[] = [];
  const state = { modifiedAt, failOffset: -1, finalFailure: false };
  const reader = {
    async apify<T>(path: string): Promise<T> {
      calls.push(path);
      if (state.finalFailure && calls.filter(c => c === path).length > 1) throw new Error("metadata unavailable");
      return { data: { id: path.split("/")[1], itemCount: data.length, modifiedAt: state.modifiedAt, urlSigningSecretKey: "NEVER_CACHE_METADATA_SECRET" } } as T;
    },
    async datasetPage(id: string, offset: number, limit: number) {
      calls.push(`${id}:${offset}:${limit}`);
      if (offset === state.failOffset) throw new Error("late 502");
      return { items: data.slice(offset, offset + Math.min(cap, limit)), total: data.length };
    },
  };
  return { reader, calls, state };
}

test("single-page and empty datasets cost two cold reads and one validated cached read", async () => {
  for (const data of [[], [{ ownerId: "123", paidPartnership: false }]]) await withCache(async (cache, directory) => {
    const f = fixture(data);
    assert.deepEqual(await readDataset(f.reader, "dataset", { cache }), data);
    assert.equal(f.calls.length, 2);
    f.calls.length = 0;
    const reopened = await ApifyPreflightCache.open(directory);
    assert.deepEqual(await readDataset(f.reader, "dataset", { cache: reopened }), data);
    assert.deepEqual(f.calls, ["datasets/dataset"]);
    for (const file of await readdir(directory)) assert.doesNotMatch(await readFile(join(directory, file), "utf8"), /NEVER_CACHE_METADATA_SECRET|sb_secret_TEST_MUST_NOT_PERSIST|apify_TEST_MUST_NOT_PERSIST/);
  });
});

test("late page failure resumes from durable pages; complete coverage includes null and empty rows", async () => withCache(async (cache, directory) => {
  const data = [null, {}, { id: 1 }, { id: 2 }, false];
  const f = fixture(data, 2);
  f.state.failOffset = 4;
  await assert.rejects(readDataset(f.reader, "dataset", { cache }), /late 502/);
  assert.equal((await cache.load("dataset"))?.rows.length, 4);
  f.state.failOffset = -1; f.calls.length = 0;
  assert.deepEqual(await readDataset(f.reader, "dataset", { cache: await ApifyPreflightCache.open(directory) }), data);
  assert.deepEqual(f.calls, ["datasets/dataset", "dataset:4:10000", "datasets/dataset"]);
}));

test("failed final validation never authorizes an unchecked cached dataset", async () => withCache(async cache => {
  const f = fixture([1, 2, 3], 2);
  f.state.finalFailure = true;
  await assert.rejects(readDataset(f.reader, "dataset", { cache }), /metadata unavailable/);
  await assert.rejects(readDataset(f.reader, "dataset", { cache }), /metadata unavailable/);
  f.state.finalFailure = false;
  assert.deepEqual(await readDataset(f.reader, "dataset", { cache }), [1, 2, 3]);
}));

test("changed dataset revision invalidates cache even when the item count is unchanged", async () => withCache(async cache => {
  const data = [{ caption: "old" }];
  const f = fixture(data);
  await readDataset(f.reader, "dataset", { cache });
  data[0] = { caption: "new" }; f.state.modifiedAt = "2026-02-01T00:00:00Z";
  assert.deepEqual(await readDataset(f.reader, "dataset", { cache }), data);
  assert.equal(f.calls.filter(c => c.includes(":0:")).length, 2);
}));

test("corrupt and missing cached pages are redownloaded, never treated as complete", async () => withCache(async (cache, directory) => {
  const f = fixture([{ id: 1 }]);
  await readDataset(f.reader, "dataset", { cache });
  const page = (await readdir(directory)).find(name => name.endsWith(".page.json"))!;
  await writeFile(join(directory, page), '[{"id":999}]');
  assert.deepEqual(await readDataset(f.reader, "dataset", { cache }), [{ id: 1 }]);
  assert.equal(f.calls.length, 4);
  await rm(join(directory, page));
  assert.deepEqual(await readDataset(f.reader, "dataset", { cache }), [{ id: 1 }]);
  await writeFile(join(directory, "dataset.json"), '{broken');
  assert.deepEqual(await readDataset(f.reader, "dataset", { cache }), [{ id: 1 }]);
}));

test("credential-like dataset content is refused without a saved page or checkpoint", async () => withCache(async (cache, directory) => {
  await assert.rejects(readDataset(fixture([{ text: "sb_secret_TEST_MUST_NOT_PERSIST" }]).reader, "dataset", { cache }), /Credential-like/);
  assert.deepEqual(await readdir(directory), []);
  await assert.rejects(ApifyPreflightCache.open("../outside"), /inside/);
  await assert.rejects(cache.load("../escape"), /identity/);
}));

test("short capped pages continue to exact totals; empty or changing pages fail closed", async () => {
  const data = Array.from({ length: 25_001 }, (_, id) => ({ id }));
  const f = fixture(data);
  assert.deepEqual(await readDataset(f.reader, "dataset"), data);
  assert.equal(f.calls.length, 5); // 3 large pages + 2 metadata reads, versus 28 previously.
  const capped = fixture(data, 750);
  assert.deepEqual(await readDataset(capped.reader, "dataset"), data);
  const empty = fixture([1]);
  empty.reader.datasetPage = async () => ({ items: [], total: 1 });
  await assert.rejects(readDataset(empty.reader, "dataset"), /Incomplete/);
  const changing = fixture([1, 2], 1);
  changing.reader.datasetPage = async (_id, offset) => ({ items: [offset], total: offset ? 3 : 2 });
  await assert.rejects(readDataset(changing.reader, "dataset"), /changing/);
});

test("workers bound concurrency, deduplicate downloads, drain on error and never consume failed datasets", async () => {
  let active = 0, peak = 0;
  const seen: string[] = [], consumed: string[] = [];
  const f = fixture([1]);
  f.reader.datasetPage = async (id) => {
    seen.push(id); active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 5)); active--;
    if (id === "bad") throw new Error("failed");
    return { items: [1], total: 1 };
  };
  await scanDatasets(f.reader, ["a", "a", "b", "c"], id => consumed.push(id), { concurrency: 2 });
  assert.equal(peak, 2); assert.equal(seen.filter(id => id === "a").length, 1);
  await assert.rejects(scanDatasets(f.reader, ["bad", "slow", "never"], id => consumed.push(id), { concurrency: 2 }), /incomplete/);
  assert.equal(active, 0); assert.ok(!seen.includes("never")); assert.ok(!consumed.includes("bad"));
  await assert.rejects(scanDatasets(f.reader, [], () => {}, { concurrency: 99 }), /concurrency/);
});

test("429 and 5xx retry with exponential backoff and Retry-After, always GET with redirects refused", async () => {
  const delays: number[] = [], events: ReadProgress[] = [], calls: RequestInit[] = [];
  const statuses = [429, 502, 503, 200];
  const fake = (async (_url, init) => {
    calls.push(init!); const status = statuses.shift()!;
    return new Response('{}', { status, headers: status === 429 ? { 'retry-after': '3' } : {} });
  }) as typeof fetch;
  await getPreflightJson(fake, "https://api.apify.com/v2/datasets/fixture", { Authorization: "Bearer private" }, { sleep: async ms => { delays.push(ms); }, progress: e => events.push(e) });
  assert.deepEqual(delays, [3000, 2000, 4000]);
  assert.ok(calls.every(c => c.method === "GET" && c.redirect === "error" && c.signal));
  assert.doesNotMatch(JSON.stringify(events), /private|Authorization/);
});

test("retry exhaustion, auth errors, long Retry-After and malformed JSON are bounded and sanitized", async () => {
  for (const status of [401, 403, 404, 302, 502]) {
    let calls = 0;
    await assert.rejects(getPreflightJson((async () => { calls++; return new Response("secret body", { status }); }) as typeof fetch,
      "https://api.apify.com/v2/datasets/fixture", {}, { maxRetries: 2, sleep: async () => {} }), error => {
      assert.doesNotMatch(String(error), /secret body/); return true;
    });
    assert.equal(calls, status === 502 ? 3 : 1);
  }
  let calls = 0;
  await assert.rejects(getPreflightJson((async () => { calls++; throw new Error("SECRET transport url"); }) as typeof fetch,
    "https://api.apify.com/v2/datasets/fixture", {}, { maxRetries: 1, sleep: async () => {} }), /exhausted/);
  assert.equal(calls, 2);
  let malformed = 0;
  await getPreflightJson((async () => new Response(++malformed === 1 ? '{truncated' : '{}')) as typeof fetch,
    "https://api.apify.com/v2/datasets/fixture", {}, { maxRetries: 1, sleep: async () => {} });
  assert.equal(malformed, 2);
  let aborted = 0;
  const timeoutFetch = (async (_url, init) => {
    if (++aborted > 1) return new Response('{}');
    return new Promise<Response>((_resolve, reject) => {
      // Keep the test event loop alive until the unreferenced timeout signal fires.
      const timer = setTimeout(() => reject(new Error('test timeout guard')), 500);
      init!.signal!.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('aborted')); }, { once: true });
    });
  }) as typeof fetch;
  await getPreflightJson(timeoutFetch, "https://api.apify.com/v2/datasets/fixture", {}, { timeoutMs: 5, maxRetries: 1, sleep: async () => {} });
  assert.equal(aborted, 2);
  await assert.rejects(getPreflightJson((async () => new Response('{}', { status: 429, headers: { 'retry-after': '600' } })) as typeof fetch,
    "https://api.apify.com/v2/datasets/fixture", {}, { sleep: async () => { assert.fail("must not retry too early"); } }), /exhausted/);
});

test("dataset transport requires exact headers and blocks action endpoints and query injection", async () => {
  let calls = 0;
  const fake = (async () => { calls++; return new Response('[]'); }) as typeof fetch;
  const reader = createReadOnlyStorage("production", `https://${TARGETS.production}.supabase.co`, "sb_secret_fake", "apify_fake", fake);
  await assert.rejects(reader.datasetPage("dataset", 0, 10_000), /Unverifiable/);
  for (const path of ["actors/fixture/run-sync-get-dataset-items", "acts/fixture/runs", "actors/fixture/runs?token=secret", "datasets/x/../items", "datasets/x/items?fields=id", "datasets/x/items?clean=true&token=secret"]) await assert.rejects(reader.apify(path), /not allowed/);
  assert.equal(calls, 1);
});

test("full preflight cold/warm/concurrent reports agree and shared datasets keep every run's evidence", async () => withCache(async (_cache, directory) => {
  const env = { NEXT_PUBLIC_SUPABASE_URL: `https://${TARGETS.production}.supabase.co`, SUPABASE_SERVICE_ROLE_KEY: "sb_secret_TEST_MUST_NOT_PERSIST", APIFY_TOKEN: "apify_TEST_MUST_NOT_PERSIST", APIFY_INSTAGRAM_ACTOR_ID: "actor" };
  const post = { ownerId: "123", ownerUsername: "creator", id: "post", url: "https://instagram.com/p/AbC", paidPartnership: false };
  const runs = ["a", "b", "c"].map(id => ({ id, actId: "actor", status: "SUCCEEDED", defaultDatasetId: id === "c" ? "second" : "shared", finishedAt: "2026-01-01T00:00:00Z" }));
  let failSecond = false;
  const fake = (async (input, init) => {
    assert.equal(init?.method, "GET"); assert.equal(init?.redirect, "error");
    const url = new URL(String(input));
    const json = (data: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(data), { headers });
    if (url.pathname.endsWith("influencer_platform_accounts")) return json([{ id: "a", influencer_id: "creator", platform: "instagram", username: "creator", recent_publications: [] }], { "content-range": "0-0/1" });
    if (url.pathname.endsWith("creator_dna") || url.pathname.endsWith("ipl_snapshots")) return json([], { "content-range": "*/0" });
    if (url.pathname.endsWith("acts/actor")) return json({ data: { id: "actor" } });
    if (url.pathname.endsWith("actors/actor/runs")) {
      assert.equal(url.searchParams.get("status"), "SUCCEEDED"); assert.equal(url.searchParams.get("desc"), "0");
      const offset = Number(url.searchParams.get("offset"));
      return json({ data: { total: 3, items: runs.slice(offset, offset + 2) } });
    }
    if (url.pathname.endsWith("datasets/shared/items")) return json([post], { "x-apify-pagination-offset": "0", "x-apify-pagination-total": "1" });
    if (url.pathname.endsWith("datasets/shared")) return json({ data: { id: "shared", itemCount: 1, modifiedAt } });
    if (url.pathname.endsWith("datasets/second/items")) {
      if (failSecond) return new Response('{}', { status: 502 });
      return json([{ ...post, caption: "second run evidence" }], { "x-apify-pagination-offset": "0", "x-apify-pagination-total": "1" });
    }
    if (url.pathname.endsWith("datasets/second")) return json({ data: { id: "second", itemCount: 1, modifiedAt } });
    assert.fail("Unexpected offline request");
  }) as typeof fetch;
  const args = ["--preflight", "--target=production", "--before=2026-09-15", "--explain", `--cache-dir=${directory}`];
  failSecond = true;
  await assert.rejects(runPreflight(args, env, fake, { maxRetries: 0 }), /preflight incomplete/);
  assert.ok((await readdir(directory)).includes("shared.json"));
  failSecond = false;
  const cold = await runPreflight(args, env, fake);
  const warm = await runPreflight([...args, "--concurrency=1"], env, fake);
  const { readStats: c, ...coldPlan } = cold, { readStats: w, ...warmPlan } = warm;
  assert.deepEqual(warmPlan, coldPlan);
  assert.equal(c.apifyRequests, 6); assert.equal(w.apifyRequests, 5);
  assert.equal(c.uniqueDatasets, 2); assert.equal(cold.scannedRows, 3);
  assert.equal(cold.actualWrites, 0);
}));
