import assert from "node:assert/strict";

import {
  actionsForQuotationRow,
  resolveBulkQuotationActions,
} from "./quotation-list-actions";
import {
  DEFAULT_QUOTATION_LIST_FILTERS,
  filterQuotationRows,
  hasActiveQuotationListFilters,
} from "./quotation-list-filters";
import type { QuotationListRow } from "./types";

const baseRow = (overrides: Partial<QuotationListRow> = {}): QuotationListRow => ({
  id: "q1",
  serial_number: "QT-2026-0001",
  name: "Test Quotation",
  status: "draft",
  client_id: "c1",
  client_name: "OMG",
  brand_id: "b1",
  brand_name: "Coca",
  campaign_name: null,
  shortlist_id: null,
  owner_id: "u1",
  owner_name: "Owner",
  total_cost_egp: 1000,
  total_revenue_egp: 2000,
  total_gp_value_egp: 1000,
  total_gp_pct: 50,
  item_count: 2,
  creator_previews: [],
  is_archived: false,
  issue_date: null,
  validity_date: null,
  version: "v1.0",
  created_at: "2026-06-01T00:00:00Z",
  updated_at: "2026-06-01T00:00:00Z",
  ...overrides,
});

{
  const draftOnly = resolveBulkQuotationActions([baseRow(), baseRow({ id: "q2" })]);
  assert.ok(draftOnly.some((action) => action.key === "archive"));

  const mixed = resolveBulkQuotationActions([
    baseRow(),
    baseRow({ id: "q2", is_archived: true, status: "archived" }),
  ]);
  assert.equal(mixed.length, 0);

  assert.equal(actionsForQuotationRow(baseRow({ is_archived: true })).length, 0);
}

{
  const rows = [
    baseRow({ name: "Beauty pitch", brand_name: "Loreal" }),
    baseRow({ id: "q2", name: "Bank deal", client_name: "Arab Bank" }),
  ];

  assert.equal(
    filterQuotationRows(rows, DEFAULT_QUOTATION_LIST_FILTERS).length,
    2
  );

  const filtered = filterQuotationRows(rows, {
    ...DEFAULT_QUOTATION_LIST_FILTERS,
    search: "bank",
  });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]?.client_name, "Arab Bank");

  assert.equal(hasActiveQuotationListFilters(DEFAULT_QUOTATION_LIST_FILTERS), false);
  assert.equal(
    hasActiveQuotationListFilters({
      ...DEFAULT_QUOTATION_LIST_FILTERS,
      status: "sent",
    }),
    true
  );
}

console.log("quotation-list-policy.test.ts passed");
