import { strict as assert } from "node:assert";
import { test } from "node:test";

import { generateMediaPlan } from "@/features/campaign-outputs/generators/media-plan";
import { buildMediaPlanHtml, buildMediaPlanPreviewHtmlDocument, buildMediaPlanStyles, extractMediaPlanPageSignatures } from "@/features/campaign-outputs/export/media-plan-html";
import { embedMediaPlanContentAvatars } from "@/features/campaign-outputs/export/media-plan-export-avatars";
import { mediaPlanExportBaseName } from "@/features/campaign-outputs/export/media-plan-export-utils";
import { MEDIA_PLAN_PDF_OPTIONS } from "@/features/campaign-outputs/export/media-plan-pdf";
import { buildMediaPlanPptxBuffer, MEDIA_PLAN_PPTX_PAGE } from "@/features/campaign-outputs/export/media-plan-pptx";
import { MEDIA_PLAN_PAGE } from "@/features/campaign-outputs/export/media-plan-page";
import { buildMediaPlanExportHref } from "@/features/campaign-outputs/components/media-plan-export-actions";
import { buildCampaignObjectFixture } from "@/features/campaign-outputs/output-test-fixture";
import {
  defaultMediaPlanPresentation,
  resolveExportPresentation,
} from "@/features/campaign-outputs/media-plan-presentation";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";
import { resolveThinkwayReportLogoSrcsForExport } from "@/lib/reports/document/thinkway-report-logo-embed";
import { renderThinkwayReportLogoHtml } from "@/lib/reports/document/thinkway-report-logo";
import type { MediaPlanData } from "@/features/campaign-outputs/generators/media-plan";

function mediaPlanData(content: ReturnType<typeof generateMediaPlan>): MediaPlanData {
  assert.ok(content.data);
  return content.data as MediaPlanData;
}

test("buildMediaPlanExportHref includes pptx format", () => {
  const href = buildMediaPlanExportHref("obj-123", "pptx");
  assert.ok(href.includes("format=pptx"));
});

test("buildMediaPlanPptxBuffer produces a valid PPTX archive", async () => {
  const content = generateMediaPlan(buildCampaignObjectFixture());
  const buffer = await buildMediaPlanPptxBuffer(content);
  assert.ok(buffer.length > 5_000, "PPTX buffer should be non-trivial");
  assert.equal(buffer[0], 0x50);
  assert.equal(buffer[1], 0x4b);
});

test("MEDIA_PLAN_PPTX_PAGE matches landscape media plan dimensions", () => {
  assert.equal(MEDIA_PLAN_PPTX_PAGE.width, 13.333);
  assert.equal(MEDIA_PLAN_PPTX_PAGE.height, 8.125);
  assert.equal(MEDIA_PLAN_PPTX_PAGE.widthIn, MEDIA_PLAN_PAGE.widthIn);
  assert.equal(MEDIA_PLAN_PPTX_PAGE.heightIn, MEDIA_PLAN_PAGE.heightIn);
});

test("buildMediaPlanPptxBuffer embeds creator avatars from data URI", async () => {
  const content = generateMediaPlan(buildCampaignObjectFixture());
  const tinyPng =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  mediaPlanData(content).weeks[0]!.days[0]!.avatarUrl = tinyPng;

  const buffer = await buildMediaPlanPptxBuffer(content);
  assert.ok(buffer.length > 5_000);
});

test("mediaPlanExportBaseName produces a safe download slug", () => {
  const content = generateMediaPlan(buildCampaignObjectFixture());
  const baseName = mediaPlanExportBaseName(content);
  assert.match(baseName, /-media-plan$/);
  assert.ok(!baseName.includes(" "));
});

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

