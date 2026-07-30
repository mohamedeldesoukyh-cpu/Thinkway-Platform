import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { QuotationRowDraft } from "@/features/quotations/quotation-row-math";

import {
  canRedoCommercialDraft,
  canUndoCommercialDraft,
  createCommercialDraftHistory,
  pushCommercialDraftHistory,
  redoCommercialDraftHistory,
  undoCommercialDraftHistory,
} from "./draft-history";

function d(id: string, cost: number): QuotationRowDraft {
  return {
    id,
    mode: "cost_revenue",
    cost,
    costCurrency: "EGP",
    gpPct: 20,
    revenue: cost * 1.25,
    gpValue: cost * 0.25,
    afPct: 0,
    fxRateToEgp: 1,
  };
}

describe("commercial draft history", () => {
  it("undoes and redoes session edits", () => {
    let state = createCommercialDraftHistory({ a: d("a", 100) });
    state = pushCommercialDraftHistory(state, { a: d("a", 110) });
    state = pushCommercialDraftHistory(state, { a: d("a", 120) });

    assert.equal(canUndoCommercialDraft(state), true);
    const undone = undoCommercialDraftHistory(state)!;
    assert.equal(undone.present.a?.cost, 110);

    const redone = redoCommercialDraftHistory(undone)!;
    assert.equal(redone.present.a?.cost, 120);
    assert.equal(canRedoCommercialDraft(redone), false);
  });
});
