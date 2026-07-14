import assert from "node:assert/strict";

import {
  applyQuotationCommercialSummaryHeaderSort,
  sortQuotationCommercialSummaryRows,
  type QuotationCommercialSummarySortRow,
} from "@/lib/quotations/quotation-commercial-summary-sort";

function row(
  partial: Partial<QuotationCommercialSummarySortRow> & Pick<QuotationCommercialSummarySortRow, "itemId">
): QuotationCommercialSummarySortRow {
  return {
    influencerName: "Creator",
    optionLabel: null,
    revenueEgp: 0,
    costEgp: 0,
    gpValueEgp: 0,
    gpPct: 0,
    ...partial,
  };
}

{
  const toggled = applyQuotationCommercialSummaryHeaderSort(
    { field: "revenue", direction: "desc" },
    "revenue"
  );
  assert.equal(toggled.direction, "asc");
}

{
  const toggled = applyQuotationCommercialSummaryHeaderSort(null, "gp");
  assert.deepEqual(toggled, { field: "gp", direction: "desc" });
}

{
  const rows = [
    row({ itemId: "a", influencerName: "Zara" }),
    row({ itemId: "b", influencerName: "Alpha" }),
    row({ itemId: "c", influencerName: "Mia" }),
  ];
  const sorted = sortQuotationCommercialSummaryRows(rows, {
    field: "influencer",
    direction: "asc",
  });
  assert.deepEqual(
    sorted.map((item) => item.itemId),
    ["b", "c", "a"]
  );
}

{
  const rows = [
    row({ itemId: "a", revenueEgp: 100, costEgp: 40, gpValueEgp: 60 }),
    row({ itemId: "b", revenueEgp: 500, costEgp: 200, gpValueEgp: 300 }),
    row({ itemId: "c", revenueEgp: 250, costEgp: 100, gpValueEgp: 150 }),
  ];
  const byRevenue = sortQuotationCommercialSummaryRows(rows, {
    field: "revenue",
    direction: "desc",
  });
  assert.deepEqual(
    byRevenue.map((item) => item.itemId),
    ["b", "c", "a"]
  );

  const byCost = sortQuotationCommercialSummaryRows(rows, {
    field: "cost",
    direction: "asc",
  });
  assert.deepEqual(
    byCost.map((item) => item.itemId),
    ["a", "c", "b"]
  );

  const byGp = sortQuotationCommercialSummaryRows(rows, {
    field: "gp",
    direction: "desc",
  });
  assert.deepEqual(
    byGp.map((item) => item.itemId),
    ["b", "c", "a"]
  );
}

{
  const rows = [
    row({ itemId: "a", revenueEgp: 200, gpValueEgp: 40, gpPct: 20 }),
    row({ itemId: "b", revenueEgp: 100, gpValueEgp: 50, gpPct: 50 }),
    row({ itemId: "c", revenueEgp: 0, gpValueEgp: 0, gpPct: 0 }),
  ];
  const sorted = sortQuotationCommercialSummaryRows(rows, {
    field: "gpPct",
    direction: "desc",
  });
  assert.deepEqual(
    sorted.map((item) => item.itemId),
    ["b", "a", "c"]
  );
}

{
  const rows = [
    row({ itemId: "a", influencerName: "Same", optionLabel: "Option 2" }),
    row({ itemId: "b", influencerName: "Same", optionLabel: "Option 1" }),
  ];
  const sorted = sortQuotationCommercialSummaryRows(rows, {
    field: "influencer",
    direction: "asc",
  });
  assert.deepEqual(
    sorted.map((item) => item.itemId),
    ["b", "a"]
  );
}

console.log("quotation-commercial-summary-sort tests passed");