test("buildMediaPlanPreviewHtmlDocument scales pages to viewport for in-app preview", () => {
  const content = generateMediaPlan(buildCampaignObjectFixture());
  const html = buildMediaPlanPreviewHtmlDocument(content);

  assert.match(html, /transform:\s*scale\(calc\(100vw\s*\/\s*1280\)\)/);
  assert.match(html, /border-radius:\s*14px/);
  assert.match(html, /<!DOCTYPE html>/);
  assert.match(html, /class="page cover"/);
  assert.match(html, /class="page calendar-preview-page"/);
  assert.ok(!html.includes('class="page calendar-page"'), "preview should not split calendar into per-week pages");
  assert.ok(!html.includes("min-height:860px"), "preview calendar should not use fixed week page height");
});

test("buildMediaPlanPreviewHtmlDocument proxies avatars and links creator profiles", () => {
  const content = generateMediaPlan(buildCampaignObjectFixture());
  const data = mediaPlanData(content);
  const day =
    data.weeks.flatMap((week) => week.days).find((entry) => entry.creator) ??
    data.weeks[0]!.days[0]!;
  day.avatarUrl =
    "https://scontent.cdninstagram.com/v/t51.2885-19/example.jpg?stp=dst-jpg_s150x150";
  day.profileUrl = "https://www.instagram.com/nour/";

  const html = buildMediaPlanPreviewHtmlDocument(content);

  assert.ok(html.includes("/api/creators/avatar?"), "preview should proxy avatar src");
  assert.ok(html.includes('class="cav-link"'), "avatar should be wrapped in profile link");
  assert.ok(html.includes("https://www.instagram.com/nour/"), "profile href should be embedded");
});

test("buildMediaPlanPreviewHtmlDocument renders deadline avatars with profile links", () => {
  const content = generateMediaPlan(buildCampaignObjectFixture());
  const data = mediaPlanData(content);
  const deadline = data.deadlines[0];
  assert.ok(deadline, "fixture should include deadlines");
  deadline.avatarUrl =
    "https://scontent.cdninstagram.com/v/t51.2885-19/example.jpg?stp=dst-jpg_s150x150";
  deadline.profileUrl = "https://www.instagram.com/nour/";

  const html = buildMediaPlanPreviewHtmlDocument(content);

  assert.ok(html.includes('class="dl-creator"'), "deadlines table should render creator avatars");
  assert.ok(html.includes('class="cav-link"'), "deadline avatars should link to profiles");
});

test("buildMediaPlanPreviewHtmlDocument keeps mirrors on the primary card only", () => {
  const obj = buildCampaignObjectFixture({
    facts: { durationWeeks: 4 },
    creators: [{ id: "cr_star", name: "Nour Star", tier: "Celebrity" }],
  });
  const creatorsData = obj.sections.creators?.data as CreatorsSectionData;
  const reasoning = creatorsData.recommendations?.selectedReasoning ?? [];
  if (reasoning[0]) {
    reasoning[0].serviceTypes = ["1× IG Reel", "1× IG Set of stories", "1× Mirrored IG"];
    reasoning[0].serviceLabel = reasoning[0].serviceTypes.join(" · ");
  }
  obj.meta.mediaPlanSchedule = { weekWeights: [70, 10, 10, 10] };

  const content = generateMediaPlan(obj);
  const html = buildMediaPlanPreviewHtmlDocument(content);

  const nourIdx = html.indexOf("Nour Star");
  assert.ok(nourIdx >= 0, "expected Nour Star on the publishing calendar");
  const bodyStart = html.lastIndexOf("daycol-body", nourIdx);
  const nextDaycol = html.indexOf('<div class="daycol">', nourIdx + 1);
  const daySlice = html.slice(bodyStart, nextDaycol > 0 ? nextDaycol : nourIdx + 1200);

  assert.equal(
    (daySlice.match(/class="ccard"/g) ?? []).length,
    1,
    "mirrors must not spawn a second creator card"
  );
  assert.ok(
    daySlice.includes("(Mirror)") || daySlice.includes("Mirrored IG"),
    "mirror deliverable should appear on the primary card chips"
  );
});

