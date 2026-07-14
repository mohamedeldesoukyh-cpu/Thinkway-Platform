import { strict as assert } from "node:assert";
import { test } from "node:test";

import { generateMediaPlan } from "@/features/campaign-outputs/generators/media-plan";
import { buildMediaPlanHtml } from "@/features/campaign-outputs/export/media-plan-html";
import { embedMediaPlanContentAvatars } from "@/features/campaign-outputs/export/media-plan-export-avatars";
import { MEDIA_PLAN_PDF_OPTIONS } from "@/features/campaign-outputs/export/media-plan-pdf";
import { MEDIA_PLAN_PAGE } from "@/features/campaign-outputs/export/media-plan-page";
import { buildMediaPlanExportHref } from "@/features/campaign-outputs/components/media-plan-export-actions";
import { buildCampaignObjectFixture } from "@/features/campaign-outputs/output-test-fixture";
import { resolveThinkwayReportLogoSrcsForExport } from "@/lib/reports/document/thinkway-report-logo-embed";
import { renderThinkwayReportLogoHtml } from "@/lib/reports/document/thinkway-report-logo";

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

test("buildMediaPlanHtml renders preview-aligned document layout", () => {
  const content = generateMediaPlan(buildCampaignObjectFixture());
  const html = buildMediaPlanHtml(content);

  assert.ok(html.includes('class="thinkway-report-logo'));
  assert.ok(html.includes('src="/tw-logo-dark.png"'));
  assert.ok(html.includes('src="/tw-logo-light.png"'));
  assert.ok(!html.includes('<p class="cover-brand">Thinkway</p>'));
  assert.ok(!html.includes('<p class="brandmark">Thinkway</p>'));
  assert.ok(html.includes("Thinkway Media Plan"));
  assert.ok(html.includes("Publishing Calendar"));
  assert.ok(html.includes("WEEK 1"));
  assert.ok(html.includes("cost-hero"));
  assert.ok(html.includes('class="stat-box"'));
  assert.ok(html.includes('class="n">'));
  assert.ok(html.includes("Ad Slots</div>"));
  assert.ok(html.includes("calendar-shell"));
  assert.ok(html.includes("calendar-badge"));
  assert.ok(html.includes("weekblock"));
  assert.ok(html.includes("ccard"));
  assert.ok(html.includes("dl-table"));
  assert.ok(html.includes("ops-body"));
  assert.ok(html.includes(".dl-table tbody tr"));
  assert.ok(html.includes("dir=\"auto\""));
  assert.ok(html.includes("stat-row"));
  assert.ok(html.includes(`@page { size: ${MEDIA_PLAN_PAGE.widthIn} ${MEDIA_PLAN_PAGE.heightIn}; margin: 0; }`));
  assert.ok(html.includes(".mp-cover {"));
  assert.ok(html.includes("mp-page--cover"));
  assert.ok(html.includes("mp-page--close"));
  assert.ok(html.includes("Let's bring it to life."));
  assert.ok(html.includes("prepared exclusively for"));
  assert.ok(html.includes("break-after: page"));
  assert.ok(html.includes("padding-top: 20px"));
  assert.ok(html.includes("padding-left: 24px"));
  assert.ok(html.includes("--rule:"));
  assert.ok(!html.includes('heading">Campaign Cost'));
  assert.ok(!html.includes("pg-footer"));
  const calendarEnd = html.indexOf("</section>", html.indexOf("mp-section--calendar"));
  const afterCalendar = html.slice(calendarEnd, calendarEnd + 120);
  assert.ok(!afterCalendar.includes("mp-page-break"), "calendar should not be followed by a page break before operations");
});

test("MEDIA_PLAN_PDF_OPTIONS uses zero margins and 1280 viewport", () => {
  assert.equal(MEDIA_PLAN_PDF_OPTIONS.margin.top, "0mm");
  assert.equal(MEDIA_PLAN_PDF_OPTIONS.width, MEDIA_PLAN_PAGE.widthIn);
  assert.equal(MEDIA_PLAN_PDF_OPTIONS.height, MEDIA_PLAN_PAGE.heightIn);
  assert.equal(MEDIA_PLAN_PDF_OPTIONS.viewport?.width, 1280);
  assert.equal(MEDIA_PLAN_PDF_OPTIONS.viewport?.height, 780);
});

test("embedMediaPlanContentAvatars inlines calendar and deadline avatars for PDF", async () => {
  const content = generateMediaPlan(buildCampaignObjectFixture());
  const dataUri = "data:image/jpeg;base64,ZmFrZWF2YXRhcg==";
  const remote = "https://cdn.example/avatar.jpg";

  content.data.weeks[0]!.days[0]!.avatarUrl = remote;
  content.data.weeks[0]!.days[0]!.profileUrl = "https://www.instagram.com/nour/";
  if (content.data.deadlines[0]) {
    content.data.deadlines[0].avatarUrl = dataUri;
  }

  const embedded = await embedMediaPlanContentAvatars(content);
  const monday = embedded.data.weeks[0]!.days[0]!;
  assert.equal(monday.avatarUrl, undefined, "unfetchable remote URL falls back to initials");

  const deadline = embedded.data.deadlines[0];
  if (deadline) {
    assert.ok(
      deadline.avatarUrl?.startsWith("data:image/jpeg;base64,"),
      "existing data URI avatars are preserved for PDF"
    );
  }

  const html = buildMediaPlanHtml(embedded);
  assert.ok(html.includes("data:image/jpeg;base64,"));
  assert.ok(!html.includes(`src="${remote}"`), "remote CDN URLs must not appear in PDF HTML");
});

test("buildMediaPlanHtml renders legal entity on cover and prepared-for close page", () => {
  const content = generateMediaPlan(buildCampaignObjectFixture());
  content.data.campaignContext = {
    clientName: "Dolphin Foods LLC",
    brandName: "Dolphin Tuna",
    groupName: "Food Group",
  };

  const html = buildMediaPlanHtml(content);

  assert.ok(html.includes("Legal entity"));
  assert.ok(html.includes("Dolphin Foods LLC"));
  assert.ok(html.includes("prepared exclusively for Dolphin Tuna (Dolphin Foods LLC)"));
});

test("buildMediaPlanHtml embeds Thinkway logo data URIs for PDF export", () => {
  const content = generateMediaPlan(buildCampaignObjectFixture());
  const logoSrcs = resolveThinkwayReportLogoSrcsForExport();
  const html = buildMediaPlanHtml(content, { logoSrcs });

  assert.ok(logoSrcs.logoDarkSrc.startsWith("data:image/png;base64,"));
  assert.ok(logoSrcs.logoLightSrc.startsWith("data:image/png;base64,"));
  assert.ok(html.includes(logoSrcs.logoDarkSrc));
  assert.ok(html.includes(logoSrcs.logoLightSrc));
  assert.ok(!html.includes('src="/tw-logo-dark.png"'));
});

test("renderThinkwayReportLogoHtml falls back to CSS wordmark when src missing", () => {
  const html = renderThinkwayReportLogoHtml({
    logoDarkSrc: "",
    logoLightSrc: "",
    showText: true,
  });

  assert.ok(html.includes("thinkway-report-logo-text"));
  assert.ok(html.includes("THINK<span>WAY</span>"));
});
