import assert from "node:assert/strict";
import { test } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createCurrencyRateLoader } from "./billing-currency-server";

test("parallel campaigns share FX lookups only within one dashboard load", async () => {
  const calls: string[] = [];
  const db = { rpc: async (_name: string, args: { p_from_currency: string }) => {
    calls.push(args.p_from_currency);
    await new Promise(resolve => setTimeout(resolve, 5));
    return { data: args.p_from_currency === "USD" ? 50 : 13, error: null };
  } } as unknown as SupabaseClient;
  const load = createCurrencyRateLoader(db);
  const [first, second] = await Promise.all([load(["EGP", "USD"]), load(["USD", "AED"])]);
  assert.deepEqual(first, { EGP: 1, USD: 50 });
  assert.deepEqual(second, { USD: 50, AED: 13 });
  assert.deepEqual(calls.sort(), ["AED", "USD"]);
  await createCurrencyRateLoader(db)(["USD"]);
  assert.equal(calls.length, 3);
});

test("missing exchange rates remain errors rather than zero balances", async () => {
  const db = { rpc: async () => ({ data: null, error: { message: "missing rate" } }) } as unknown as SupabaseClient;
  await assert.rejects(createCurrencyRateLoader(db)(["USD"]), /missing rate/);
});
