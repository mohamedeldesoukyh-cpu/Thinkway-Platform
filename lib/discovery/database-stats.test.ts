import assert from "node:assert/strict";
import test from "node:test";

import {
  mapDiscoveryDatabaseStatsRows,
  type DiscoveryDatabaseStatsRpcRow,
} from "@/lib/discovery/database-stats";

test("mapDiscoveryDatabaseStatsRows aggregates rpc rows", () => {
  const rows: DiscoveryDatabaseStatsRpcRow[] = [
    {
      total_creators: 100,
      categorized_creators: 80,
      category_label: "Beauty",
      category_count: 40,
    },
    {
      total_creators: 100,
      categorized_creators: 80,
      category_label: "Lifestyle",
      category_count: 30,
    },
    {
      total_creators: 100,
      categorized_creators: 80,
      category_label: "Uncategorized",
      category_count: 20,
    },
  ];

  const stats = mapDiscoveryDatabaseStatsRows(rows);

  assert.equal(stats.totalCreators, 100);
  assert.equal(stats.categorizedCreators, 80);
  assert.equal(stats.uncategorizedCreators, 20);
  assert.deepEqual(stats.topCategories, [
    { label: "Beauty", count: 40 },
    { label: "Lifestyle", count: 30 },
    { label: "Uncategorized", count: 20 },
  ]);
});

test("mapDiscoveryDatabaseStatsRows handles empty rows", () => {
  const stats = mapDiscoveryDatabaseStatsRows([]);

  assert.equal(stats.totalCreators, 0);
  assert.equal(stats.topCategories.length, 0);
});
