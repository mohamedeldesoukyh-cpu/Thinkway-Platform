import assert from "node:assert/strict";
import { test } from "node:test";
import { loadClientWorkspaceDisplayFlags, persistClientWorkspaceDisplayFlags } from "./client-original-currency-persist";

function fixture(quotationMetadata: Record<string, unknown>, shortlistMetadata: Record<string, unknown>, reverseOnly = false) {
  const records: Record<string, Record<string, unknown>[]> = {
    quotation_items: [],
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


test("photo loading is opt-in, quotation-scoped, and removed when restored", async () => {
  const photo = "data:image/webp;base64,UklGRg==";
  const { db, records } = fixture({ hideCostAndFees: true, templateCreatorPhotos: { "u:ours": photo, "u:theirs": photo } }, {});
  records.quotation_items = [
    { id: "ours-line", quotation_id: "q", unified_id: "ours" },
    { id: "other-line", quotation_id: "other-quotation", unified_id: "theirs" },
  ];
  assert.equal((await loadClientWorkspaceDisplayFlags(db, { quotationId: "q" })).creatorPhotoOverrides, undefined);
  const flags = await loadClientWorkspaceDisplayFlags(db, { shortlistId: "s", includeCreatorPhotos: true });
  assert.deepEqual(flags.creatorPhotoOverrides, { "item:ours-line": photo, "u:ours": photo });
  assert.equal(flags.hideCostAndFees, true);
  await persistClientWorkspaceDisplayFlags(db, { quotationId: "q", patch: { showOriginalCurrency: true } });
  assert.equal((records.discovery_shortlists[0].metadata as Record<string, unknown>).creatorPhotoOverrides, undefined);
  assert.equal((records.discovery_shortlists[0].metadata as Record<string, unknown>).templateCreatorPhotos, undefined);
  (records.quotations[0].metadata as Record<string, unknown>).templateCreatorPhotos = {};
  assert.equal((await loadClientWorkspaceDisplayFlags(db, { quotationId: "q", includeCreatorPhotos: true })).creatorPhotoOverrides, undefined);
});

test("failed photo lookup preserves hidden prices and original currency", async () => {
  const { db } = fixture({ hideCostAndFees: true, showOriginalCurrency: true, templateCreatorPhotos: { "u:ours": "data:image/webp;base64,UklGRg==" } }, {});
  const from = db.from.bind(db);
  db.from = ((table: string) => table === "quotation_items" ? { select: () => ({ eq: () => Promise.resolve({ data: null, error: { message: "unavailable" } }) }) } : from(table as never)) as typeof db.from;
  assert.deepEqual(await loadClientWorkspaceDisplayFlags(db, { quotationId: "q", includeCreatorPhotos: true }), { hideCostAndFees: true, showOriginalCurrency: true });
});
