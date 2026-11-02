import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveQuotationDisplayRates } from "./quotation-fx-server";
import { COMMERCIAL_CURRENCIES } from "./fx-aggregation";

test("all six targets request each source-target pair with the quotation date", async () => {
  const calls: { p_from_currency: string; p_to_currency: string; p_as_of?: string }[] = [];
  const client = { rpc: async (_name: string, args: typeof calls[number]) => {
    calls.push(args);
    return { data: args.p_from_currency === "AED" && args.p_to_currency === "USD" ? 0.27229408 : 2, error: null };
  } } as unknown as SupabaseClient;
  for (const target of COMMERCIAL_CURRENCIES) {
    const result = await resolveQuotationDisplayRates(client, target, "2026-10-29");
    assert.equal(result.directRates[target], 1);
    for (const source of COMMERCIAL_CURRENCIES.filter(code => code !== target)) {
      assert.ok(calls.some(call => call.p_from_currency === source && call.p_to_currency === target && call.p_as_of === "2026-10-29"));
    }
    if (target === "USD") assert.equal(result.directRates.AED, 0.27229408);
  }
});

test("missing direct rates fail explicitly instead of using an EGP ratio", async () => {
  const client = { rpc: async () => ({ data: null, error: null }) } as unknown as SupabaseClient;
  await assert.rejects(resolveQuotationDisplayRates(client, "EGP"), /Missing FX rate/);
});
