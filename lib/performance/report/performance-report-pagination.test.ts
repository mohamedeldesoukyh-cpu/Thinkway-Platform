import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import puppeteer from "puppeteer-core";
import { PDFDocument } from "pdf-lib";
import type { CampaignPublicationRow } from "@/lib/domains/campaign/types";
import { prepareClientReportHtml } from "./client-report-pdf";
import { PERFORMANCE_REPORT_DESIGN_V2_STYLES } from "./performance-report-design-v2-styles";
import { PERFORMANCE_REPORT_PAGINATION } from "./performance-report-pagination";
import { renderPcard, renderSheet } from "./performance-report-v2-parts";

const chrome = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
test("preview and PDF paginate long captions without clipping, losing text or repeating metrics", { skip: !existsSync(chrome) }, async () => {
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    for (const repeats of [1, 30, 200]) {
      const caption = "Full caption preserved. تفاصيل الحملة وصناعة المحتوى. ".repeat(repeats).trim();
      const cards = [1, 2, 3].map(id => renderPcard({ id: String(id), influencer_name: `Creator ${id}`, platform: "tiktok", platform_label: "TikTok", publication_type: "tiktok_video", caption, total_engagements: 42, engagement_rate: 1 } as CampaignPublicationRow));
      const html = await prepareClientReportHtml(`<html><head><style>${PERFORMANCE_REPORT_DESIGN_V2_STYLES}</style></head><body>${renderSheet({ headLeft: "Performance", body: `<div class="pgrid">${cards.join("")}</div>`, footLeft: "Fixture", pageLabel: "1 / 1", publicationPage: true })}${PERFORMANCE_REPORT_PAGINATION}</body></html>`);
      await page.emulateMediaType("screen");
      await page.setContent(html, { waitUntil: "load" });
      await page.waitForFunction(() => document.documentElement.dataset.performanceReady === "true");
      const layout = await page.evaluate(() => ({
        heights: Array.from(document.querySelectorAll(".sheet")).map(s => s.getBoundingClientRect().height),
        caption: Array.from(document.querySelectorAll(".pcard__cap")).map(p => p.textContent).join(""),
        metrics: document.querySelectorAll(".pcard__foot").length,
      }));
      assert.ok(layout.heights.every(height => height < 1124), JSON.stringify(layout.heights));
      assert.equal(layout.caption, caption.repeat(3));
      assert.equal(layout.metrics, 3);
      await page.emulateMediaType("print");
      const pdf = await PDFDocument.load(await page.pdf({ format: "A4", preferCSSPageSize: true, printBackground: true, scale: 1 }));
      assert.equal(pdf.getPageCount(), layout.heights.length);
      assert.ok(pdf.getPages().every(p => Math.abs(p.getWidth() - 595.28) < 1 && Math.abs(p.getHeight() - 841.89) < 1));
    }
  } finally { await browser.close(); }
});
