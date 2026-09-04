/**
 * Live class-coverage crawl across page-2 overlay states.
 * Uses pack discovery.html (same .tw-* classes as foundation CSS) and opens
 * profile (all tabs), then samples Edit URL / Combine / Add-creators markup
 * that the React overlays emit (tw-* tokens only).
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

/** React overlay chrome that must stay in foundation CSS (sampled from components). */
const REACT_OVERLAY_SAMPLES: Record<string, string> = {
  "edit-url": `
<div class="discovery-suite">
  <div class="tw-scrim"></div>
  <div class="tw-cp"><div class="tw-cp__w">
    <div class="tw-ch"><span class="tw-ct">Edit URL</span><button class="tw-dr__x" aria-label="Close"></button></div>
    <div class="tw-pad"><label class="tw-lbl">Profile URL</label><input class="tw-in" />
    <button class="tw-b sm pri">Save</button><button class="tw-b sm">Cancel</button></div>
  </div></div>
</div>`,
  combine: `
<div class="discovery-suite">
  <div class="tw-scrim"></div>
  <div class="tw-cp"><div class="tw-cp__w">
    <div class="tw-ch"><span class="tw-ct">Combine creators</span><button class="tw-dr__x"></button></div>
    <div class="tw-pad"><p class="tw-note">This cannot be undone.</p>
    <button class="tw-b sm" disabled>Combine creators</button></div>
  </div></div>
</div>`,
  "add-creators": `
<div class="discovery-suite">
  <div class="tw-dr">
    <div class="tw-dr__h"><span class="tw-ct">Add creators</span><button class="tw-dr__x"></button></div>
    <div class="tw-dr__s"><button class="tw-b on">Search</button><button class="tw-b">Paste links</button></div>
    <div class="tw-pad"><input class="tw-in" placeholder="Search creators…" />
    <div class="tw-stx"><span class="hh"><i></i><i>Followers</i><i>Engagement</i><i>Avg views</i></span>
    <span class="rr"><span class="tw-pf"><span class="ig">IG</span></span><b class="z">—</b><b class="z">—</b><b class="z">—</b></span></div>
    </div>
  </div>
</div>`,
};

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

  // Navigate pack to shortlist detail
  await page.evaluate(() => {
    // @ts-expect-error pack globals
    if (typeof go === "function") go("shortlist");
    // @ts-expect-error pack globals
    else if (typeof draw === "function") {
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

  await capture("shortlist-default");

  // Open first creator profile
  await page.evaluate(() => {
    // @ts-expect-error pack globals
    if (typeof openCr === "function") openCr("ouda.5");
  });
  await capture("profile-overview");

  for (const tab of ["ov", "ct", "pb", "cf"] as const) {
    await page.evaluate((t) => {
      // @ts-expect-error pack globals
      if (typeof dtab === "function") dtab(t);
    }, tab);
    await capture(`profile-tab-${tab}`);
  }

  await browser.close();

  for (const [state, sample] of Object.entries(REACT_OVERLAY_SAMPLES)) {
    const coverage = assertClassCoverage(sample);
    results.push({
      state: `react-${state}`,
      ok: coverage.ok,
      missing: coverage.missing,
      used: coverage.used.length,
    });
  }

  const failed = results.filter((r) => !r.ok);
  console.log(JSON.stringify({ results, failedCount: failed.length }, null, 2));
  if (failed.length) {
    console.error(
      "Class-coverage failures:",
      failed.map((f) => `${f.state}: ${f.missing.join(", ")}`).join(" | ")
    );
    process.exit(1);
  }
  console.log("OK — overlay class-coverage crawl passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
