import assert from "node:assert/strict";

import {
  packBlocksIntoPages,
  SHORTLIST_PAGINATION_READY_ATTR,
  SHORTLIST_PAGINATION_READY_VALUE,
  buildShortlistPaginationRuntimeScript,
} from "./shortlist-pagination-engine";

{
  const pages = packBlocksIntoPages({
    contentHeight: 100,
    blocks: [
      { id: "a", height: 40, atomic: true, allowTableRowSplit: false },
      { id: "b", height: 40, atomic: true, allowTableRowSplit: false },
      { id: "c", height: 40, atomic: true, allowTableRowSplit: false },
    ],
  });
  assert.equal(pages.length, 2);
  assert.deepEqual(pages[0]?.blockIds, ["a", "b"]);
  assert.deepEqual(pages[1]?.blockIds, ["c"]);
}

{
  const pages = packBlocksIntoPages({
    contentHeight: 100,
    blocks: [
      {
        id: "table",
        height: 500,
        atomic: true,
        allowTableRowSplit: true,
        tableChromeHeight: 20,
        rowHeights: [30, 30, 30, 30, 30],
      },
    ],
  });
  assert.ok(pages.length >= 2);
  assert.equal(pages[0]?.tableSlices?.table?.start, 0);
  assert.ok((pages[0]?.tableSlices?.table?.end ?? 0) < 5);
  const last = pages[pages.length - 1];
  assert.equal(last?.tableSlices?.table?.end, 5);
}

{
  const script = buildShortlistPaginationRuntimeScript();
  assert.ok(script.includes("paginateShowcase"));
  assert.ok(script.includes("getBoundingClientRect"));
  assert.ok(script.includes(SHORTLIST_PAGINATION_READY_ATTR));
  assert.ok(script.includes(SHORTLIST_PAGINATION_READY_VALUE));
  assert.ok(script.includes("packBlocksIntoPages"));
}

console.log("shortlist-pagination-engine.test.ts passed");
