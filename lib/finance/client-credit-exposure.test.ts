import assert from "node:assert/strict";
import { it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getClientCreditExposure } from "./client-credit-exposure";

function clientWithRates(usd: number) {
  const rows: Record<string, unknown> = {
    clients: { currency: "EGP" },
    invoices: [{ total: 10, amount_paid: 2, currency: "USD", campaign_header_id: "a" }],
    campaign_headers: [{ id: "a", currency_code: "EGP", po_amount_campaign_currency: 0,
      lines: [{ currency_code: "EUR", revenue: 100, usage_rights_amount: 10, agency_fee_percent: 10, agency_fee_amount: 0 }] },
    { id: "b", currency_code: "USD", po_amount_campaign_currency: 100, lines: [] }],
  };
  return {
    from(table: string) {
      const result = Promise.resolve({ data: rows[table], error: null });
      const query = { select: () => query, eq: () => query, neq: () => query, not: () => query,
        maybeSingle: () => result, then: result.then.bind(result) };
      return query;
    },
    rpc: async (_name: string, args: { p_from_currency: string }) => ({
      data: args.p_from_currency === "USD" ? usd : 65, error: null,
    }),
  } as unknown as SupabaseClient;
}

it("converts invoices, fees, line revenue and fallback budgets to the client's currency", async () => {
  const actual = await getClientCreditExposure(clientWithRates(60), "client");
  assert.deepEqual(actual, { currency: "EGP", outstanding_receivables: 480,
    unbilled_planned: 13265, exposure: 13745 });
});

it("revalues all USD components after an FX change", async () => {
  const actual = await getClientCreditExposure(clientWithRates(50), "client");
  assert.deepEqual(actual, { currency: "EGP", outstanding_receivables: 400,
    unbilled_planned: 12365, exposure: 12765 });
});
