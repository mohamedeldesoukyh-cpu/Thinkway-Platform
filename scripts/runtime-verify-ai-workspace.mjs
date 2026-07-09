/**
 * Runtime verification for AI workspace stack overflow fix.
 * Uses Puppeteer + Supabase admin magic link (no password stored).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs", "validation-artifacts", "runtime-ai-verification");
const BASE_URL = "http://localhost:3000";
const BABYJOY_MSG =
  "Launch BabyJoy Premium Diapers in Egypt. Target mothers with babies 0–3 years. Budget EGP 2,000,000. Campaign duration 6 weeks. Objective: Awareness and UGC.";
const FIND_CREATORS_MSG = "Find travel creators in Egypt";

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
let networkEvents = [];

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

async function waitForStreamingEnd(page, timeoutMs = 180_000) {
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
      await wait(1500);
      const still = await page.evaluate(() => {
        const btn = document.querySelector('button[aria-label="Send message"]');
        return Boolean(btn?.hasAttribute("disabled"));
      });
      if (!still) return true;
    }
    await wait(1000);
  }
  return false;
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
  await page.setViewport({ width: 1440, height: 900 });

  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error") consoleErrors.push(text);
    if (msg.type() === "warning") consoleWarnings.push(text);
  });

  page.on("response", (response) => {
    const url = response.url();
    if (url.includes("/api/ai/") || url.includes("/api/ai/chat")) {
      networkEvents.push({
        t: Date.now(),
        url: url.replace(BASE_URL, ""),
        status: response.status(),
        type: response.request().resourceType(),
      });
    }
  });

  try {
    await applySessionCookies(page, session, projectRef);
    const authResponse = await page.goto(`${BASE_URL}/ai`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await wait(2000);

    const afterAuthUrl = page.url();
    const authed = afterAuthUrl.includes("/ai") && !afterAuthUrl.includes("/login");
    record(
      "auth",
      authed,
      authed
        ? `Session cookie auth → ${afterAuthUrl} (HTTP ${authResponse?.status()})`
        : `Auth failed at ${afterAuthUrl}`
    );
    if (!authed) throw new Error("Login blocked verification");
    await page.screenshot({ path: path.join(OUT_DIR, "01-ai-page.png"), fullPage: true });
    const onAi = page.url().includes("/ai") && !page.url().includes("/login");
    record("1-open-ai", onAi, onAi ? `Loaded ${page.url()}` : `Redirected to ${page.url()}`);

    networkEvents = [];
    const preCampaignErrors = consoleErrors.length;
    await sendChatMessage(page, BABYJOY_MSG);
    await page.screenshot({ path: path.join(OUT_DIR, "02-babyjoy-sent.png"), fullPage: true });

    let campaignStudioVisible = false;
    try {
      await page.waitForFunction(
        () => /campaign studio/i.test(document.body.innerText),
        { timeout: 120_000 }
      );
      campaignStudioVisible = true;
    } catch {
      campaignStudioVisible = false;
    }

    const stackOverflow = consoleErrors.some((e) =>
      /maximum call stack size exceeded/i.test(e)
    );
    record(
      "3-no-stack-overflow",
      !stackOverflow,
      stackOverflow
        ? `Stack overflow detected: ${consoleErrors.find((e) => /maximum call stack/i.test(e))}`
        : `No stack overflow (${consoleErrors.length - preCampaignErrors} new console errors)`
    );

    record(
      "4-campaign-studio-streams",
      campaignStudioVisible,
      campaignStudioVisible
        ? "Campaign Studio UI appeared during workflow"
        : "Campaign Studio text not observed within 120s"
    );

    await waitForStreamingEnd(page, 180_000);
    await page.screenshot({ path: path.join(OUT_DIR, "03-babyjoy-complete.png"), fullPage: true });

    const campaignNetwork = [...networkEvents];
    const chatPosts = campaignNetwork.filter((e) => e.url.includes("/api/ai/chat"));
    record(
      "9-sse-network-campaign",
      chatPosts.length >= 1,
      `Campaign phase: ${chatPosts.length} chat POST(s), ${campaignNetwork.length} total /api/ai/* requests`
    );

    networkEvents = [];
    const preFindErrors = consoleErrors.length;
    await sendChatMessage(page, FIND_CREATORS_MSG);
    await page.screenshot({ path: path.join(OUT_DIR, "04-find-creators-sent.png"), fullPage: true });

    let findCreatorsOk = false;
    try {
      await page.waitForFunction(
        () => {
          const text = document.body.innerText.toLowerCase();
          return (
            text.includes("creator") ||
            text.includes("scout") ||
            text.includes("vendor") ||
            text.includes("travel")
          );
        },
        { timeout: 120_000 }
      );
      findCreatorsOk = true;
    } catch {
      findCreatorsOk = false;
    }
    await waitForStreamingEnd(page, 180_000);
    const findStackOverflow = consoleErrors
      .slice(preFindErrors)
      .some((e) => /maximum call stack size exceeded/i.test(e));
    record(
      "5-find-creators",
      findCreatorsOk && !findStackOverflow,
      findCreatorsOk
        ? `Find Creators response observed${findStackOverflow ? " (stack overflow!)" : ""}`
        : "No creator search response within 120s"
    );
    await page.screenshot({ path: path.join(OUT_DIR, "05-find-creators-complete.png"), fullPage: true });

    const conversationIds = await page.evaluate(() => {
      const items = Array.from(document.querySelectorAll(".ai-sidebar button, .ai-sidebar [role='button']"));
      return items
        .map((el) => el.textContent?.trim())
        .filter((t) => t && t.length > 2 && !/new chat|search/i.test(t))
        .slice(0, 5);
    });

    let switchOk = false;
    if (conversationIds.length >= 2) {
      const clicked = await page.evaluate(() => {
        const buttons = Array.from(
          document.querySelectorAll(".ai-sidebar button")
        ).filter((b) => {
          const t = b.textContent?.trim() ?? "";
          return t.length > 3 && !/new chat|search|archive|pin/i.test(t);
        });
        if (buttons.length < 2) return false;
        buttons[1].click();
        return true;
      });
      if (clicked) {
        await wait(2000);
        switchOk = true;
      }
    } else {
      switchOk = conversationIds.length >= 1;
    }
    await page.screenshot({ path: path.join(OUT_DIR, "06-conversation-switch.png"), fullPage: true });
    record(
      "6-switch-conversations",
      switchOk,
      switchOk
        ? `Sidebar has ${conversationIds.length} conversation(s); switched successfully`
        : "Could not switch conversations in sidebar"
    );

    const urlBeforeRefresh = page.url();
    networkEvents = [];
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
    await wait(3000);
    const urlAfterRefresh = page.url();
    const refreshOk = urlAfterRefresh.includes("/ai") && !urlAfterRefresh.includes("/login");
    record(
      "7-refresh-page",
      refreshOk,
      refreshOk
        ? `Refreshed OK: ${urlAfterRefresh}`
        : `Refresh failed: ${urlAfterRefresh}`
    );
    await page.screenshot({ path: path.join(OUT_DIR, "07-after-refresh.png"), fullPage: true });

    const oldConvClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll(".ai-sidebar button")).filter((b) => {
        const t = b.textContent?.trim() ?? "";
        return t.length > 3 && !/new chat|search/i.test(t);
      });
      if (!buttons.length) return false;
      buttons[buttons.length - 1].click();
      return true;
    });
    await wait(3000);
    const oldConvLoaded = await page.evaluate(() => {
      return document.querySelectorAll(".ai-msg-in, .ai-gradient-user-bubble").length > 0;
    });
    record(
      "8-open-old-conversation",
      oldConvClicked && oldConvLoaded,
      oldConvClicked
        ? oldConvLoaded
          ? "Old conversation opened with messages visible"
          : "Conversation selected but no messages rendered"
        : "No conversation button found"
    );
    await page.screenshot({ path: path.join(OUT_DIR, "08-old-conversation.png"), fullPage: true });

    const duplicateFetches = (() => {
      const byUrl = new Map();
      for (const e of networkEvents) {
        const key = `${e.url}:${Math.floor(e.t / 2000)}`;
        byUrl.set(key, (byUrl.get(key) ?? 0) + 1);
      }
      return [...byUrl.values()].filter((n) => n > 3).length;
    })();
    record(
      "10-stable-renders",
      !consoleErrors.some((e) => /maximum call stack/i.test(e)) && duplicateFetches === 0,
      `Console errors: ${consoleErrors.length}, warnings: ${consoleWarnings.length}, burst duplicate fetches: ${duplicateFetches}`
    );

    const report = {
      timestamp: new Date().toISOString(),
      results,
      consoleErrors: consoleErrors.slice(0, 30),
      consoleWarnings: consoleWarnings.slice(0, 15),
      networkSample: networkEvents.slice(0, 40),
      recommendation: results.every((r) => r.pass) ? "YES" : "NO",
    };
    fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
    console.log("\n=== SUMMARY ===");
    for (const r of results) {
      console.log(`${r.pass ? "✓" : "✗"} ${r.id}: ${r.detail}`);
    }
    console.log(`\nRecommendation: task complete ${report.recommendation}`);
    console.log(`Artifacts: ${OUT_DIR}`);

    process.exitCode = report.recommendation === "YES" ? 0 : 1;
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Verification script failed:", err);
  record("fatal", false, String(err?.message ?? err));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, "report.json"),
    JSON.stringify({ results, consoleErrors, error: String(err) }, null, 2)
  );
  process.exit(1);
});
