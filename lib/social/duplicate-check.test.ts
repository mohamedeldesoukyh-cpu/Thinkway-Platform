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
        // No unescaped LIKE wildcard is allowed for an identity lookup.
        assert.equal(value.replace(/\\./g, "").includes("_"), false);
        assert.equal(value.replace(/\\./g, "").includes("%"), false);
        const literal = value.replace(/\\(.)/g, "$1").toLowerCase();
        filters.push((row) => String(row[key] ?? "").toLowerCase() === literal);
        return query;
      },
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
