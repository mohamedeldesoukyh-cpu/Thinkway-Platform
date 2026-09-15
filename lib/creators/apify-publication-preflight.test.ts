import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createReadOnlyStorage, matchAccount, planPublicationBackfill, readAllPages, TARGETS, type Account, type Evidence } from "./apify-publication-preflight";
import { canonicalPublicationUrl, mergeCreatorRecentPublications } from "./publication-evidence";
import type { CreatorRecentPublication } from "./types";
import { createEmptyCreatorDNADocument } from "@/features/creator-dna/services/document-factory";
import { wrapValue } from "@/features/creator-dna/services/field-envelope";
import { CreatorDNAService } from "@/features/creator-dna/services/creator-dna-service";
import { runPreflight } from "@/scripts/backfill-apify-rich-publication-evidence";

const post = (extra: Partial<CreatorRecentPublication> = {}): CreatorRecentPublication => ({ url: "https://www.instagram.com/p/AbC/", caption: null, thumbnail: null, likes: null, comments: null, views: null, posted_at: null, ...extra });
const account = (extra: Partial<Account> = {}): Account => ({ id: "account-1", influencer_id: "creator-1", platform: "instagram", username: "creator", stableIds: ["123"], recent_publications: [], ...extra });
const evidence = (extra: Partial<Evidence> = {}): Evidence => ({ ownerId: "123", username: "creator", publication: post({ platformPostId: "post-1", paidPartnership: false }), capturedAt: "2025-01-01T00:00:00Z", ...extra });

