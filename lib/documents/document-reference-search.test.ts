import assert from "node:assert/strict";
import { test } from "node:test";
import { filterQuotationRows, DEFAULT_QUOTATION_LIST_FILTERS } from "@/features/quotations/quotation-list-filters";
import { filterShortlistRows, DEFAULT_SHORTLIST_LIST_FILTERS } from "@/features/discovery/shortlists/shortlist-list-filters";
import type { QuotationListRow } from "@/features/quotations/types";
import type { ShortlistListRow } from "@/features/discovery/shortlists/types";

test("quotation search accepts compact and stored references without changing records", () => {
  const row = { id: "fixture", serial_number: "QT-2026-0031", name: "Example", status: "draft" } as QuotationListRow;
  for (const search of ["QT-26-31", "QT-2026-0031"]) {
    assert.deepEqual(filterQuotationRows([row], { ...DEFAULT_QUOTATION_LIST_FILTERS, search }), [row]);
  }
  assert.equal(row.serial_number, "QT-2026-0031");
  assert.deepEqual(filterQuotationRows([row], { ...DEFAULT_QUOTATION_LIST_FILTERS, search: "QT-26-32" }), []);
});

test("shortlist search accepts compact and stored references without changing records", () => {
  const row = { id: "fixture", serial_number: "SL-2026-0033", name: "Example", status: "draft" } as ShortlistListRow;
  for (const search of ["SL-26-33", "SL-2026-0033"]) {
    assert.deepEqual(filterShortlistRows([row], { ...DEFAULT_SHORTLIST_LIST_FILTERS, search }), [row]);
  }
  assert.equal(row.serial_number, "SL-2026-0033");
});
