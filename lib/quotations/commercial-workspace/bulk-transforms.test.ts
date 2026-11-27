import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { QuotationRowDraft } from "@/features/quotations/quotation-row-math";

import { applyCommercialWorkspaceBulkOp, patchCommercialWorkspaceDraft } from "./bulk-transforms";

function draft(partial?: Partial<QuotationRowDraft>): QuotationRowDraft {
  return {
    id: "a",
    mode: "cost_revenue",
    cost: 100,
    costCurrency: "EGP",
    gpPct: 20,
    revenue: 125,
    gpValue: 25,
    afPct: 0,
    fxRateToEgp: 1,
    ...partial,
  };
}

describe("applyCommercialWorkspaceBulkOp", () => {
  it("increases and decreases revenue %", () => {
    const up = applyCommercialWorkspaceBulkOp(draft(), {
      kind: "increase_revenue_pct",
      pct: 10,
    });
    assert.equal(up.revenue, 137.5);

    const down = applyCommercialWorkspaceBulkOp(draft(), {
      kind: "decrease_revenue_pct",
      pct: 20,
    });
    assert.equal(down.revenue, 100);
  });

  it("sets GP % via cost_gp_pct mode", () => {
    const next = applyCommercialWorkspaceBulkOp(draft({ cost: 80 }), {
      kind: "set_gp_pct",
      pct: 25,
    });
    assert.equal(next.mode, "cost_gp_pct");
    assert.equal(next.gpPct, 25);
    assert.ok(next.revenue > next.cost);
  });

  it("applies markup % then persists as cost_revenue", () => {
    const next = applyCommercialWorkspaceBulkOp(draft({ cost: 100 }), {
      kind: "apply_markup_pct",
      pct: 30,
    });
    // Persist as cost_revenue so margin GP% is not re-read as markup later.
    assert.equal(next.mode, "cost_revenue");
    assert.equal(next.revenue, 130);
    assert.ok(next.gpPct > 0 && next.gpPct < 30);
  });

  it("applies discount % on revenue", () => {
    const next = applyCommercialWorkspaceBulkOp(draft({ revenue: 200, cost: 100 }), {
      kind: "apply_discount_pct",
      pct: 10,
    });
    assert.equal(next.revenue, 180);
  });

  it("updates currency and AF %", () => {
    const cur = applyCommercialWorkspaceBulkOp(draft(), {
      kind: "set_currency",
      currency: "usd",
      fxRateToEgp: 50,
    });
    assert.equal(cur.costCurrency, "USD");
    assert.equal(cur.fxRateToEgp, 50);

    const af = applyCommercialWorkspaceBulkOp(draft(), {
      kind: "set_af_pct",
      pct: 12,
    });
    assert.equal(af.afPct, 12);
  });
});

it("manual client cost starts blank and stays independent of internal cost", () => {
  const manual = patchCommercialWorkspaceDraft(draft({mode:"cost_markup_pct",cost:10000,revenue:10000}), {mode:"cost_revenue"});
  assert.equal(manual.revenue,0);
  assert.equal(patchCommercialWorkspaceDraft(manual,{cost:15000}).revenue,0);
  const priced = patchCommercialWorkspaceDraft(manual,{revenue:25000});
  assert.equal(patchCommercialWorkspaceDraft(priced,{cost:18000}).revenue,25000);
});
