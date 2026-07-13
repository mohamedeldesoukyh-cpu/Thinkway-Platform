import { strict as assert } from "node:assert";
import { test } from "node:test";

import { generateMediaPlan } from "@/features/campaign-outputs/generators/media-plan";
import { buildMediaPlanHtml } from "@/features/campaign-outputs/export/media-plan-html";
import { buildMediaPlanExportHref } from "@/features/campaign-outputs/components/media-plan-export-actions";
import { buildCampaignObjectFixture } from "@/features/campaign-outputs/output-test-fixture";

test("buildMediaPlanExportHref includes kind, format, and conversation", () => {
  const href = buildMediaPlanExportHref("obj-123", "pdf", {
    conversationId: "conv-456",
  });
  assert.ok(href.includes("/api/ai/campaign-objects/obj-123/outputs/export"));
  assert.ok(href.includes("kind=media_plan"));
  assert.ok(href.includes("format=pdf"));
  assert.ok(href.includes("conversationId=conv-456"));
  assert.ok(href.includes("download=1"));
});

test("buildMediaPlanHtml renders calendar, context, and Thinkway branding", () => {
  const content = generateMediaPlan(buildCampaignObjectFixture());
  const html = buildMediaPlanHtml(content);

  assert.ok(html.includes("Thinkway"));
  assert.ok(html.includes("Publishing Calendar"));
  assert.ok(html.includes("Week 1"));
  assert.ok(html.includes("@page"));
});
