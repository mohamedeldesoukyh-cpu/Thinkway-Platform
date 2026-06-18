import assert from "node:assert/strict";

import { checkClientCreditLimit } from "@/lib/finance/client-credit-exposure";

import {
  fetchClientCreditLimitFlagsSafe,
  fetchClientCreditLimitListSafe,
  fetchClientRowSafe,
} from "./safe-client-query";

function pgrst204(column: string) {
  return {
    code: "PGRST204",
    message: `Could not find the '${column}' column of 'clients' in the schema cache`,
  };
}

function pg42703(column: string) {
  return {
    code: "42703",
    message: `column clients.${column} does not exist`,
  };
}

function createSingleClientMock(responses: Array<{ data: unknown; error: unknown }>) {
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

function createListClientMock(responses: Array<{ data: unknown; error: unknown }>) {
  let callIndex = 0;

  return {
    from(table: string) {
      assert.equal(table, "clients");
      return {
        select() {
          return this;
        },
        order() {
          return this;
        },
        then(onFulfilled: (value: unknown) => unknown) {
          const response = responses[callIndex] ?? responses[responses.length - 1];
          callIndex += 1;
          return Promise.resolve(response).then(onFulfilled);
        },
      };
    },
  };
}

function createCreditCheckMock(
  clientResponses: Array<{ data: unknown; error: unknown }>,
  exposureMocks?: {
    invoices?: unknown[];
    headers?: unknown[];
  }
) {
  let clientCallIndex = 0;

  return {
    from(table: string) {
      if (table === "clients") {
        return {
          select(selectArg: string) {
            const isCreditFlags =
              selectArg.includes("credit_limit") &&
              !selectArg.includes("document_number");
            const isCurrencyOnly = selectArg === "currency";

            return {
              eq() {
                return this;
              },
              maybeSingle: async () => {
                if (isCurrencyOnly) {
                  return { data: { currency: "USD" }, error: null };
                }
                if (isCreditFlags) {
                  const response =
                    clientResponses[clientCallIndex] ??
                    clientResponses[clientResponses.length - 1];
                  clientCallIndex += 1;
                  return response;
                }
                return { data: null, error: null };
              },
              not() {
                return this;
              },
              neq() {
                return this;
              },
            };
          },
        };
      }

      if (table === "invoices") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          not() {
            return {
              data: exposureMocks?.invoices ?? [],
              error: null,
            };
          },
        };
      }

      if (table === "campaign_headers") {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          neq() {
            return {
              data: exposureMocks?.headers ?? [],
              error: null,
            };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

async function run() {
  {
    const supabase = createSingleClientMock([
      { data: null, error: pg42703("credit_limit_active") },
      {
        data: {
          id: "client-1",
          credit_limit: 10000,
          currency: "USD",
        },
        error: null,
      },
    ]);

    const result = await fetchClientCreditLimitFlagsSafe(
      supabase as never,
      "client-1"
    );

    assert.equal(result.error, null);
    assert.equal(result.found, true);
    assert.equal(result.credit_limit_active, false);
    assert.equal(result.accept_credit_risk, false);
    assert.equal(result.credit_limit, 10000);
  }

  {
    const supabase = createSingleClientMock([
      { data: null, error: pg42703("credit_limit_active") },
      { data: null, error: pg42703("accept_credit_risk") },
      {
        data: {
          id: "client-1",
          credit_limit: 5000,
          currency: "AED",
        },
        error: null,
      },
    ]);

    const result = await fetchClientCreditLimitFlagsSafe(
      supabase as never,
      "client-1"
    );

    assert.equal(result.error, null);
    assert.equal(result.credit_limit_active, false);
    assert.equal(result.accept_credit_risk, false);
    assert.equal(result.currency, "AED");
  }

  {
    const supabase = createCreditCheckMock([
      { data: null, error: pg42703("credit_limit_active") },
      {
        data: {
          id: "client-1",
          credit_limit: 1000,
          currency: "USD",
        },
        error: null,
      },
    ]);

    const result = await checkClientCreditLimit(supabase as never, {
      clientId: "client-1",
      additionalAmount: 100,
    });

    assert.equal(result.ok, true);
    assert.equal(result.enforced, false);
    assert.equal(result.credit_limit_active, false);
  }

  {
    const supabase = createSingleClientMock([
      { data: null, error: pgrst204("vr_rate_id") },
      {
        data: {
          id: "client-1",
          name: "Acme",
          vr_rate_id: "rate-1",
        },
        error: null,
      },
    ]);

    const result = await fetchClientRowSafe(supabase as never, "client-1", [
      "id",
      "name",
      "vr_rate_id",
    ]);

    assert.equal(result.error, null);
    assert.ok(result.strippedColumns.includes("vr_rate_id"));
    assert.equal(result.row?.name, "Acme");
  }

  {
    const supabase = createSingleClientMock([
      { data: null, error: pg42703("name_ar") },
      {
        data: {
          id: "client-1",
          name: "Acme",
        },
        error: null,
      },
    ]);

    const result = await fetchClientRowSafe(supabase as never, "client-1", [
      "id",
      "name",
      "name_ar",
    ]);

    assert.equal(result.error, null);
    assert.ok(result.strippedColumns.includes("name_ar"));
  }

  {
    const supabase = createListClientMock([
      { data: null, error: pg42703("credit_limit_active") },
      {
        data: [
          {
            id: "client-1",
            document_number: "TW-C-001",
            name: "Acme",
            legal_name: null,
            currency: "USD",
            credit_limit: 2500,
          },
        ],
        error: null,
      },
    ]);

    const result = await fetchClientCreditLimitListSafe(supabase as never);

    assert.equal(result.error, null);
    assert.equal(result.clients.length, 1);
    assert.equal(result.clients[0]?.credit_limit_active, false);
    assert.equal(result.clients[0]?.accept_credit_risk, false);
  }

  console.log("platform-schema-resilience.test.ts: ok");
}

run();
