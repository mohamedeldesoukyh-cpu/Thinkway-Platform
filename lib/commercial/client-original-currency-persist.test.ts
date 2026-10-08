import assert from "node:assert/strict";
import { test } from "node:test";
import { loadClientWorkspaceDisplayFlags, persistClientWorkspaceDisplayFlags } from "./client-original-currency-persist";

function fixture(quotationMetadata: Record<string, unknown>, shortlistMetadata: Record<string, unknown>, reverseOnly = false) {
  const records: Record<string, Record<string, unknown>[]> = {
    quotations: [{ id: "q", shortlist_id: "s", metadata: quotationMetadata, is_archived: false, status: "draft" }],
    discovery_shortlists: [{ id: "s", quotation_id: reverseOnly ? null : "q", metadata: shortlistMetadata }],
  };
  const db = { from(table: string) {
    let rows = records[table];
    let patch: Record<string, unknown> | undefined;
    const query = {
      select() { return query; },
      eq(key: string, value: unknown) { rows = rows.filter(row => row[key] === value); return query; },
      neq(key: string, value: unknown) { rows = rows.filter(row => row[key] !== value); return query; },
      order() { return query; }, limit() { return query; },
      update(value: Record<string, unknown>) { patch = value; return query; },
      maybeSingle() { return Promise.resolve({ data: rows[0] ?? null, error: null }); },
      then(resolve: (value: unknown) => unknown) {
        if (patch) for (const row of rows) Object.assign(row, patch);
        return Promise.resolve(resolve({ data: rows, error: null }));
      },
    };
    return query;
  } } as unknown as Parameters<typeof loadClientWorkspaceDisplayFlags>[0];
  return { db, records };
}

test("quotation OFF beats stale shortlist ON across both display settings", async () => {
  const { db } = fixture({}, { hideCostAndFees: true, showOriginalCurrency: true });
  const expected = { hideCostAndFees: false, showOriginalCurrency: false };
  assert.deepEqual(await loadClientWorkspaceDisplayFlags(db, { quotationId: "q", shortlistId: "s" }), expected);
  assert.deepEqual(await loadClientWorkspaceDisplayFlags(db, { shortlistId: "s" }), expected);
});

test("shortlist resolves reverse-linked quotation and standalone settings", async () => {
  const { db, records } = fixture({ hideCostAndFees: true }, { showOriginalCurrency: true }, true);
  assert.deepEqual(await loadClientWorkspaceDisplayFlags(db, { shortlistId: "s" }), { hideCostAndFees: true, showOriginalCurrency: false });
  records.quotations = [];
  assert.deepEqual(await loadClientWorkspaceDisplayFlags(db, { shortlistId: "s" }), { hideCostAndFees: false, showOriginalCurrency: true });
});

for (const source of ["quotation", "shortlist"] as const) {
  test(`${source} toggle synchronizes both flags and preserves unrelated metadata`, async () => {
    const { db, records } = fixture({ currency: "EGP", hideCostAndFees: true }, { currency: "USD", showOriginalCurrency: true });
    const scope = source === "quotation" ? { quotationId: "q" } : { shortlistId: "s" };
    assert.equal((await persistClientWorkspaceDisplayFlags(db, { ...scope, patch: { hideCostAndFees: false } })).ok, true);
    for (const row of [records.quotations[0], records.discovery_shortlists[0]]) {
      const metadata = row.metadata as Record<string, unknown>;
      assert.equal(metadata.hideCostAndFees, undefined);
      assert.equal(metadata.showOriginalCurrency, undefined);
    }
    assert.equal((records.quotations[0].metadata as Record<string, unknown>).currency, "EGP");
    assert.equal((records.discovery_shortlists[0].metadata as Record<string, unknown>).currency, "USD");
    await persistClientWorkspaceDisplayFlags(db, { ...scope, patch: { showOriginalCurrency: true } });
    assert.deepEqual(await loadClientWorkspaceDisplayFlags(db, scope), { hideCostAndFees: false, showOriginalCurrency: true });
  });
}
