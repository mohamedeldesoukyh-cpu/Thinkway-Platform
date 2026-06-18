import assert from "node:assert/strict";

import {
  fetchClientDetailRowById,
  CLIENT_DETAIL_SELECT_BASE,
} from "./client-detail-query";

function pgrst204(column: string) {
  return {
    code: "PGRST204",
    message: `Could not find the '${column}' column of 'clients' in the schema cache`,
  };
}

function createMockSupabase(responses: Array<{ data: unknown; error: unknown }>) {
  let callIndex = 0;

  return {
    from(table: string) {
      assert.equal(table, "clients");
      return {
        select(select: string) {
          assert.ok(select.includes("group:groups"));
          assert.ok(
            CLIENT_DETAIL_SELECT_BASE.every((column) => select.includes(column)),
            `expected base columns in select: ${select}`
          );
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
      {
        data: {
          id: "client-1",
          name: "Acme",
          vr_rate_id: "rate-1",
          group: { id: "group-1", name: "Group", document_number: "TW-G-001" },
        },
        error: null,
      },
    ]);
    const result = await fetchClientDetailRowById(supabase as never, "client-1");
    assert.equal(result.error, null);
    assert.equal(result.client?.id, "client-1");
    assert.equal(result.client?.vr_rate_id, "rate-1");
  }

  {
    const supabase = createMockSupabase([
      { data: null, error: pgrst204("vr_rate_id") },
      {
        data: {
          id: "client-1",
          name: "Acme",
          group: { id: "group-1", name: "Group", document_number: "TW-G-001" },
        },
        error: null,
      },
    ]);
    const result = await fetchClientDetailRowById(supabase as never, "client-1");
    assert.equal(result.error, null);
    assert.equal(result.client?.vr_rate_id, null);
  }

  {
    const supabase = createMockSupabase([
      { data: null, error: pgrst204("name_ar") },
      {
        data: {
          id: "client-1",
          name: "Acme",
          group: { id: "group-1", name: "Group" },
        },
        error: null,
      },
    ]);
    const result = await fetchClientDetailRowById(supabase as never, "client-1");
    assert.equal(result.error, null);
    assert.equal(result.client?.name_ar, null);
  }

  console.log("client-detail-query.test.ts: ok");
}

run();
