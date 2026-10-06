import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { findDuplicatePlatformAccounts } from "./duplicate-check";

function client(rows: Record<string, unknown>[], fail = false) {
  return { from() {
    const filters: ((row: Record<string, unknown>) => boolean)[] = [];
    const query = {
      select() { return query; },
      eq(key: string, value: unknown) { filters.push((row) => row[key] === value); return query; },
      neq(key: string, value: unknown) { filters.push((row) => row[key] !== value); return query; },
      ilike(key: string, value: string) {
        const isUrl = key === "profile_url" || key === "normalized_profile_url";
        const candidate = isUrl ? value.slice(1, -1) : value;
        assert.equal(candidate.replace(/\\./g, "").includes("_"), false);
        assert.equal(candidate.replace(/\\./g, "").includes("%"), false);
        const literal = candidate.replace(/\\(.)/g, "$1").toLowerCase();
        filters.push((row) => isUrl
          ? String(row[key] ?? "").toLowerCase().includes(literal)
          : String(row[key] ?? "").toLowerCase() === literal);
        return query;
      },
      order() { return query; },
      async range(start: number, end: number) { return { data: rows.filter((row) => filters.every((filter) => filter(row))).slice(start, end + 1), error: fail ? { message: "lookup failed" } : null }; },
      async limit() { return { data: rows.filter((row) => filters.every((filter) => filter(row))), error: fail ? { message: "lookup failed" } : null }; },
    };
    return query;
  } } as unknown as SupabaseClient;
}
const row = { id: "account", influencer_id: "creator", platform: "instagram", username: null, handle: "@Marina_.Nader", normalized_username: null, profile_url: "https://www.instagram.com/marina_.nader/", influencer: { id: "creator", display_name: "Marina", document_number: "INF-1" } };
const input = { platform: "instagram", normalized_username: "marina_.nader" };

test("legacy mixed-case @handle prevents a duplicate without normalized columns", async () => {
  const found = await findDuplicatePlatformAccounts(client([row]), input);
  assert.equal(found.length, 1);
  assert.equal(found[0].influencer_id, "creator");
});
test("identity matching is platform specific and respects account exclusions", async () => {
  assert.deepEqual(await findDuplicatePlatformAccounts(client([row]), { ...input, platform: "tiktok" }), []);
  assert.deepEqual(await findDuplicatePlatformAccounts(client([row]), { ...input, exclude_account_id: "account" }), []);
  assert.deepEqual(await findDuplicatePlatformAccounts(client([row]), { ...input, exclude_influencer_id: "creator" }), []);
});
test("normalized identity wins and legacy aliases do not duplicate the result", async () => {
  assert.equal((await findDuplicatePlatformAccounts(client([{ ...row, normalized_username: input.normalized_username }]), input)).length, 1);
});
test("failed duplicate lookup fails closed", async () => {
  await assert.rejects(findDuplicatePlatformAccounts(client([], true), input), /lookup failed/);
});

test("same profile link is blocked despite stale handles and URL formatting", async () => {
  for (const url of [
    "http://instagram.com/Marina_.Nader/?igsh=tracking#bio",
    "https://www.instagram.com/marina_.nader",
    "https://m.instagram.com/marina_.nader/",
  ]) {
    const legacy = { ...row, handle: "old_name", profile_url: url };
    const found = await findDuplicatePlatformAccounts(client([legacy]), {
      platform: "instagram", normalized_username: "incorrect_name",
      normalized_profile_url: "https://www.instagram.com/marina_.nader/",
    });
    assert.equal(found[0]?.account_id, row.id);
  }
});

test("raw URL matching does not reject a different account with a similar handle", async () => {
  const similar = { ...row, handle: "old", profile_url: "https://instagram.com/marina_.nader.food/" };
  assert.deepEqual(await findDuplicatePlatformAccounts(client([similar]), input), []);
});

test("Facebook numeric identity matches raw links without conflating other IDs", async () => {
  const facebook = { ...row, platform: "facebook", handle: "old", profile_url: "https://m.facebook.com/profile.php?id=12345&ref=share" };
  const numeric = { platform: "facebook", normalized_username: "id:12345", normalized_profile_url: "https://www.facebook.com/profile.php?id=12345" };
  assert.equal((await findDuplicatePlatformAccounts(client([facebook]), numeric)).length, 1);
  assert.deepEqual(await findDuplicatePlatformAccounts(client([{ ...facebook, profile_url: "https://facebook.com/profile.php?id=123456" }]), numeric), []);
});

test("raw URL fallback searches past similar-name candidates and excludes only edited account", async () => {
  const similar = Array.from({ length: 101 }, (_, i) => ({ ...row, id: `similar-${i}`, handle: "old", profile_url: `https://instagram.com/marina_.nader.${i}/` }));
  const exact = { ...row, handle: "old" };
  assert.equal((await findDuplicatePlatformAccounts(client([...similar, exact]), input))[0]?.account_id, "account");
  assert.deepEqual(await findDuplicatePlatformAccounts(client([exact]), { ...input, exclude_account_id: "account" }), []);
  assert.deepEqual(await findDuplicatePlatformAccounts(client([exact]), { ...input, exclude_influencer_id: "creator" }), []);
});
