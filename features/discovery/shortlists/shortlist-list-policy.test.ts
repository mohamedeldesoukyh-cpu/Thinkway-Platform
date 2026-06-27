import assert from "node:assert/strict";

import {
  actionsForShortlistStatus,
  resolveBulkShortlistActions,
} from "@/features/discovery/shortlists/shortlist-list-actions";
import {
  DEFAULT_SHORTLIST_LIST_FILTERS,
  filterShortlistRows,
  hasActiveShortlistListFilters,
} from "@/features/discovery/shortlists/shortlist-list-filters";
import type { ShortlistListRow } from "@/features/discovery/shortlists/types";

const rows: ShortlistListRow[] = [
  {
    id: "1",
    serial_number: "SL-2026-0001",
    name: "Summer Creators",
    description: null,
    status: "draft",
    visibility: "private",
    owner_id: "u1",
    owner_name: "Alex",
    client_id: "c1",
    client_name: "Acme",
    brand_id: "b1",
    brand_name: "Acme Brand",
    is_archived: false,
    creator_count: 2,
    creator_previews: [],
    approved_at: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-02",
  },
  {
    id: "2",
    serial_number: "SL-2026-0002",
    name: "Winter Push",
    description: null,
    status: "under_review",
    visibility: "team",
    owner_id: "u2",
    owner_name: "Sam",
    client_id: "c2",
    client_name: "Globex",
    brand_id: "b2",
    brand_name: "Globex Brand",
    is_archived: false,
    creator_count: 0,
    creator_previews: [],
    approved_at: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-03",
  },
];

assert.equal(actionsForShortlistStatus("draft").map((a) => a.key).join(","), "submit_for_review,cancel,archive");
assert.equal(actionsForShortlistStatus("under_review").map((a) => a.key).join(","), "approve,return_to_draft,cancel,archive");

assert.deepEqual(
  resolveBulkShortlistActions(["draft", "draft"]).map((a) => a.key),
  ["submit_for_review", "cancel", "archive"]
);
assert.deepEqual(resolveBulkShortlistActions(["draft", "under_review"]).map((a) => a.key), [
  "cancel",
  "archive",
]);
assert.deepEqual(resolveBulkShortlistActions(["under_review", "under_review"]).map((a) => a.key), [
  "approve",
  "return_to_draft",
  "cancel",
  "archive",
]);

assert.equal(hasActiveShortlistListFilters(DEFAULT_SHORTLIST_LIST_FILTERS), false);
assert.equal(
  hasActiveShortlistListFilters({ ...DEFAULT_SHORTLIST_LIST_FILTERS, search: "summer" }),
  true
);

assert.equal(filterShortlistRows(rows, DEFAULT_SHORTLIST_LIST_FILTERS).length, 2);
assert.equal(
  filterShortlistRows(rows, { ...DEFAULT_SHORTLIST_LIST_FILTERS, search: "summer" }).length,
  1
);
assert.equal(
  filterShortlistRows(rows, { ...DEFAULT_SHORTLIST_LIST_FILTERS, status: "under_review" }).length,
  1
);
assert.equal(
  filterShortlistRows(rows, { ...DEFAULT_SHORTLIST_LIST_FILTERS, brandId: "b1" }).length,
  1
);

console.log("shortlist-list-policy.test.ts: all assertions passed");
