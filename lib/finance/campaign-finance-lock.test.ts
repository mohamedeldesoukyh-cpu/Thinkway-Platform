import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  Campaign,
  formatFinanceLockReasons,
  isCampaignFinanceLocked,
} from "./campaign-finance-lock";

type Row = Record<string, unknown>;

function mockSupabase(tables: Record<string, Row[]>) {
  const api = {
    from(table: string) {
      const rows = tables[table] ?? [];
      const state = {
        filters: [] as Array<() => boolean>,
        notNullCol: null as string | null,
        inCol: null as string | null,
        inValues: [] as unknown[],
      };
      const builder = {
        select(_cols?: string) {
          return builder;
        },
        eq(col: string, value: unknown) {
          state.filters.push((row) => row[col] === value);
          return builder;
        },
        not(col: string, op: string, _value: unknown) {
          if (op === "is") state.notNullCol = col;
          return builder;
        },
        in(col: string, values: unknown[]) {
          state.inCol = col;
          state.inValues = values;
          return builder;
        },
        limit(_n: number) {
          return Promise.resolve({ data: apply().slice(0, 1), error: null });
        },
        maybeSingle() {
          const data = apply()[0] ?? null;
          return Promise.resolve({ data, error: null });
        },
        then(
          resolve: (value: { data: Row[] | null; error: null }) => unknown
        ) {
          return Promise.resolve({ data: apply(), error: null }).then(resolve);
        },
      };

      function apply() {
        return rows.filter((row) => {
          if (!state.filters.every((f) => f(row))) return false;
          if (state.notNullCol && row[state.notNullCol] == null) return false;
          if (
            state.inCol &&
            !state.inValues.includes(row[state.inCol as string])
          ) {
            return false;
          }
          return true;
        });
      }

      return builder;
    },
  };
  return api as never;
}

describe("Campaign.isFinanceLocked platform gateway", () => {
  it("exposes Campaign.isFinanceLocked as the single API", () => {
    assert.equal(Campaign.isFinanceLocked, isCampaignFinanceLocked);
  });

  it("is unlocked when no finance artefacts exist", async () => {
    const supabase = mockSupabase({
      campaign_headers: [
        { id: "ch1", start_date: "2026-07-01", created_at: "2026-07-01T00:00:00Z" },
      ],
      financial_periods: [{ year: 2026, month: 7, status: "open" }],
    });
    const result = await isCampaignFinanceLocked(supabase, "ch1");
    assert.equal(result.locked, false);
    assert.deepEqual(result.reasons, []);
  });

  it("locks when a Vendor IO exists", async () => {
    const supabase = mockSupabase({
      vendor_ios: [{ id: "vio1", campaign_header_id: "ch1" }],
      campaign_headers: [
        { id: "ch1", start_date: "2026-07-01", created_at: "2026-07-01T00:00:00Z" },
      ],
      financial_periods: [{ year: 2026, month: 7, status: "open" }],
    });
    const result = await isCampaignFinanceLocked(supabase, "ch1");
    assert.equal(result.locked, true);
    assert.ok(result.reasons.includes("vendor_io"));
  });

  it("locks when invoice and payment exist", async () => {
    const supabase = mockSupabase({
      invoices: [{ id: "inv1", campaign_header_id: "ch1" }],
      payments: [{ id: "pay1", invoice_id: "inv1" }],
      campaign_headers: [
        { id: "ch1", start_date: "2026-07-01", created_at: "2026-07-01T00:00:00Z" },
      ],
      financial_periods: [{ year: 2026, month: 7, status: "open" }],
    });
    const result = await isCampaignFinanceLocked(supabase, "ch1");
    assert.equal(result.locked, true);
    assert.ok(result.reasons.includes("invoice"));
    assert.ok(result.reasons.includes("payment"));
  });

  it("locks on closed accounting period", async () => {
    const supabase = mockSupabase({
      campaign_headers: [
        { id: "ch1", start_date: "2026-07-01", created_at: "2026-07-01T00:00:00Z" },
      ],
      financial_periods: [{ year: 2026, month: 7, status: "fully_locked" }],
    });
    const result = await isCampaignFinanceLocked(supabase, "ch1");
    assert.equal(result.locked, true);
    assert.ok(result.reasons.includes("closed_accounting_period"));
  });

  it("formats reasons for diagnostics", () => {
    assert.equal(
      formatFinanceLockReasons(["vendor_io", "invoice"]),
      "vendor_io, invoice"
    );
  });
});
