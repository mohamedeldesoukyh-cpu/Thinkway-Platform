/**
 * UX-1 layout audit — grid dimensions at 1440px viewport.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "docs", "validation-artifacts", "ux-1", "layout-audit.json");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(path.join(ROOT, ".env.local"));
loadEnvFile(path.join(ROOT, ".env"));

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = process.env.UX_TEST_EMAIL ?? "mohamedeldesouky@thinkwaymedia.com";
  const ref = new URL(url).hostname.split(".")[0];

  const admin = createClient(url, adminKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anon = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: linkData } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  const { data } = await anon.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "email",
  });

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const encoded = `base64-${Buffer.from(JSON.stringify(data.session)).toString("base64url")}`;
  await page.setCookie({
    name: `sb-${ref}-auth-token`,
    value: encoded,
    domain: "localhost",
    path: "/",
    sameSite: "Lax",
  });

  await page.goto("http://localhost:3000/ai", { waitUntil: "domcontentloaded" });
  await new Promise((r) => setTimeout(r, 2500));
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll(".ai-sidebar button")].find((b) =>
      /babyjoy|diaper/i.test(b.textContent ?? "")
    );
    btn?.click();
  });
  await new Promise((r) => setTimeout(r, 8000));

  const audit = await page.evaluate(() => {
    const articles = [...document.querySelectorAll("article")];
    const byTitle = Object.fromEntries(
      articles.map((a) => [a.querySelector("h3")?.textContent?.trim() ?? "", a])
    );
    const sectionGrid = articles[0]?.closest(".grid.lg\\:grid-cols-2");
    const gridCols = sectionGrid
      ? window.getComputedStyle(sectionGrid).gridTemplateColumns
      : "";

    const measure = (title) => {
      const el = byTitle[title];
      if (!el) return null;
      return Math.round(el.getBoundingClientRect().width);
    };

    const kpi = measure("KPI Forecast");
    const risk = measure("Risk Analysis");
    const mix = measure("Creator Mix");
    const rationale = measure("Thinkway Decision Rationale");
    const summary = measure("Campaign Summary");
    const budget = measure("Budget Planner");
    const pair = measure("KPI Forecast");

    return {
      viewport: 1440,
      sectionGridCols: gridCols,
      widths: {
        campaignSummary: summary,
        budgetPlanner: budget,
        kpiForecast: kpi,
        riskAnalysis: risk,
        creatorMix: mix,
        thinkwayDecisionRationale: rationale,
        vendorDiscovery: measure("Vendor Discovery"),
      },
      checks: {
        analyticsPairEqual: kpi != null && risk != null && Math.abs(kpi - risk) <= 4,
        strategyPairEqual: mix != null && rationale != null && Math.abs(mix - rationale) <= 4,
        dashboardSpansFull:
          summary != null && pair != null && summary > pair * 1.5 && budget != null && budget > pair * 1.5,
      },
    };
  });

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(audit, null, 2));
  console.log(JSON.stringify(audit, null, 2));

  await page.screenshot({
    path: path.join(ROOT, "docs", "validation-artifacts", "ux-1", "02-babyjoy-layout-after.png"),
    fullPage: true,
  });

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
