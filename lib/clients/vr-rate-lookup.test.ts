import assert from "node:assert/strict";

import { fetchClientVrRateIdSafe } from "./vr-rate-lookup";

function pgMissingColumn(column: string) {
  return {
    code: "42703",
    message: `column clients.${column} does not exist`,
  };
}

function createMockSupabase(responses: Array<{ data: unknown; error: unknown }>) {
  let callIndex = 0;

  return {
    from(table: string) {
      assert.equal(table, "clients");
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        maybeSingle: async () => {
          const response = responses[callIndex] ?? responses[responses.length - 1];
          callIndex += 1;
          return response;
        },
      };
    },
  };
}

async function run() {
  {
    const supabase = createMockSupabase([
      { data: { vr_rate_id: "rate-abc" }, error: null },
    ]);
    const result = await fetchClientVrRateIdSafe(
      supabase as never,
      "client-1"
    );
    assert.equal(result.error, null);
    assert.equal(result.value, "rate-abc");
  }

  {
    const supabase = createMockSupabase([
      { data: null, error: pgMissingColumn("vr_rate_id") },
    ]);
    const result = await fetchClientVrRateIdSafe(
      supabase as never,
      "client-1"
    );
    assert.equal(result.error, null);
    assert.equal(result.value, null);
  }

  {
    const supabase = createMockSupabase([
      { data: null, error: { code: "42501", message: "permission denied" } },
    ]);
    const result = await fetchClientVrRateIdSafe(
      supabase as never,
      "client-1"
    );
    assert.equal(result.value, null);
    assert.equal(result.error, "permission denied");
  }

  console.log("vr-rate-lookup.test.ts: ok");
}

run();
