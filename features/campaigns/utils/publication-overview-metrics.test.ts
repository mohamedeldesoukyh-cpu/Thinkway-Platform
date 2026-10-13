import assert from "node:assert/strict";
import { test } from "node:test";
import type { CampaignPublicationRow } from "@/lib/domains/campaign/types";
import { publicationOverviewMetrics } from "./publication-overview-metrics";

const row = (values: Partial<CampaignPublicationRow>) => values as CampaignPublicationRow;

test("missing plays remain unavailable rather than becoming a recorded zero", () => {
  assert.deepEqual(publicationOverviewMetrics([row({plays:null,views:null}),row({plays:null,views:null})]),{plays:null,missingMetrics:2});
});
test("a recorded zero is a metric and plays aggregate independently of views", () => {
  assert.deepEqual(publicationOverviewMetrics([row({plays:0}),row({plays:20,views:100}),row({plays:30,views:200})]),{plays:50,missingMetrics:0});
});
test("invalid numeric values cannot contaminate the display totals", () => {
  assert.deepEqual(publicationOverviewMetrics([row({plays:NaN,views:Infinity}),row({plays:10})]),{plays:10,missingMetrics:1});
});
