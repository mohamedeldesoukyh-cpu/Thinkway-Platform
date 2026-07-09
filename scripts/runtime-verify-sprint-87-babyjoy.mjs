/**
 * Sprint 8.7 BabyJoy Campaign Studio runtime validation.
 * Validates all 10 rendering areas with screenshots + DOM checks.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs", "validation-artifacts", "sprint-8.7-babyjoy");
const BASE_URL = "http://localhost:3000";
const BABYJOY_MSG =
  "Launch BabyJoy Premium Diapers in Egypt. Target mothers with babies 0–3 years. Budget EGP 2,000,000. Campaign duration 6 weeks. Objective: Awareness and UGC.";

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

const results = [];
const consoleErrors = [];
const consoleWarnings = [];

function record(id, pass, detail) {
  results.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} [${id}] ${detail}`);
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

async function openExistingBabyJoyConversation(page) {
  const clicked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll(".ai-sidebar button")].find((b) =>
      /babyjoy/i.test(b.textContent ?? "")
    );
    if (btn) {
      btn.click();
      return btn.textContent?.trim() ?? "BabyJoy";
    }
    return null;
  });
  if (clicked) {
    await wait(8000);
    return clicked;
  }
  return null;
}

const USE_EXISTING = process.argv.includes("--existing");

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

async function waitForWorkflowComplete(page, timeoutMs = 300_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const state = await page.evaluate(() => {
      const body = document.body.innerText;
      const progressMatch = body.match(/(\d+)%/);
      const progress = progressMatch ? parseInt(progressMatch[1], 10) : 0;
      const sendDisabled = document.querySelector('button[aria-label="Send message"]')?.hasAttribute("disabled");
      const hasStudio = /campaign studio/i.test(body);
      const completeSections = [...document.querySelectorAll("article h3")].filter((h) => {
        const card = h.closest("article");
        return card?.innerText.includes("Complete");
      }).length;
      return { progress, sendDisabled, hasStudio, completeSections };
    });
    if (state.hasStudio && state.progress >= 100 && !state.sendDisabled) return state;
    if (state.hasStudio && state.completeSections >= 7 && !state.sendDisabled) return state;
    await wait(2000);
  }
  return null;
}

function hasJsonLike(text) {
  return /\{[\s\S]*"[\w]+"[\s\S]*:[\s\S]*\}/.test(text) || /^\s*\[[\s\S]*\{/.test(text);
}

function hasMarkdown(text) {
  return (
    /\*\*[^*]+\*\*/.test(text) ||
    /^#{1,3}\s/m.test(text) ||
    /^[-*]\s/m.test(text) ||
    /```/.test(text)
  );
}

function hasDuplicateLines(text) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 20);
  const seen = new Set();
  for (const line of lines) {
    if (seen.has(line)) return true;
    seen.add(line);
  }
  return false;
}

async function getSectionContent(page, titlePattern) {
  return page.evaluate((pattern) => {
    const articles = [...document.querySelectorAll("article")];
    const article = articles.find((a) => {
      const h3 = a.querySelector("h3");
      return h3 && new RegExp(pattern, "i").test(h3.textContent ?? "");
    });
    if (!article) return { found: false, text: "", html: "" };
    const content = article.querySelector(".flex-1") ?? article;
    return {
      found: true,
      text: content.innerText ?? "",
      html: content.innerHTML ?? "",
      title: article.querySelector("h3")?.textContent ?? "",
    };
  }, titlePattern);
}

async function scrollToSection(page, titlePattern) {
  await page.evaluate((pattern) => {
    const articles = [...document.querySelectorAll("article")];
    const article = articles.find((a) => {
      const h3 = a.querySelector("h3");
      return h3 && new RegExp(pattern, "i").test(h3.textContent ?? "");
    });
    article?.scrollIntoView({ block: "center" });
  }, titlePattern);
  await wait(400);
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const email = "mohamedeldesouky@thinkwaymedia.com";
  const { session, projectRef } = await getAuthenticatedSession(email);

  const browser = await puppeteer.launch({
    headless: true,
    executablePath:
      process.env.PUPPETEER_EXECUTABLE_PATH ??
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1200 });

  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error") consoleErrors.push(text);
    if (msg.type() === "warning") consoleWarnings.push(text);
  });
  page.on("pageerror", (err) => consoleErrors.push(`PAGEERROR: ${err.message}`));

  try {
    await applySessionCookies(page, session, projectRef);
    await page.goto(`${BASE_URL}/ai`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await wait(2500);

    const authed = page.url().includes("/ai") && !page.url().includes("/login");
    record("auth", authed, authed ? `Authenticated at ${page.url()}` : `Auth failed: ${page.url()}`);
    if (!authed) throw new Error("Auth failed");

    await page.screenshot({ path: path.join(OUT_DIR, "00-ai-page.png"), fullPage: true });

    let finalState = null;

    if (USE_EXISTING) {
      const opened = await openExistingBabyJoyConversation(page);
      record("open-existing", Boolean(opened), opened ? `Opened: ${opened}` : "No BabyJoy conversation found");
      if (!opened) throw new Error("No existing BabyJoy conversation");
      await wait(3000);
    } else {
      await startNewChat(page);
      await sendChatMessage(page, BABYJOY_MSG);
      await page.screenshot({ path: path.join(OUT_DIR, "01-babyjoy-sent.png"), fullPage: true });

      let studioAppeared = false;
      try {
        await page.waitForFunction(() => /campaign studio/i.test(document.body.innerText), {
          timeout: 120_000,
        });
        studioAppeared = true;
      } catch {
        studioAppeared = false;
      }
      record(
        "studio-appeared",
        studioAppeared,
        studioAppeared ? "Campaign Studio appeared" : "Campaign Studio not visible within 120s"
      );

      finalState = await waitForWorkflowComplete(page);
    }

    const hasStudio = await page
      .waitForFunction(() => /campaign studio/i.test(document.body.innerText), { timeout: 30_000 })
      .then(() => true)
      .catch(() => false);
    if (USE_EXISTING) {
      record(
        "studio-appeared",
        hasStudio,
        hasStudio ? "Campaign Studio visible in existing conversation" : "Campaign Studio not found"
      );
    }

    await page.screenshot({ path: path.join(OUT_DIR, "10-full-page.png"), fullPage: true });

    if (!finalState) {
      finalState = await page.evaluate(() => {
        const body = document.body.innerText;
        const progressMatch = body.match(/(\d+)%/);
        return {
          progress: progressMatch ? parseInt(progressMatch[1], 10) : 0,
          completeSections: [...document.querySelectorAll("article")].filter((a) =>
            a.innerText.includes("Complete")
          ).length,
        };
      });
    }

    record(
      "workflow-complete",
      Boolean(finalState && (finalState.progress >= 100 || finalState.completeSections >= 7)),
      finalState
        ? `Progress ${finalState.progress}%, ${finalState.completeSections} sections complete`
        : "Workflow did not complete within timeout"
    );

    const stackOverflow = consoleErrors.some((e) => /maximum call stack/i.test(e));
    record(
      "10-no-stack-overflow",
      !stackOverflow,
      stackOverflow ? "Stack overflow detected in console" : "No stack overflow"
    );

    // --- Section validations ---

    // 1. Campaign Summary
    await scrollToSection(page, "Campaign Summary");
    const summary = await getSectionContent(page, "Campaign Summary");
    await page.screenshot({ path: path.join(OUT_DIR, "02-campaign-summary.png") });
    const summaryHasCards = summary.found && /Brand|Product|Market|Budget|Duration|Objective/i.test(summary.text);
    const summaryHasValues = summary.found && !/Brand[\s\S]*—[\s\S]*Product[\s\S]*—[\s\S]*Market[\s\S]*—/.test(summary.text.replace(/\n/g, " "));
    const summaryNoMarkdown = !hasMarkdown(summary.text);
    const summaryNoJson = !hasJsonLike(summary.text);
    const summaryNoDup = !hasDuplicateLines(summary.text);
    const summaryNoParagraphs = !/\n\n.{80,}/.test(summary.text);
    record(
      "1-campaign-summary",
      summaryHasCards && summaryHasValues && summaryNoMarkdown && summaryNoJson && summaryNoDup && summaryNoParagraphs,
      `cards=${summaryHasCards} hasValues=${summaryHasValues} noMd=${summaryNoMarkdown} noJson=${summaryNoJson} noDup=${summaryNoDup} noLongPara=${summaryNoParagraphs}`
    );

    // 2. Executive Strategy
    await scrollToSection(page, "Executive Strategy");
    const strategy = await getSectionContent(page, "Executive Strategy");
    await page.screenshot({ path: path.join(OUT_DIR, "03-executive-strategy.png") });
    const strategyHasCards =
      strategy.found &&
      (/\bObjective\b/i.test(strategy.text) ||
        /\bKey Messages\b/i.test(strategy.text) ||
        /\bPlatform\b/i.test(strategy.text) ||
        /\bTarget Audience\b/i.test(strategy.text));
    const strategyNoMd = !hasMarkdown(strategy.text);
    const strategyNoJson = !hasJsonLike(strategy.text);
    const strategyNoDupSummary =
      !summary.text ||
      !strategy.text ||
      !summary.text
        .split("\n")
        .filter((l) => l.length > 30)
        .some((line) => strategy.text.includes(line));
    record(
      "2-executive-strategy",
      strategyHasCards && strategyNoMd && strategyNoJson,
      `cards=${strategyHasCards} noMd=${strategyNoMd} noJson=${strategyNoJson} noDupSummary=${strategyNoDupSummary}`
    );

    // 3. Vendor Discovery
    await scrollToSection(page, "Vendor Discovery");
    const discovery = await getSectionContent(page, "Vendor Discovery");
    await page.screenshot({ path: path.join(OUT_DIR, "04-vendor-discovery.png") });
    const hasPipeline = /Searching Database|Instagram|TikTok|YouTube|AI Filtering|Final Candidates/.test(
      discovery.text
    );
    const noRawQuery = !/Query:\s*\{/.test(discovery.text) && !/browseUnifiedCreators/.test(discovery.text);
    const noZeroCreators = !/0 creators found/i.test(discovery.text);
    const hasCandidatesOrEmpty =
      /qualified candidates/i.test(discovery.text) ||
      /No qualified vendors found yet/i.test(discovery.text) ||
      /Run Live Discovery/i.test(discovery.text);
    record(
      "3-vendor-discovery",
      discovery.found && hasPipeline && noRawQuery && noZeroCreators && hasCandidatesOrEmpty,
      `pipeline=${hasPipeline} noRawQuery=${noRawQuery} noZero=${noZeroCreators} validState=${hasCandidatesOrEmpty}`
    );

    // 4. Vendor Recommendations
    await scrollToSection(page, "Vendor Recommendations");
    const vendors = await getSectionContent(page, "Vendor Recommendations");
    await page.screenshot({ path: path.join(OUT_DIR, "05-vendor-recommendations.png") });
    const hasVendorCards =
      vendors.found &&
      (/followers/i.test(vendors.text) || /Recommendations pending/i.test(vendors.text));
    const noPlaceholders = !/@vendor-\d+/i.test(vendors.text) && !/Vendor \d+/i.test(vendors.text);
    const vendorLines = vendors.text.split("\n").filter((l) => l.includes("@"));
    const noDupVendors = new Set(vendorLines).size === vendorLines.length;
    record(
      "4-vendor-recommendations",
      hasVendorCards && noPlaceholders && noDupVendors,
      `cards=${hasVendorCards} noPlaceholders=${noPlaceholders} noDup=${noDupVendors}`
    );

    // 5. Budget Planner
    await scrollToSection(page, "Budget Planner");
    const budget = await getSectionContent(page, "Budget Planner");
    await page.screenshot({ path: path.join(OUT_DIR, "06-budget-planner.png") });
    const budgetNoJson = !hasJsonLike(budget.text);
    const budgetNoConversion = !/convert|exchange rate|USD|EUR/i.test(budget.text.replace(/EGP/g, ""));
    const budgetHasCurrency = /EGP|Budget allocation pending/i.test(budget.text);
    const budgetHasViz =
      budget.html.includes("rounded-t-lg") || /Budget allocation pending/i.test(budget.text);
    record(
      "5-budget-planner",
      budget.found && budgetNoJson && budgetNoConversion && budgetHasCurrency && budgetHasViz,
      `noJson=${budgetNoJson} noConversion=${budgetNoConversion} currency=${budgetHasCurrency} viz=${budgetHasViz}`
    );

    // 6. Timeline
    await scrollToSection(page, "Timeline");
    const timeline = await getSectionContent(page, "Timeline");
    await page.screenshot({ path: path.join(OUT_DIR, "07-timeline.png") });
    const timelineHasComponent =
      timeline.found &&
      (/Week \d/i.test(timeline.text) || /Timeline pending/i.test(timeline.text));
    const timelineNoJson = !hasJsonLike(timeline.text);
    record(
      "6-timeline",
      timelineHasComponent && timelineNoJson,
      `component=${timelineHasComponent} noJson=${timelineNoJson}`
    );

    // 7. KPI Forecast
    await scrollToSection(page, "KPI Forecast");
    const kpi = await getSectionContent(page, "KPI Forecast");
    await page.screenshot({ path: path.join(OUT_DIR, "08-kpi-forecast.png") });
    const kpiHasCards =
      kpi.found &&
      (kpi.html.includes("Progress") ||
        /\bReach\b|\bEngagement\b|\bViews\b|\bROI\b/i.test(kpi.text) ||
        /KPI forecast pending/i.test(kpi.text));
    const kpiNoJson = !hasJsonLike(kpi.text);
    const kpiNoDupStrategy =
      !strategy.text || !kpi.text || strategy.text.slice(0, 80) !== kpi.text.slice(0, 80);
    record(
      "7-kpi-forecast",
      kpiHasCards && kpiNoJson && kpiNoDupStrategy,
      `cards=${kpiHasCards} noJson=${kpiNoJson} noDupStrategy=${kpiNoDupStrategy}`
    );

    // 8. Risk Analysis
    await scrollToSection(page, "Risk Analysis");
    const risk = await getSectionContent(page, "Risk Analysis");
    await page.screenshot({ path: path.join(OUT_DIR, "09-risk-analysis.png") });
    const riskHasCards =
      risk.found &&
      (/Mitigation/i.test(risk.text) ||
        /high|medium|low/i.test(risk.text) ||
        /Risk analysis pending/i.test(risk.text));
    const riskHasBadges = /Action required|Monitoring|Overall/i.test(risk.text) || /Risk analysis pending/i.test(risk.text);
    const riskNoGenericAi = !/As an AI|I cannot|language model/i.test(risk.text);
    record(
      "8-risk-analysis",
      riskHasCards && riskHasBadges && riskNoGenericAi,
      `cards=${riskHasCards} badges=${riskHasBadges} noGenericAi=${riskNoGenericAi}`
    );

    // 9. Presentation Status
    await scrollToSection(page, "Presentation Status");
    const presentation = await getSectionContent(page, "Presentation Status");
    await page.screenshot({ path: path.join(OUT_DIR, "10-presentation-status.png") });
    const presHasApproval = /Approve|Awaiting Approval|Ready for Review/i.test(presentation.text);
    const presHasExport = /Export PDF|Export PowerPoint/i.test(presentation.text);
    const presNoMd = !hasMarkdown(presentation.text);
    record(
      "9-presentation-status",
      presentation.found && presHasApproval && presHasExport && presNoMd,
      `approval=${presHasApproval} export=${presHasExport} noMd=${presNoMd}`
    );

    // 10. Whole page
    const bodyText = await page.evaluate(() => document.body.innerText);
    const wholeNoMd = !hasMarkdown(bodyText.slice(bodyText.indexOf("Campaign Studio")));
    const wholeNoJson = !hasJsonLike(bodyText);
    const wholeNoDup = !hasDuplicateLines(bodyText.slice(bodyText.indexOf("Campaign Studio")));
    const noConsoleErrors = consoleErrors.filter((e) => !/favicon|devtools|Failed to load resource/i.test(e)).length === 0;
    record(
      "10-whole-page",
      wholeNoMd && wholeNoJson && wholeNoDup && noConsoleErrors && !stackOverflow,
      `noMd=${wholeNoMd} noJson=${wholeNoJson} noDup=${wholeNoDup} noConsoleErrors=${noConsoleErrors} errors=${consoleErrors.length} warnings=${consoleWarnings.length}`
    );

    const report = {
      timestamp: new Date().toISOString(),
      prompt: BABYJOY_MSG,
      results,
      consoleErrors: consoleErrors.slice(0, 30),
      consoleWarnings: consoleWarnings.slice(0, 15),
      allPass: results.every((r) => r.pass),
    };
    fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));

    console.log("\n=== SPRINT 8.7 BABYJOY VALIDATION ===");
    for (const r of results) {
      console.log(`${r.pass ? "✓" : "✗"} ${r.id}: ${r.detail}`);
    }
    console.log(`\nAll pass: ${report.allPass}`);
    console.log(`Artifacts: ${OUT_DIR}`);

    process.exitCode = report.allPass ? 0 : 1;
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Validation failed:", err);
  record("fatal", false, String(err?.message ?? err));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, "report.json"),
    JSON.stringify({ results, consoleErrors, error: String(err) }, null, 2)
  );
  process.exit(1);
});
