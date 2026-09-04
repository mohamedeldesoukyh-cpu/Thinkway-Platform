/**
 * Page 4b acceptance — Overlay B (selection bar) + Overlay C (calculator).
 * Live crawl: selection bar visible + calculator open on pack quotation page.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

import { assertClassCoverage } from "../lib/discovery/suite/class-coverage";
import {
  buildQuotationCalcPreview,
  quotationCalcNewClient,
  sumQuotationCalcPreview,
} from "../lib/quotations/quotation-pricing-calculator";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PACK = path.join(ROOT, "docs/architecture/discovery.html");
const BAR_SRC = fs.readFileSync(
  path.join(ROOT, "features/quotations/components/quotation-selection-bar.tsx"),
  "utf8"
);
const CALC_SRC = fs.readFileSync(
  path.join(
    ROOT,
    "features/quotations/components/quotation-pricing-calculator-panel.tsx"
  ),
  "utf8"
);
const WS_SRC = fs.readFileSync(
  path.join(ROOT, "features/quotations/components/quotation-workspace.tsx"),
  "utf8"
);
const GRID_SRC = fs.readFileSync(
  path.join(ROOT, "features/quotations/components/quotation-lines-grid.tsx"),
  "utf8"
);
const CSS = fs.readFileSync(path.join(ROOT, "app/styles/discovery.css"), "utf8");

console.log("04-quotation-detail 4b (selbar + calculator)…");

// Overlay B — fixed selbar
assert.ok(BAR_SRC.includes('className="tw-selbar"') || BAR_SRC.includes("tw-selbar"));
assert.ok(CSS.includes("position:fixed") && CSS.includes(".tw-selbar"));
assert.ok(CSS.includes("bottom:20px") && CSS.includes("translateX(-50%)"));
assert.ok(BAR_SRC.includes("Base cost") && BAR_SRC.includes("Client cost"));
assert.ok(BAR_SRC.includes("Calculator"));
assert.ok(WS_SRC.includes("QuotationSelectionBar"));
assert.ok(WS_SRC.includes("clearSelection") || WS_SRC.includes("setCalculatorOpen(false)"));

// Real set selection — no hardcoded checked
assert.ok(GRID_SRC.includes("checked={selected}"));
assert.ok(!GRID_SRC.includes("checked={true}"));
assert.ok(WS_SRC.includes("selectedIds.size === 0") && WS_SRC.includes("setCalculatorOpen(false)"));

// Overlay C — calculator logic + UI
assert.equal(quotationCalcNewClient(200000, "gpm", 100), 200000);
assert.ok(Number.isFinite(quotationCalcNewClient(1, "gpm", 100)));
const priced = buildQuotationCalcPreview(
  [
    { id: "1", name: "a", handle: "a", optionNumber: 1, baseCost: 0, clientNow: 0 },
    {
      id: "2",
      name: "b",
      handle: "b",
      optionNumber: 1,
      baseCost: 450000,
      clientNow: 450000,
    },
  ],
  "price",
  300000,
  14
);
assert.ok(priced.every((r) => r.newClient === 300000));
assert.equal(priced[1]!.belowCost, true);
const totals = sumQuotationCalcPreview(priced);
assert.ok(totals.hasBelowCost);
assert.ok(CALC_SRC.includes("Client pays"));
assert.ok(CALC_SRC.includes("client = cost ÷ (1 − margin%)") || CALC_SRC.includes("formula"));
assert.ok(CALC_SRC.includes("applyBlocked") || CALC_SRC.includes("hasBelowCost"));
assert.ok(CALC_SRC.includes("A margin of 100%") || CALC_SRC.includes("cannot be solved"));
assert.ok(CALC_SRC.includes("same") && CALC_SRC.includes("figure"));
assert.ok(WS_SRC.includes("QuotationPricingCalculatorPanel"));

function chrome() {
  for (const p of [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean) as string[]) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function liveCrawl() {
  const executablePath = chrome();
  if (!executablePath) {
    console.warn("No Chrome/Edge — skipping live crawl");
    return { skipped: true as const, results: [] as Array<{ state: string; ok: boolean; missing: string[]; used: number }> };
  }

  const html = fs.readFileSync(PACK, "utf8");
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 20_000 });

  await page.evaluate(() => {
    // @ts-expect-error pack globals
    if (typeof go === "function") go("quotation");
    else {
      // @ts-expect-error pack globals
      PG = "quotation";
      // @ts-expect-error pack globals
      draw();
    }
  });

  const results: Array<{ state: string; ok: boolean; missing: string[]; used: number }> = [];

  async function capture(state: string) {
    const body = await page.evaluate(() => document.body.innerHTML);
    const coverage = assertClassCoverage(`<div class="discovery-suite">${body}</div>`);
    results.push({
      state,
      ok: coverage.ok,
      missing: coverage.missing,
      used: coverage.used.length,
    });
  }

  // Select all lines → selbar visible
  await page.evaluate(() => {
    // @ts-expect-error pack globals
    qall(true);
  });
  await page.waitForSelector(".tw-selbar", { timeout: 5000 });
  const selbarFixed = await page.evaluate(() => {
    const el = document.querySelector(".tw-selbar") as HTMLElement | null;
    if (!el) return null;
    const cs = getComputedStyle(el);
    return {
      position: cs.position,
      bottom: cs.bottom,
      transform: cs.transform,
    };
  });
  assert.ok(selbarFixed);
  assert.equal(selbarFixed!.position, "fixed", "selbar position:fixed");
  assert.ok(
    selbarFixed!.bottom === "20px" || Number.parseFloat(selbarFixed!.bottom) === 20,
    "selbar bottom:20px"
  );
  await capture("selbar-visible");

  // Select all → deselect one → parent not fully selected (pack qall / qsel)
  await page.evaluate(() => {
    // @ts-expect-error pack globals
    qsel(0);
  });
  const afterDeselect = await page.evaluate(() => {
    // @ts-expect-error pack globals
    return { size: QSEL.size, calc: QCALC };
  });
  assert.equal(afterDeselect.size, 3, "deselect one leaves 3 selected");

  // Open calculator
  await page.evaluate(() => {
    // @ts-expect-error pack globals
    qcalc(true);
  });
  await page.waitForSelector(".tw-calcp", { timeout: 5000 });
  await capture("calculator-open");

  // Deselect all → bar gone, calculator closes
  await page.evaluate(() => {
    // @ts-expect-error pack globals
    qall(false);
  });
  const cleared = await page.evaluate(() => {
    // @ts-expect-error pack globals
    return {
      size: QSEL.size,
      calc: QCALC,
      hasBar: !!document.querySelector(".tw-selbar"),
      hasCalc: !!document.querySelector(".tw-calcp"),
    };
  });
  assert.equal(cleared.size, 0);
  assert.equal(cleared.calc, false);
  assert.equal(cleared.hasBar, false);
  assert.equal(cleared.hasCalc, false);
  await capture("cleared");

  // Re-open for gpm 100 guard in pack DOM (optional visual)
  await page.evaluate(() => {
    // @ts-expect-error pack globals
    qall(true);
    // @ts-expect-error pack globals
    qcalc(true);
    // @ts-expect-error pack globals
    qmode("gpm");
    // @ts-expect-error pack globals
    qval(100);
  });
  await page.waitForSelector(".tw-calcp", { timeout: 5000 });
  const gpmWarn = await page.evaluate(() =>
    document.body.innerHTML.includes("cannot be solved")
  );
  assert.ok(gpmWarn, "gpm 100 warnrow in pack");
  await capture("calculator-gpm-100");

  await page.evaluate(() => {
    // @ts-expect-error pack globals
    qmode("price");
  });
  const priceWarn = await page.evaluate(() =>
    document.body.innerHTML.includes("same") &&
    document.body.innerHTML.includes("figure")
  );
  assert.ok(priceWarn, "price mode flat-figure warn");
  await capture("calculator-price-mode");

  await browser.close();
  return { skipped: false as const, results };
}

async function main() {
  const crawl = await liveCrawl();
  const failed = crawl.results.filter((r) => !r.ok);
  assert.equal(failed.length, 0, `live coverage failed: ${JSON.stringify(failed)}`);

  console.log("OK — 04-quotation-detail 4b acceptance passed");
  console.log(
    JSON.stringify(
      {
        selbarFixed: true,
        calculatorGuards: [
          "below-cost blocks Apply",
          "gpm>=100 holds at cost",
          "price flat warn",
        ],
        liveCrawl: crawl.skipped ? "skipped" : crawl.results,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
