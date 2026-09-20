import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getCampaignPoFxTotals, resolveFxPoSummary } from "./fx-totals";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("PO FX reporting", () => {
  it("uses converted amounts for consumption and budget", () => {
    const actual = resolveFxPoSummary({ campaign_header_id: "campaign",
      po_amount: 963264.17, po_consumed: 963264.17, po_rate: null,
    }, { po_status: "active", po_expiry_date: null });
    assert.equal(actual.po_amount, 963264.17);
    assert.equal(actual.po_consumed, 963264.17);
    assert.equal(actual.po_remaining, 0);
    assert.equal(actual.po_status, "near_limit");
  });
  it("detects over-consumption after currency conversion", () => {
    const actual = resolveFxPoSummary({ campaign_header_id: "campaign",
      po_amount: 1000, po_consumed: 1200, po_rate: 60,
    }, { po_status: "active", po_expiry_date: null });
    assert.equal(actual.po_exceeded, true);
    assert.equal(actual.po_remaining, -200);
  });
  it("surfaces conversion failures instead of displaying stale PO totals", async () => {
    const client = { from: () => ({ select: () => ({ in: async () => ({ data: null, error: { message: "Missing FX rate" } }) }) }) };
    await assert.rejects(getCampaignPoFxTotals(client as unknown as SupabaseClient, ["id"]), /Missing FX rate/);
  });
});
