import assert from "node:assert/strict";
import test from "node:test";
import { searchNormalDiscoveryClient } from "./search-normal-discovery-client";
import { DEFAULT_CREATOR_SEARCH_FILTERS } from "./components/creator-search/creator-search-types";

const input = { filters: DEFAULT_CREATOR_SEARCH_FILTERS, sort: { field: "name" as const, direction: "asc" as const }, page: 1, pageSize: 24 };
test("normal search passes cancellation and brief context to the independent endpoint", async t => {
  const controller = new AbortController();
  const brief = { profileId: "brief", disabledSoftIds: ["country"] };
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(url, "/api/discovery/search");
    assert.equal(init.signal, controller.signal);
    assert.equal(init.cache, "no-store");
    assert.deepEqual(JSON.parse(init.body as string), { input, brief });
    return Response.json({ creators: [], total: 0 });
  });
  assert.equal((await searchNormalDiscoveryClient(input, brief, controller.signal)).total, 0);
});
test("search errors surface instead of replacing results with an invalid response", async t => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ error: "Please sign in again." }, { status: 401 }));
  await assert.rejects(searchNormalDiscoveryClient(input, undefined, new AbortController().signal), /sign in again/);
});