test("stable ID matches a renamed account; never use the internal account UUID", () => {
  assert.equal(matchAccount([account()], "123", "oldname").kind, "matched");
  assert.equal(matchAccount([account()], "account-1", null).kind, "unmatched");
  assert.equal(matchAccount([account()], "123", null).kind, "matched");
});
test("username fallback is normalized and unique, ambiguous usernames skip", () => {
  assert.equal(matchAccount([account({ stableIds: [] })], null, "  @@CREATOR  ").kind, "matched");
  assert.equal(matchAccount([account(), account({ id: "second" })], null, "creator").kind, "ambiguous");
  assert.equal(matchAccount([account(), account({ id: "second", username: "other" })], "123", null).kind, "ambiguous");
  assert.equal(matchAccount([account({ username: null })], null, "Creator Name").kind, "unmatched");
});
test("conflicting ID/name evidence and known mismatched IDs skip", () => {
  assert.equal(matchAccount([account()], "999", "creator").kind, "conflict");
  assert.equal(matchAccount([account(), account({ id: "other", username: "other", stableIds: ["456"] })], "123", "other").kind, "conflict");
  assert.equal(matchAccount([account({ stableIds: ["123", "456"] })], "123", "creator").kind, "conflict");
});
test("historical username reuse cannot resolve an unknown stable account", () => {
  const plan = planPublicationBackfill([account({ stableIds: [] })], [], [evidence(), evidence({ ownerId: "456" })]);
  assert.equal(plan.summary.accountsChanged, 0);
  assert.equal(plan.summary.conflicts, 2);
});
test("URL-only and ID-bearing versions merge once in both orders", () => {
  const urlOnly = post({ caption: "verified" });
  const withId = post({ platformPostId: "p1", url: "https://instagram.com/reel/AbC/?utm_source=x#fragment", paidPartnership: false });
  for (const [a,b] of [[urlOnly, withId], [withId, urlOnly]]) {
    const merged = mergeCreatorRecentPublications([a!], [b!]);
    assert.equal(merged.length, 1);
    assert.equal(merged[0]!.platformPostId, "p1");
    assert.equal(merged[0]!.caption, "verified");
    assert.deepEqual(mergeCreatorRecentPublications(merged, [b!]), merged);
  }
  assert.notEqual(canonicalPublicationUrl("https://instagram.com/p/AbC"), canonicalPublicationUrl("https://instagram.com/p/abc"));
});
test("same URL with conflicting stable IDs preserves existing and skips incoming", () => {
  const issues: unknown[] = [];
  const existing = post({ platformPostId: "one" });
  const merged = mergeCreatorRecentPublications([existing], [post({ platformPostId: "two", caption: "wrong" })], i => issues.push(i));
  assert.deepEqual(merged, [existing]);
  assert.ok(issues.length);
});
test("dataset pagination includes all 2501 rows even when server caps page size", async () => {
  const rows = Array.from({ length: 2501 }, (_, i) => i);
  const offsets: number[] = [];
  const result = await readAllPages(async offset => {
    offsets.push(offset);
    return { items: rows.slice(offset, offset + 750), total: rows.length };
  });
  assert.deepEqual(result, rows);
  assert.deepEqual(offsets, [0,750,1500,2250]);
  await assert.rejects(readAllPages(async () => ({ items: [], total: 1001 })), /Incomplete/);
  let page = 0;
  await assert.rejects(readAllPages(async () => ({ items: [1], total: ++page === 1 ? 2 : 3 })), /changed/);
});
test("planning preserves provenance and stronger DNA, counts semantic changes, second pass is zero", () => {
  const document = createEmptyCreatorDNADocument();
  document.content.recentPublications = wrapValue([post({ caption: "verified", likes: 99 })], "manual", 1, { updatedAt: "2026-01-01T00:00:00Z", snapshotId: "snapshot" });
  const row = { influencer_id: "creator-1", document, raw_apify_snapshot: { retained: true }, last_snapshot_id: "snapshot", version: 7 };
  const original = structuredClone(row);
  const a = account({ recent_publications: [post({ caption: "verified", likes: 99 })] });
  const first = planPublicationBackfill([a], [row], [evidence(), evidence()]);
  assert.equal(first.summary.accountsChanged, 1);
  assert.equal(first.summary.dnaDocumentsChanged, 1);
  assert.equal(first.summary.publicationsEnriched, 1);
  assert.deepEqual(row, original);
  const envelope = first.dnaPlans[0]!.document.content.recentPublications;
  assert.equal(envelope.source, "manual");
  assert.equal(envelope.confidence, 1);
  assert.equal(envelope.value[0]!.caption, "verified");
  assert.equal(envelope.value[0]!.likes, 99);
  assert.equal(envelope.value[0]!.paidPartnership, false);
  assert.deepEqual(envelope.history.slice(0, original.document.content.recentPublications.history.length), original.document.content.recentPublications.history);
  const second = planPublicationBackfill([{ ...a, recent_publications: first.accountPlans[0]!.publications }], [{ ...row, document: first.dnaPlans[0]!.document }], [evidence()]);
  assert.equal(second.summary.accountsChanged, 0);
  assert.equal(second.summary.dnaDocumentsChanged, 0);
  assert.equal(second.summary.publicationsEnriched, 0);
  assert.equal(second.summary.unchanged.publications, 1);
  assert.deepEqual(second.dnaPlans[0]!.document, first.dnaPlans[0]!.document);
});
test("multiple accounts for one creator produce one DNA document proposal", () => {
  const plan = planPublicationBackfill([account(), account({ id: "a2", username: "second", stableIds: ["456"] })], [], [evidence(), evidence({ ownerId: "456", username: "second", publication: post({ platformPostId: "p2", url: "https://instagram.com/p/Other/" }) })]);
  assert.equal(plan.summary.accountsChanged, 2);
  assert.equal(plan.summary.dnaDocumentsChanged, 1);
});
test("URL-only input and ID-bearing destination count one enriched post, not an unchanged alias", () => {
  const plan = planPublicationBackfill([account({ recent_publications: [post({ platformPostId: "p1" })] })], [], [evidence({ publication: post({ paidPartnership: true }) })]);
  assert.equal(plan.summary.publicationsEnriched, 1);
  assert.equal(plan.summary.unchanged.publications, 0);
});
test("publication-only service merge omits raw snapshot and preserves snapshot/version provenance", async () => {
  const document = createEmptyCreatorDNADocument();
  document.content.recentPublications = wrapValue([post()], "manual", 1);
  const existing = { influencer_id: "creator-1", document, version: 7, last_snapshot_id: "snapshot-original", raw_apify_snapshot: { retained: true }, platform_account_ids: [], last_enrichment_run_id: "run-original" };
  const writes: { table: string; payload: Record<string, unknown> }[] = [];
  const fake = { from(table: string) { return {
    select() { return { eq() { return { maybeSingle: async () => ({ data: structuredClone(existing), error: null }) }; } }; },
    insert: async (payload: Record<string, unknown>) => { writes.push({ table, payload }); return { error: null }; },
    upsert: async (payload: Record<string, unknown>) => { writes.push({ table, payload }); return { error: null }; },
  }; } };
  const service = new CreatorDNAService(fake as never);
  await service.mergeEvidence("creator-1", { snapshotId: null, fields: [{ path: "content.recentPublications", value: [evidence().publication], confidence: .7, source: "ipl", updatedAt: "2026-09-15T00:00:00Z" }] });
  const payload = writes.find(w => w.table === "creator_dna")!.payload;
  assert.equal(Object.hasOwn(payload, "raw_apify_snapshot"), false);
  assert.deepEqual({ ...existing, ...payload }.raw_apify_snapshot, existing.raw_apify_snapshot);
  assert.equal(payload.last_snapshot_id, "snapshot-original");
  assert.equal(payload.last_enrichment_run_id, "run-original");
  assert.equal(payload.version, 8);
  assert.equal(writes.filter(w => w.table === "creator_dna_versions").length, 1);
  assert.equal(writes.filter(w => w.table === "creator_dna_lineage_events").length, 1);
});
test("read-only Production transport uses GET only; invalid credentials and targets fail before network", async () => {
  const requests: { url: string; method: string }[] = [];
  const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), method: init?.method ?? "GET" });
    return new Response(JSON.stringify([{ id: "fixture" }]), { headers: { "content-range": "0-0/1" } });
  }) as typeof fetch;
  const url = `https://${TARGETS.production}.supabase.co`;
  assert.throws(() => createReadOnlyStorage("production", url, "anonymous", "fixture", fakeFetch), /credential/);
  assert.throws(() => createReadOnlyStorage("development", url, "sb_secret_fixture", "fixture", fakeFetch), /target/);
  assert.equal(requests.length, 0);
  const reader = createReadOnlyStorage("production", url, "sb_secret_fixture", "fixture", fakeFetch);
  await reader.table("creator_dna", "select=*&order=influencer_id.asc");
  await reader.apify("datasets/fixture/items?offset=0&limit=1000");
  await assert.rejects(reader.apify("acts/fixture/runs"), /not allowed/);
  assert.equal(requests.length, 2);
  assert.ok(requests.every(r => r.method === "GET"));
  assert.equal("update" in reader, false);
  const denied = createReadOnlyStorage("production", url, "sb_secret_invalid", "fixture", (async () => new Response("denied", { status: 401 })) as typeof fetch);
  await assert.rejects(denied.table("creator_dna", "select=*"), /401/);
  const script = readFileSync("scripts/backfill-apify-rich-publication-evidence.ts", "utf8");
  assert.doesNotMatch(script, /CreatorDNAService|\.update\(|\.upsert\(|\.insert\(|--apply/);
});

test("entire Production preflight is offline GET-only, paginates datasets, rejects write mode", async () => {
  const requests: { url: string; method: string }[] = [];
  const env = { NEXT_PUBLIC_SUPABASE_URL: `https://${TARGETS.production}.supabase.co`, SUPABASE_SERVICE_ROLE_KEY: "sb_secret_fixture", APIFY_TOKEN: "fixture", APIFY_INSTAGRAM_ACTOR_ID: "instagram-fixture" };
  const a = account();
  const fake = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    requests.push({ url: String(input), method: init?.method ?? "GET" });
    const response = (data: unknown, count?: number) => new Response(JSON.stringify(data), { headers: count == null ? {} : { "content-range": `0-0/${count}` } });
    if (url.pathname.endsWith("influencer_platform_accounts")) return response([a], 1);
    if (url.pathname.endsWith("creator_dna")) return response([], 0);
    if (url.pathname.endsWith("ipl_snapshots")) return response([{ platform_account_id: a.id, influencer_id: a.influencer_id, raw_snapshot: { platformKey: "instagram", username: "creator", profileRows: [{ id: "123", username: "creator" }, { id: "wrong", username: "unrelated" }] } }], 1);
    if (url.pathname.endsWith("acts/instagram-fixture")) return response({ data: { id: "instagram-fixture" } });
    if (url.pathname.endsWith("actor-runs")) return response({ data: { total: 2, items: [{ id: "run", actId: "instagram-fixture", status: "SUCCEEDED", defaultDatasetId: "dataset", finishedAt: "2026-01-01T00:00:00Z" }, { id: "other", actId: "tiktok", status: "SUCCEEDED", defaultDatasetId: "wrong-dataset", finishedAt: "2026-01-01T00:00:00Z" }] } });
    if (url.pathname.endsWith("datasets/dataset")) return response({ data: { itemCount: 1001 } });
    if (url.pathname.endsWith("datasets/dataset/items")) {
      const offset = Number(url.searchParams.get("offset"));
      // Invalid rows are counted, not silently dropped; the final valid row
      // demonstrates that evidence after row 1000 reaches the real planner.
      return response(offset === 0 ? Array(1000).fill(null) : [{ ownerId: "123", ownerUsername: "oldname", id: "post-1", url: "https://instagram.com/p/AbC/", paidPartnership: false }]);
    }
    throw new Error(`Unexpected fixture request ${url.pathname}`);
  }) as typeof fetch;
  await assert.rejects(runPreflight(["--preflight", "--target=production", "--apply"], env, fake), /no write mode/);
  await assert.rejects(runPreflight(["--preflight"], env, fake), /Require/);
  assert.equal(requests.length, 0);
  const report = await runPreflight(["--preflight", "--target=production", "--before=2026-09-15"], env, fake);
  assert.equal(report.instagramRuns, 1);
  assert.equal(report.scannedRows, 1001);
  assert.equal(report.accountsChanged, 1);
  assert.equal(report.publicationsEnriched, 1);
  assert.equal(report.invalidRows, 1000);
  assert.equal(report.actualWrites, 0);
  assert.ok(requests.every(r => r.method === "GET"));
  assert.ok(requests.some(r => r.url.includes("offset=1000")));
  assert.ok(requests.every(r => !r.url.includes("wrong-dataset")));
});
