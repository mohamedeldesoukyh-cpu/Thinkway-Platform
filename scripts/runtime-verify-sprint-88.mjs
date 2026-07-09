/**
 * Sprint 8.8 — Agency Grade Campaign Intelligence validation.
 * Creates/tests 5 industry campaigns and captures screenshots.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs", "validation-artifacts", "sprint-8.8");
const BASE_URL = process.env.VALIDATION_BASE_URL ?? "http://localhost:3000";

const CAMPAIGNS = [
  {
    id: "babyjoy-egypt",
    label: "BabyJoy Egypt",
    message:
      "Launch BabyJoy Premium Diapers in Egypt. Target mothers with babies 0–3 years. Budget EGP 2,000,000. Campaign duration 6 weeks. Objective: Awareness and UGC.",
    expectIndustry: ["baby", "mom", "diaper", "ugc"],
    expectKpi: ["UGC", "Parent", "Trust"],
  },
  {
    id: "rolex-middle-east",
    label: "Rolex Middle East",
    message:
      "Launch Rolex luxury watch collection across UAE and Saudi Arabia. Target affluent professionals 35–55. Budget AED 5,000,000. Duration 8 weeks. Objective: Brand prestige and aspiration.",
    expectIndustry: ["luxury", "prestige", "heritage", "icon"],
    expectKpi: ["Brand favorability", "Qualified reach", "Share of voice"],
  },
  {
    id: "visit-egypt-tourism",
    label: "Visit Egypt Tourism",
    message:
      "Visit Egypt tourism campaign promoting ancient wonders and Red Sea adventures. Target adventure travelers 25–40 across MENA. Budget USD 3,500,000. Duration 12 weeks. Objective: Destination awareness and trip planning.",
    expectIndustry: ["tourism", "travel", "destination", "adventure"],
    expectKpi: ["Destination consideration", "Video views", "Trip planning"],
  },
  {
    id: "adidas-egypt",
    label: "Adidas Egypt",
    message:
      "Adidas Egypt sportswear product launch for new running collection. Target active lifestyle 18–35 in Cairo and Alexandria. Budget EGP 4,500,000. Duration 6 weeks. Objective: Product launch and conversion.",
    expectIndustry: ["retail", "sportswear", "launch", "fit"],
    expectKpi: ["Product launch", "Shoppable", "ROAS"],
  },
  {
    id: "emirates-nbd",
    label: "Emirates NBD",
    message:
      "Emirates NBD credit card product adoption campaign in UAE. Target young professionals 25–35. Budget AED 2,800,000. Duration 8 weeks. Objective: Trust and product adoption.",
    expectIndustry: ["finance", "banking", "trust", "compliance"],
    expectKpi: ["Product consideration", "Compliance", "Application starts"],
  },
];

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

if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === undefined) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const results = [];

function record(campaignId, check, pass, detail) {
  results.push({ campaignId, check, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} [${campaignId}/${check}] ${detail}`);
}

async function getAuthenticatedSession(email) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !adminKey || !anonKey) {
    throw new Error("Missing Supabase env for admin auth");
  }

  const admin = createClient(url, adminKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anon = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError) throw linkError;

  const { data, error } = await anon.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "email",
  });
  if (error) throw error;
  if (!data.session) throw new Error("verifyOtp returned no session");
  return { session: data.session, projectRef: new URL(url).hostname.split(".")[0] };
}

async function applySessionCookies(page, session, projectRef) {
  const encoded = `base64-${Buffer.from(JSON.stringify(session)).toString("base64url")}`;
  await page.setCookie({
    name: `sb-${projectRef}-auth-token`,
    value: encoded,
    domain: "localhost",
    path: "/",
    sameSite: "Lax",
  });
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startNewChat(page) {
  const clicked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(
      (b) =>
        b.getAttribute("aria-label") === "New chat" ||
        (b.textContent?.trim() === "New chat" && b.closest(".ai-sidebar"))
    );
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  if (clicked) await wait(2000);
}

async function sendChatMessage(page, message) {
  const textarea = await page.waitForSelector("textarea:not([disabled])", { timeout: 120_000 });
  await textarea.click({ clickCount: 3 });
  await page.keyboard.press("Backspace");
  await page.keyboard.type(message, { delay: 2 });
  await wait(500);

  await page.waitForFunction(
    () => {
      const btn = document.querySelector('button[aria-label="Send message"]');
      return btn && !btn.hasAttribute("disabled");
    },
    { timeout: 15_000 }
  );

  await page.click('button[aria-label="Send message"]');
}

async function waitForStudio(page, timeoutMs = 300_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const state = await page.evaluate(() => {
      const body = document.body.innerText;
      const hasStudio = /campaign studio/i.test(body);
      const sectionCount = [...document.querySelectorAll("article h3")].length;
      const sendDisabled = document
        .querySelector('button[aria-label="Send message"]')
        ?.hasAttribute("disabled");
      return { hasStudio, sectionCount, sendDisabled };
    });
    if (state.hasStudio && state.sectionCount >= 10 && !state.sendDisabled) return state;
    if (state.hasStudio && state.sectionCount >= 8 && Date.now() - start > 120_000) return state;
    await wait(3000);
  }
  return null;
}

async function getSectionText(page, titlePattern) {
  return page.evaluate((pattern) => {
    const articles = [...document.querySelectorAll("article")];
    const article = articles.find((a) => {
      const h3 = a.querySelector("h3");
      return h3 && new RegExp(pattern, "i").test(h3.textContent ?? "");
    });
    if (!article) return "";
    const content = article.querySelector(".flex-1") ?? article;
    return content.innerText ?? "";
  }, titlePattern);
}

async function validateCampaign(page, campaign) {
  const campaignDir = path.join(OUT_DIR, campaign.id);
  fs.mkdirSync(campaignDir, { recursive: true });

  await startNewChat(page);
  await sendChatMessage(page, campaign.message);
  await page.screenshot({
    path: path.join(campaignDir, "01-message-sent.png"),
    fullPage: true,
  });

  const studioState = await waitForStudio(page);
  record(
    campaign.id,
    "studio-visible",
    Boolean(studioState?.hasStudio),
    studioState?.hasStudio
      ? `Studio visible with ${studioState.sectionCount} sections`
      : "Studio not visible within timeout"
  );

  await page.screenshot({
    path: path.join(campaignDir, "02-campaign-studio.png"),
    fullPage: true,
  });

  const sections = [
    "Campaign Summary",
    "Executive Strategy",
    "Vendor Discovery",
    "Creative Concepts",
    "Content Plan",
    "Creator Mix",
    "Why AI",
    "KPI Forecast",
    "Risk Analysis",
    "Budget Planner",
    "Timeline",
    "Presentation Status",
  ];

  for (const section of sections) {
    await page.evaluate((title) => {
      const articles = [...document.querySelectorAll("article")];
      const article = articles.find((a) => {
        const h3 = a.querySelector("h3");
        return h3 && h3.textContent?.includes(title);
      });
      article?.scrollIntoView({ block: "center" });
    }, section);
    await wait(400);
    const slug = section.toLowerCase().replace(/\s+/g, "-");
    await page.screenshot({
      path: path.join(campaignDir, `section-${slug}.png`),
      fullPage: false,
    });
  }

  const summaryText = await getSectionText(page, "Campaign Summary");
  const kpiText = await getSectionText(page, "KPI Forecast");
  const conceptsText = await getSectionText(page, "Creative Concepts");
  const riskText = await getSectionText(page, "Risk Analysis");

  record(
    campaign.id,
    "summary-populated",
    summaryText.length > 100,
    `Summary ${summaryText.length} chars`
  );

  const industryMatch = campaign.expectIndustry.some((term) =>
    `${summaryText} ${conceptsText} ${riskText}`.toLowerCase().includes(term.toLowerCase())
  );
  record(campaign.id, "industry-content", industryMatch, `Industry signals in content`);

  const kpiMatch = campaign.expectKpi.some((kpi) =>
    kpiText.toLowerCase().includes(kpi.toLowerCase())
  );
  record(campaign.id, "industry-kpis", kpiMatch, `Expected KPIs present`);

  const noPlaceholders = !/TBD|pending…|—|placeholder|\{/.test(
    `${summaryText} ${kpiText}`.slice(0, 500)
  );
  record(campaign.id, "no-placeholders", noPlaceholders, "No empty placeholders in key sections");

  return { summaryText, kpiText, conceptsText };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const onlyCampaign = process.argv.find((a) => a.startsWith("--campaign="))?.split("=")[1];
  const campaignsToRun = onlyCampaign
    ? CAMPAIGNS.filter((c) => c.id === onlyCampaign)
    : CAMPAIGNS;

  if (campaignsToRun.length === 0) {
    throw new Error(`Unknown campaign: ${onlyCampaign}`);
  }

  const email = process.env.VALIDATION_EMAIL ?? "mohamedeldesouky@thinkwaymedia.com";
  const { session, projectRef } = await getAuthenticatedSession(email);

  const browser = await puppeteer.launch({
    headless: true,
    executablePath:
      process.env.PUPPETEER_EXECUTABLE_PATH ??
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1400 });

  const industryOutputs = {};

  try {
    await applySessionCookies(page, session, projectRef);
    await page.goto(`${BASE_URL}/ai`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await wait(2500);

    for (const campaign of campaignsToRun) {
      console.log(`\n=== Validating ${campaign.label} ===`);
      const output = await validateCampaign(page, campaign);
      industryOutputs[campaign.id] = {
        label: campaign.label,
        kpiSnippet: output.kpiText.slice(0, 200),
        conceptsSnippet: output.conceptsText.slice(0, 200),
      };
    }

    const kpiSets = Object.values(industryOutputs).map((o) => o.kpiSnippet);
    const allDifferent = new Set(kpiSets).size === kpiSets.length;
    record("cross-campaign", "kpi-differentiation", allDifferent, `${new Set(kpiSets).size} unique KPI sets`);

    fs.writeFileSync(
      path.join(OUT_DIR, "validation-results.json"),
      JSON.stringify({ results, industryOutputs }, null, 2)
    );

    const passCount = results.filter((r) => r.pass).length;
    console.log(`\n=== SUMMARY: ${passCount}/${results.length} checks passed ===`);
    console.log(`Screenshots: ${OUT_DIR}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
