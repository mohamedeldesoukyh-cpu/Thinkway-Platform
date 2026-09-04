/**
 * Live class-coverage crawl across page-2 overlay states.
 * Opens pack overlays for real (profile tabs, Edit URL, Combine, Add-creators drawer).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

import { assertClassCoverage } from "../lib/discovery/suite/class-coverage";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PACK = path.join(ROOT, "docs/architecture/discovery.html");

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

async function main() {
  const executablePath = chrome();
  if (!executablePath) {
    console.error("No Chrome/Edge found");
    process.exit(1);
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
    if (typeof go === "function") go("shortlist");
    else {
      // @ts-expect-error pack globals
      PG = "shortlist";
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

  async function assertOpen(state: string, selector: string) {
    const hit = await page.$(selector);
    if (!hit) {
      results.push({
        state: `${state}:missing-dom`,
        ok: false,
        missing: [selector],
        used: 0,
      });
      return false;
    }
    await capture(state);
    return true;
  }

  await capture("shortlist-default");

  await page.evaluate(() => {
    // @ts-expect-error pack globals
    openCr("ouda.5");
  });
  await assertOpen("profile-overview", ".tw-cp");

  for (const tab of ["ov", "ct", "pb", "cf"] as const) {
    await page.evaluate((t) => {
      // @ts-expect-error pack globals
      dtab(t);
    }, tab);
    await capture(`profile-tab-${tab}`);
  }

  // Edit URL — requires open profile (DRW set)
  await page.evaluate(() => {
    // @ts-expect-error pack globals
    editUrl(true);
  });
  await assertOpen("edit-url", '[aria-label="Edit profile URL"]');
  await page.evaluate(() => {
    // @ts-expect-error pack globals
    editUrl(false);
  });

  // Combine — requires open profile
  await page.evaluate(() => {
    // @ts-expect-error pack globals
    combine(true);
  });
  await assertOpen("combine", '[aria-label="Combine creators"]');
  await page.evaluate(() => {
    // @ts-expect-error pack globals
    combine(false);
  });

  // Close profile, open shortlist Add-creators drawer
  await page.evaluate(() => {
    // @ts-expect-error pack globals
    openCr(null);
    // @ts-expect-error pack globals
    slAdd(true);
  });
  await assertOpen("add-creators", '[aria-label="Add creators to shortlist"]');
  await page.evaluate(() => {
    // @ts-expect-error pack globals
    slAdd(false);
  });

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(JSON.stringify({ results, failedCount: failed.length }, null, 2));
  if (failed.length) {
    console.error(
      "Class-coverage failures:",
      failed.map((f) => `${f.state}: ${f.missing.join(", ")}`).join(" | ")
    );
    process.exit(1);
  }
  console.log("OK — overlay class-coverage live crawl passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