test("buildMediaPlanHtml renders equal-width weekly objective cards with weight bars", () => {
  const obj = buildCampaignObjectFixture({
    facts: { durationWeeks: 4 },
    creators: Array.from({ length: 8 }, (_, index) => ({
      id: `cr_${index}`,
      name: `Creator ${index + 1}`,
      tier: index < 2 ? "Macro" : "Mid",
      serviceTypes: ["1× TT Video"],
    })),
  });
  obj.meta.mediaPlanSchedule = { weekWeights: [70, 10, 10, 10] };

  const content = generateMediaPlan(obj);
  const html = buildMediaPlanHtml(content, {
    presentation: defaultMediaPlanPresentation("strategy"),
  });

  assert.ok(html.includes('class="obj-row"'), "weekly objectives should use flex row");
  assert.ok(html.includes("flex:1 1 0"), "weekly objective cards should use equal flex basis");
  assert.ok(html.includes('class="obj-weight-bar"'), "cards should include internal weight indicator");
  assert.ok(!html.includes("flex:70 1 0"), "cards must not use extreme proportional flex grow");
  assert.ok(!html.includes('class="strat-row cols-4"'), "weekly objectives must not use equal-width grid");
});

test("buildMediaPlanStyles applies rounded page corners for PDF print output", () => {
  const styles = buildMediaPlanStyles();
  assert.match(styles, /@media print[\s\S]*background:\s*#e5e7eb/);
  assert.match(styles, /@media print[\s\S]*border-radius:\s*14px/);
});

test("buildMediaPlanHtml standard export matches preview multi-week calendar", () => {
  const content = generateMediaPlan(buildCampaignObjectFixture());
  const presentation = defaultMediaPlanPresentation("standard");

  const previewHtml = buildMediaPlanPreviewHtmlDocument(content, { presentation });
  const exportHtml = buildMediaPlanHtml(content, { presentation });

  const previewPages = extractMediaPlanPageSignatures(previewHtml);
  const exportPages = extractMediaPlanPageSignatures(exportHtml);

  assert.ok(
    previewPages.some((page) => page.includes("calendar-preview-page")),
    "in-app preview keeps one multi-week calendar page"
  );
  assert.ok(
    exportPages.some((page) => page.includes("calendar-preview-page")),
    "download must match preview — one multi-week calendar slide"
  );
  assert.ok(
    !exportPages.some((page) => page.includes("calendar-page") && !page.includes("calendar-preview")),
    "standard download must not split calendar into per-week pages"
  );
  assert.equal(
    (exportHtml.match(/class="page calendar-preview-page"/g) ?? []).length,
    1,
    "exactly one calendar slide with all weeks"
  );
  assert.match(exportHtml, /@page calendarpreview \{ size: 1280px \d+px/);
});

test("standard export via resolveExportPresentation keeps preview calendar", () => {
  const obj = buildCampaignObjectFixture({ facts: { durationWeeks: 4 } });
  obj.meta.mediaPlanPresentation = defaultMediaPlanPresentation("standard");
  const content = generateMediaPlan(obj);

  const exportHtml = buildMediaPlanHtml(content, {
    presentation: resolveExportPresentation(obj, { mode: "standard", view: "client" }),
  });

  assert.equal((exportHtml.match(/class="page calendar-preview-page"/g) ?? []).length, 1);
  assert.ok(!exportHtml.includes('class="page calendar-page"'));
});

test("buildMediaPlanHtml calendar-and-deliverables export hides campaign cost", () => {
  const content = generateMediaPlan(buildCampaignObjectFixture());
  const withCost = buildMediaPlanHtml(content, {
    presentation: {
      ...defaultMediaPlanPresentation("standard"),
      view: "client",
      includeCampaignCost: true,
    },
  });
  const withoutCost = buildMediaPlanHtml(content, {
    presentation: {
      ...defaultMediaPlanPresentation("standard"),
      view: "client",
      includeCampaignCost: false,
    },
  });

  assert.ok(withCost.includes('class="cost-hero"'));
  assert.ok(!withoutCost.includes('class="cost-hero"'));
  assert.ok(!withoutCost.includes('<div class="lbl">Campaign Cost</div>'));
  assert.ok(withoutCost.includes("Publishing Calendar"));
});

test("buildMediaPlanHtml uses Saturday–Friday column headers (18/7/2026 is Saturday)", () => {
  const content = generateMediaPlan(
    buildCampaignObjectFixture({
      facts: { durationWeeks: 2, campaignStartDate: "2026-07-24" },
    })
  );
  const html = buildMediaPlanHtml(content);
  // Week 1 grid opens Sat 18/7 — must not label that column Monday.
  assert.match(html, /class="dname"[^>]*>\s*Sat\s*</i);
  assert.match(html, /class="ddate"[^>]*>\s*18\/7\/26\s*</i);
  assert.doesNotMatch(
    html,
    /class="dname"[^>]*>\s*Mon\s*<\/[^>]*>[\s\S]{0,80}class="ddate"[^>]*>\s*18\/7\/26/i
  );
});

test("buildMediaPlanHtml renders EMediaPlan document layout with preview calendar for download", () => {
  const content = generateMediaPlan(buildCampaignObjectFixture());
  const html = buildMediaPlanHtml(content);

  assert.ok(html.includes('class="thinkway-report-logo'));
  assert.ok(html.includes('src="/tw-logo-dark.png"'));
  assert.ok(html.includes('src="/tw-logo-light.png"'));
  assert.ok(!html.includes('<p class="cover-brand">Thinkway</p>'));
  assert.ok(!html.includes('<p class="brandmark">Thinkway</p>'));
  assert.ok(html.includes("Thinkway Media Plan"));
  assert.ok(html.includes("Publishing Calendar"));
  assert.ok(html.includes("Week 1"));
  assert.ok(!html.includes("WEEK 1"));
  assert.ok(html.includes("cost-hero"));
  assert.ok(html.includes('class="stat-box"'));
  assert.ok(html.includes('class="n">'));
  assert.ok(html.includes("Ad Slots</div>"));
  assert.ok(html.includes("pg-header"));
  assert.ok(html.includes("pg-footer"));
  assert.ok(html.includes("strat-card"));
  assert.ok(html.includes("cal-body"));
  assert.ok(html.includes("wave-row"));
  assert.ok(html.includes("weekblock"));
  assert.ok(html.includes("ccard"));
  assert.ok(html.includes("cchips"));
  assert.ok(html.includes("dname"));
  assert.ok(html.includes("ddate"));
  assert.ok(html.includes("dl-table"));
  assert.ok(html.includes("dl-creator"));
  assert.ok(html.includes("ops-body"));
  assert.ok(html.includes("table.dl-table tbody tr:nth-child(even)"));
  assert.ok(html.includes("table-layout:fixed"));
  assert.ok(html.includes("overflow-wrap:anywhere"));
  assert.ok(html.includes("dir=\"auto\""));
  assert.ok(html.includes("stat-row"));
  assert.ok(html.includes("@page { size: 1280px 780px; margin: 0; }"));
  assert.ok(html.includes("@page calendarpage { size: 1280px 860px; margin: 0; }"));
  assert.ok(html.includes('class="page cover"'));
  assert.ok(html.includes('class="page close"'));
  assert.ok(html.includes("Let's bring it to life."));
  assert.ok(html.includes("prepared exclusively for"));
  assert.ok(html.includes("page-break-after: always"));
  assert.ok(!html.includes("mp-section"));
  assert.ok(!html.includes("section-header"));
  assert.ok(!html.includes("calendar-shell"));
  assert.ok(!html.includes('heading">Campaign Cost'));
  assert.ok(html.includes('class="page calendar-preview-page"'));
  assert.ok(!html.includes('class="page calendar-page"'));
  assert.match(html, /@page calendarpreview \{ size: 1280px \d+px/);

  const pageCount = (html.match(/<div class="page[\s"]/g) ?? []).length;
  const strategyBodyPages = (html.match(/class="strat-body"/g) ?? []).length;
  const expectedPages = 1 + strategyBodyPages + 1 + 3; // cover + strategy + 1 calendar + ops + deadlines + close
  assert.equal(
    pageCount,
    expectedPages,
    "standard media plan download should render cover + strategy + one calendar slide + ops + deadlines + close"
  );
  assert.ok(
    !html.includes("Platform &amp; Creator Intelligence"),
    "strategy blocks should pack together instead of a sparse platform-only page"
  );
});

test("buildMediaPlanHtml strategy export keeps per-week calendar pages", () => {
  const content = generateMediaPlan(buildCampaignObjectFixture());
  const html = buildMediaPlanHtml(content, {
    presentation: defaultMediaPlanPresentation("strategy"),
  });
  const data = mediaPlanData(content);

  assert.ok(html.includes('class="page calendar-page"'));
  assert.ok(!html.includes('class="page calendar-preview-page"'));
  assert.ok(html.includes("height: 860px"));

  const pageCount = (html.match(/<div class="page[\s"]/g) ?? []).length;
  const creativeDirectionPages = (html.match(/<div class="page creative-direction-page"/g) ?? []).length;
  const strategyBodyPages = (html.match(/class="strat-body"/g) ?? []).length;
  const expectedPages = 1 + strategyBodyPages + data.weeks.length + 3;
  assert.equal(pageCount, expectedPages);
  assert.ok(creativeDirectionPages >= 0);
});

test("buildMediaPlanHtml renders Creator Mix Intelligence full-width without column clipping", () => {
  const obj = buildCampaignObjectFixture({
    facts: { durationWeeks: 4 },
    creators: Array.from({ length: 8 }, (_, index) => ({
      id: `cr_${index}`,
      name: `Creator ${index + 1}`,
      tier: index < 2 ? "Macro" : index < 5 ? "Mid" : "Micro",
      serviceTypes: ["1× TT Video"],
    })),
  });
  obj.meta.mediaPlanSchedule = { weekWeights: [70, 10, 10, 10] };

  const content = generateMediaPlan(obj);
  const html = buildMediaPlanHtml(content, {
    presentation: defaultMediaPlanPresentation("strategy"),
  });

  assert.ok(html.includes("Creator Mix Intelligence"), "strategy export should include creator mix");
  assert.ok(html.includes("strat-card-tier-mix"), "creator mix card should opt out of column max-height");
  assert.ok(html.includes("max-height:calc(780px - 118px)"), "strategy body should reserve header/footer space");

  const mixIdx = html.indexOf("Creator Mix Intelligence");
  assert.ok(mixIdx >= 0);
  const nearby = html.slice(mixIdx, mixIdx + 3000);
  assert.ok(!nearby.includes("cols-2"), "creator mix should render full-width, not in a two-column row");
  assert.ok(nearby.includes("tier-row"), "creator mix should include tier stat boxes");
  assert.ok(nearby.includes("strat-body-text"), "creator mix should include rationale body text");
});

test("MEDIA_PLAN_PDF_OPTIONS uses zero margins and 1280 viewport", () => {
  assert.equal(MEDIA_PLAN_PDF_OPTIONS.margin.top, "0mm");
  assert.equal(MEDIA_PLAN_PDF_OPTIONS.width, MEDIA_PLAN_PAGE.widthIn);
  assert.equal(MEDIA_PLAN_PDF_OPTIONS.height, MEDIA_PLAN_PAGE.heightIn);
  assert.equal(MEDIA_PLAN_PDF_OPTIONS.viewport?.width, 1280);
  assert.equal(MEDIA_PLAN_PDF_OPTIONS.viewport?.height, 780);
  assert.equal(
    MEDIA_PLAN_PDF_OPTIONS.sizeAutoHeightPages?.selector,
    ".page.calendar-preview-page, .page.deadlines-preview-page"
  );
  assert.equal(MEDIA_PLAN_PDF_OPTIONS.sizeAutoHeightPages?.widthPx, 1280);
});

test("embedMediaPlanContentAvatars inlines calendar and deadline avatars for PDF", async () => {
  const content = generateMediaPlan(buildCampaignObjectFixture());
  const data = mediaPlanData(content);
  const dataUri = "data:image/jpeg;base64,ZmFrZWF2YXRhcg==";
  const remote = "https://cdn.example/avatar.jpg";

  data.weeks[0]!.days[0]!.avatarUrl = remote;
  data.weeks[0]!.days[0]!.profileUrl = "https://www.instagram.com/nour/";
  if (data.deadlines[0]) {
    data.deadlines[0].avatarUrl = dataUri;
  }

  const embedded = await embedMediaPlanContentAvatars(content);
  const embeddedData = mediaPlanData(embedded);
  const monday = embeddedData.weeks[0]!.days[0]!;
  assert.equal(monday.avatarUrl, undefined, "unfetchable remote URL falls back to initials");

  const deadline = embeddedData.deadlines[0];
  if (deadline) {
    assert.ok(
      deadline.avatarUrl?.startsWith("data:image/jpeg;base64,"),
      "existing data URI avatars are preserved for PDF"
    );
  }

  const html = buildMediaPlanHtml(embedded);
  assert.ok(!html.includes(`src="${remote}"`), "remote CDN URLs must not appear in PDF HTML");
  assert.ok(html.includes('class="dl-creator"'), "deadlines table should render creator avatars");
  assert.ok(html.includes('class="cav-link"'), "embedded export HTML should link avatars to profiles");
  assert.ok(html.includes("https://www.instagram.com/nour/"));
});

test("embedMediaPlanContentAvatars inlines Thinkway storage avatars for PDF", async () => {
  const content = generateMediaPlan(buildCampaignObjectFixture());
  const data = mediaPlanData(content);
  const storageUrl =
    "https://example.supabase.co/storage/v1/object/public/creator-avatars/enrichment/inf/instagram/creator.jpg";
  // Minimal JPEG (1x1)
  const jpeg = Buffer.from(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z",
    "base64"
  );

  data.weeks[0]!.days[0]!.avatarUrl = storageUrl;
  data.weeks[0]!.days[0]!.profileUrl = "https://www.instagram.com/creator/";

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("creator-avatars")) {
      return new Response(jpeg, {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      });
    }
    return new Response(null, { status: 404 });
  }) as typeof fetch;

  try {
    const embedded = await embedMediaPlanContentAvatars(content);
    const monday = mediaPlanData(embedded).weeks[0]!.days[0]!;
    assert.ok(
      monday.avatarUrl?.startsWith("data:image/"),
      "Thinkway storage avatars must inline as data URIs for PDF"
    );
    const html = buildMediaPlanHtml(embedded);
    assert.ok(html.includes('src="data:image/'), "export HTML should render inlined avatar images");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("buildMediaPlanHtml renders legal entity on cover and prepared-for close page", () => {
  const content = generateMediaPlan(buildCampaignObjectFixture());
  mediaPlanData(content).campaignContext = {
    clientName: "Dolphin Foods LLC",
    brandName: "Dolphin Tuna",
    groupName: "Food Group",
  };

  const html = buildMediaPlanHtml(content);

  assert.ok(html.includes("Legal Entity"));
  assert.ok(html.includes("Dolphin Foods LLC"));
  assert.ok(html.includes("prepared exclusively for Dolphin Tuna (Dolphin Foods LLC)"));
});

test("buildMediaPlanHtml embeds Thinkway logo data URIs for PDF export", () => {
  const content = generateMediaPlan(buildCampaignObjectFixture());
  const logoSrcs = resolveThinkwayReportLogoSrcsForExport();
  const html = buildMediaPlanHtml(content, { logoSrcs });

  assert.ok(logoSrcs.logoDarkSrc?.startsWith("data:image/png;base64,"));
  assert.ok(logoSrcs.logoLightSrc?.startsWith("data:image/png;base64,"));
  assert.ok(logoSrcs.logoDarkSrc && html.includes(logoSrcs.logoDarkSrc));
  assert.ok(logoSrcs.logoLightSrc && html.includes(logoSrcs.logoLightSrc));
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

test("buildMediaPlanHtml omits hidden sections and reflows pagination", () => {
  const obj = buildCampaignObjectFixture({
    facts: { durationWeeks: 4 },
    creators: Array.from({ length: 8 }, (_, index) => ({
      id: `cr_${index}`,
      name: `Creator ${index + 1}`,
      tier: index < 2 ? "Macro" : "Mid",
      serviceTypes: ["1× TT Video"],
    })),
  });
  obj.meta.mediaPlanSchedule = { weekWeights: [70, 10, 10, 10] };

  const content = generateMediaPlan(obj);
  const fullHtml = buildMediaPlanHtml(content, {
    presentation: defaultMediaPlanPresentation("strategy"),
  });
  const hiddenHtml = buildMediaPlanHtml(content, {
    presentation: {
      ...defaultMediaPlanPresentation("strategy"),
      sections: {
        ...defaultMediaPlanPresentation("strategy").sections,
        platformIntelligence: false,
        weeklyObjectives: false,
        publishingCalendar: false,
      },
    },
  });

  assert.ok(fullHtml.includes("Platform Intelligence"));
  assert.ok(fullHtml.includes("Weekly Objectives"));
  assert.ok(fullHtml.includes("Publishing Calendar"));
  assert.ok(!hiddenHtml.includes("Platform Intelligence"));
  assert.ok(!hiddenHtml.includes("Weekly Objectives"));
  assert.ok(!hiddenHtml.includes("Publishing Calendar"));

  const fullPages = (fullHtml.match(/<div class="page[\s"]/g) ?? []).length;
  const hiddenPages = (hiddenHtml.match(/<div class="page[\s"]/g) ?? []).length;
  assert.ok(hiddenPages < fullPages, "hidden sections should reduce total page count");
});

test("buildMediaPlanHtml export never includes section visibility toggles", () => {
  const content = generateMediaPlan(buildCampaignObjectFixture());
  const html = buildMediaPlanHtml(content, {
    presentation: defaultMediaPlanPresentation("strategy"),
  });

  assert.ok(!html.includes('class="mp-sec-toggle"'));
  assert.ok(!html.includes('data-mp-section="'));
});

test("buildMediaPlanPreviewHtmlDocument includes toggles only when requested", () => {
  const content = generateMediaPlan(buildCampaignObjectFixture());
  const withToggles = buildMediaPlanPreviewHtmlDocument(content, {
    presentation: defaultMediaPlanPresentation("strategy"),
    showSectionToggles: true,
  });
  const withoutToggles = buildMediaPlanPreviewHtmlDocument(content, {
    presentation: defaultMediaPlanPresentation("strategy"),
    showSectionToggles: false,
  });

  assert.ok(withToggles.includes('class="mp-sec-toggle"'));
  assert.ok(withToggles.includes('data-mp-section="'));
  assert.ok(!withoutToggles.includes('class="mp-sec-toggle"'));
});

test("media plan avatar embed uses original bytes", async () => {
  const { readFileSync } = await import("node:fs");
  const { dirname, join } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "media-plan-export-avatars.ts"),
    "utf8"
  );
  assert.match(source, /toUnprocessedImageDataUri/);
  assert.doesNotMatch(
    source,
    /toCompressedExportDataUri|compressExportDataUri|MEDIA_PLAN_AVATAR_COMPRESS/
  );
});
