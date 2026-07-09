/**
 * ERS-1 FINAL: Live parity UI verification via Puppeteer.
 * Requires dev server at localhost:3000.
 * Run: node scripts/ers-1-live-parity.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs", "validation-artifacts", "ers-1");
const BASE_URL = "http://localhost:3000";

const WORKFLOWS = [
  {
    id: "travel-egypt",
    label: "Find travel creators in Egypt",
    message: "Find travel creators in Egypt",
  },
  {
    id: "luxury-hotel-dubai",
    label: "Find luxury hotel creators in Dubai",
    message: "Find luxury hotel creators in Dubai for a 5-star resort campaign",
  },
  {
    id: "babyjoy",
    label: "BabyJoy campaign",
    message:
      "Launch BabyJoy Premium Diapers in Egypt. Target mothers with babies 0–3 years. Budget EGP 2,000,000. Campaign duration 6 weeks. Objective: Awareness and UGC.",
  },
  {
    id: "adidas",
    label: "Adidas campaign",
    message:
      "Adidas Egypt sportswear product launch for new running collection. Target active lifestyle 18–35 in Cairo and Alexandria. Budget EGP 4,500,000. Duration 6 weeks. Objective: Product launch and conversion.",
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

const uiResults = [];

function record(id, pass, detail, extra = {}) {
  uiResults.push({ id, pass, detail, ...extra });
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

async function sendChatMessage(page, message) {
  const textarea = await page.waitForSelector("textarea", { timeout: 30_000 });
  await textarea.click({ clickCount: 3 });
  await page.keyboard.press("Backspace");
  await textarea.type(message, { delay: 5 });
  const sendBtn = await page.waitForSelector('button[aria-label="Send message"]:not([disabled])', {
    timeout: 10_000,
  });
  await sendBtn.click();
}

async function waitForStreamingEnd(page, timeoutMs = 240_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const streaming = await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="Send message"]');
      const textarea = document.querySelector("textarea");
      return Boolean(
        btn?.hasAttribute("disabled") ||
          textarea?.hasAttribute("disabled") ||
          document.body.innerText.includes("In progress")
      );
    });
    if (!streaming) {
      await wait(2000);
      const still = await page.evaluate(() => {
        const btn = document.querySelector('button[aria-label="Send message"]');
        return Boolean(btn?.hasAttribute("disabled"));
      });
      if (!still) return true;
    }
    await wait(1500);
  }
  return false;
}

async function countCreatorCards(page) {
  return page.evaluate(() => {
    const discoverySection = [...document.querySelectorAll("h2,h3,h4,button,span,div")].find(
      (el) => /creator discovery|vendor discovery|discovery/i.test(el.textContent ?? "")
    );
    const recommendationSection = [...document.querySelectorAll("h2,h3,h4,button,span,div")].find(
      (el) => /recommendation|shortlist|vendor recommendation/i.test(el.textContent ?? "")
    );

    const cardSelectors = [
      "[data-creator-id]",
      "[data-vendor-id]",
      ".vendor-card",
      ".creator-card",
      "[class*='vendor-recommendation']",
      "[class*='creator-discovery']",
    ];

    const allCards = [];
    for (const sel of cardSelectors) {
      document.querySelectorAll(sel).forEach((el) => {
        const id =
          el.getAttribute("data-creator-id") ??
          el.getAttribute("data-vendor-id") ??
          el.getAttribute("data-id") ??
          null;
        allCards.push({ id, text: (el.textContent ?? "").slice(0, 80) });
      });
    }

    const handles = [...document.querySelectorAll("span, p, div")]
      .map((el) => el.textContent?.trim() ?? "")
      .filter((t) => /^@[\w._-]+$/.test(t));

    const uniqueHandles = [...new Set(handles)];
    const duplicateHandles = uniqueHandles.filter(
      (h) => handles.filter((x) => x === h).length > 1
    );

    const fabricated = [...document.querySelectorAll("*")]
      .map((el) => el.textContent?.trim() ?? "")
      .filter((t) => /^Creator \d+$/.test(t) || /^@creator-\d+$/i.test(t));

    return {
      discoverySectionFound: Boolean(discoverySection),
      recommendationSectionFound: Boolean(recommendationSection),
      cardCount: allCards.length,
      cardIds: allCards.map((c) => c.id).filter(Boolean),
      uniqueHandleCount: uniqueHandles.length,
      duplicateHandles,
      fabricatedCount: fabricated.length,
      campaignStudioVisible: /campaign studio/i.test(document.body.innerText),
    };
  });
}

async function runWorkflow(page, workflow, index) {
  console.log(`\n=== UI Workflow: ${workflow.label} ===`);

  await page.goto(`${BASE_URL}/ai`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await wait(1500);

  const sentShot = path.join(OUT_DIR, `${String(index + 1).padStart(2, "0")}-${workflow.id}-sent.png`);
  await sendChatMessage(page, workflow.message);
  await page.screenshot({ path: sentShot, fullPage: true });

  const streamed = await waitForStreamingEnd(page, 240_000);
  await wait(3000);

  const completeShot = path.join(
    OUT_DIR,
    `${String(index + 1).padStart(2, "0")}-${workflow.id}-complete.png`
  );
  await page.screenshot({ path: completeShot, fullPage: true });

  const counts = await countCreatorCards(page);
  const uniqueCardIds = [...new Set(counts.cardIds)];
  const duplicateCardIds = counts.cardIds.filter(
    (id, i) => counts.cardIds.indexOf(id) !== i
  );

  const pass =
    streamed &&
    counts.duplicateHandles.length === 0 &&
    counts.fabricatedCount === 0 &&
    duplicateCardIds.length === 0;

  record(
    workflow.id,
    pass,
    streamed
      ? `cards=${counts.cardCount} handles=${counts.uniqueHandleCount} studio=${counts.campaignStudioVisible}`
      : "Streaming did not complete within timeout",
    {
      label: workflow.label,
      screenshots: [sentShot, completeShot],
      counts: {
        ...counts,
        uniqueCardIds: uniqueCardIds.length,
        duplicateCardIds,
      },
      streamed,
    }
  );

  return { workflow, counts, pass, streamed };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let serverUp = false;
  try {
    const res = await fetch(`${BASE_URL}/ai`, { signal: AbortSignal.timeout(5000) });
    serverUp = res.ok || res.status === 307 || res.status === 302;
  } catch {
    serverUp = false;
  }

  if (!serverUp) {
    console.warn("Dev server not running at localhost:3000 — skipping UI verification");
    const report = {
      skipped: true,
      reason: "Dev server not available",
      uiResults: [],
      generatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(path.join(OUT_DIR, "live-parity-ui.json"), JSON.stringify(report, null, 2));
    return;
  }

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
  await page.setViewport({ width: 1440, height: 900 });
  await applySessionCookies(page, session, projectRef);

  const workflowResults = [];
  for (let i = 0; i < WORKFLOWS.length; i++) {
    workflowResults.push(await runWorkflow(page, WORKFLOWS[i], i));
  }

  await browser.close();

  const report = {
    generatedAt: new Date().toISOString(),
    skipped: false,
    uiResults,
    allPass: uiResults.every((r) => r.pass),
  };
  fs.writeFileSync(path.join(OUT_DIR, "live-parity-ui.json"), JSON.stringify(report, null, 2));
  console.log(`\nUI report written to ${path.join(OUT_DIR, "live-parity-ui.json")}`);
  console.log(report.allPass ? "\nUI RESULT: ALL PASS" : "\nUI RESULT: FAILURES DETECTED");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
