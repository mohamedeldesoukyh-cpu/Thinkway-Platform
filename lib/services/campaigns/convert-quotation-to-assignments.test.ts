import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { canCreateCampaignFromQuotation } from "@/lib/commercial-sync/rules";
import { buildQuotationConvertUnits } from "@/lib/domains/commercial/quotation-convert-selection";
import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";

test("D1: only approved quotations may convert", () => {
  assert.equal(canCreateCampaignFromQuotation("approved"), true);
  assert.equal(canCreateCampaignFromQuotation("draft"), false);
  assert.equal(canCreateCampaignFromQuotation("sent"), false);
  assert.equal(canCreateCampaignFromQuotation("accepted"), false);
  assert.equal(canCreateCampaignFromQuotation("rejected"), false);
});

test("D3: package creates one convert unit", () => {
  const items = [
    {
      id: "leader",
      influencer_id: "inf-a",
      profile_id: null,
      unified_id: "ua",
      source_shortlist_item_id: null,
      creator_name: "A",
      platform: "instagram",
      handle: "@a",
      followers: 1,
      engagement_rate: 1,
      country_code: "EG",
      profile_image_url: null,
      profile_url: null,
      deliverables: [{ platform: "instagram", type: "reel", quantity: 1 }],
      commercial_input_mode: "cost_revenue",
      cost: 100,
      cost_currency: "EGP",
      revenue: 500,
      gp_pct: 50,
      gp_value: 250,
      fx_rate_to_egp: 1,
      cost_egp: 100,
      revenue_egp: 500,
      gp_value_egp: 250,
      af_pct: 0,
      af_value: 0,
      af_value_egp: 0,
      option_number: 1,
      service_description: null,
      collapse_group_id: "pkg",
      collapse_label: "Pkg",
      sort_order: 1,
    },
    {
      id: "member",
      influencer_id: "inf-b",
      profile_id: null,
      unified_id: "ub",
      source_shortlist_item_id: null,
      creator_name: "B",
      platform: "tiktok",
      handle: "@b",
      followers: 1,
      engagement_rate: 1,
      country_code: "EG",
      profile_image_url: null,
      profile_url: null,
      deliverables: [{ platform: "tiktok", type: "video", quantity: 2 }],
      commercial_input_mode: "cost_revenue",
      cost: 0,
      cost_currency: "EGP",
      revenue: 0,
      gp_pct: 0,
      gp_value: 0,
      fx_rate_to_egp: 1,
      cost_egp: 0,
      revenue_egp: 0,
      gp_value_egp: 0,
      af_pct: 0,
      af_value: 0,
      af_value_egp: 0,
      option_number: 1,
      service_description: null,
      collapse_group_id: "pkg",
      collapse_label: "Pkg",
      sort_order: 2,
    },
  ] as QuotationItemRow[];

  const units = buildQuotationConvertUnits(items);
  assert.equal(units.length, 1);
  assert.equal(units[0]?.kind, "package");
  assert.equal(units[0]?.memberItems.length, 2);
  assert.equal(units[0]?.primaryItem.revenue, 500);
});

test("convert service wires Path A behind feature flag", () => {
  const src = readFileSync(
    join(process.cwd(), "lib/services/quotations/quotation-lifecycle-service.ts"),
    "utf8"
  );
  assert.match(src, /isRelease20AssignmentConvertEnabled/);
  assert.match(src, /convertQuotationToAssignments/);
});

test("Path B uses convertQuotationToAssignments when quote linked", () => {
  const src = readFileSync(
    join(process.cwd(), "lib/services/campaigns/generate-campaign-from-campaign-plan.ts"),
    "utf8"
  );
  assert.match(src, /convertQuotationToAssignments/);
  assert.match(src, /conversion_engine: "convertQuotationToAssignments"/);
});

test("dry-run path exists and creates no writes before dryRun check ordering", () => {
  const src = readFileSync(
    join(process.cwd(), "lib/services/campaigns/convert-quotation-to-assignments.ts"),
    "utf8"
  );
  const dryIdx = src.indexOf("if (input.dryRun)");
  const insertIdx = src.indexOf('from("campaign_commercial_snapshots")');
  const lineIdx = src.indexOf("await createCampaignLine");
  assert.ok(dryIdx > 0);
  assert.ok(insertIdx > dryIdx, "snapshot insert must be after dry-run return");
  assert.ok(lineIdx > dryIdx, "line create must be after dry-run return");
  assert.match(src, /status: "planning"/);
  assert.match(src, /accepted_quotation_id/);
  assert.match(src, /source_quotation_item_id/);
  assert.match(src, /snapshot_hash/);
  assert.match(src, /influencerIdFromUnifiedId/);
  assert.match(src, /No Assignments were created/);
});
