import assert from "node:assert/strict";
import { it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveRateToEgp } from "./fx-server";
import { fromEgp, toEgp } from "./fx-aggregation";

it("fails explicitly on lookup failures and missing FX rates", async () => {
  for (const response of [{ data: null, error: null }, { data: 0, error: null },
    { data: null, error: { message: "lookup denied" } }]) {
    const client = { rpc: async () => response } as unknown as SupabaseClient;
    await assert.rejects(resolveRateToEgp(client, "USD"));
    assert.equal(await resolveRateToEgp(client, "EGP"), 1);
  }
  assert.throws(() => toEgp(100, null));
  assert.throws(() => fromEgp(100, "USD", 0));
  assert.equal(fromEgp(100, "EGP", null), 100);
});
