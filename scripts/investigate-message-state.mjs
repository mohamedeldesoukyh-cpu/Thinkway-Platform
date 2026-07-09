/**
 * Focused BabyJoy run to capture [message-state] console logs.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(
  ROOT,
  "docs",
  "validation-artifacts",
  "message-state-investigation"
);
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
      return Boolean(btn?.hasAttribute("disabled"));
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

  const messageStateLogs = [];
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
    if (text.includes("[message-state]")) {
      messageStateLogs.push({ t: Date.now(), type: msg.type(), text });
      console.log(`[CAPTURE] ${text.slice(0, 200)}`);
    }
  });

  await page.evaluateOnNewDocument(() => {
    window.__messageStateCapture = [];
    const orig = console.log;
    console.log = (...args) => {
      const text = args.map(String).join(" ");
      if (text.includes("[message-state]")) {
        window.__messageStateCapture.push(text);
      }
      return orig.apply(console, args);
    };
  });

  try {
    await applySessionCookies(page, session, projectRef);
    await page.goto(`${BASE_URL}/ai`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await wait(2000);

    // First message to establish conversation with 2 persisted messages
    await sendChatMessage(page, BABYJOY_MSG);
    await waitForStreamingEnd(page, 180_000);
    await wait(3000);

    const existingConvId = await page.evaluate(() => {
      const m = window.location.pathname.match(/\/ai\/([0-9a-f-]{36})/i);
      return m?.[1] ?? null;
    });
    console.log(`Existing conversation: ${existingConvId}`);

    // Navigate to conversation URL (fresh mount, loadConversation loads 2 messages)
    if (existingConvId) {
      await page.goto(`${BASE_URL}/ai/${existingConvId}`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await wait(3000);
    }

    messageStateLogs.length = 0; // reset for second send capture
    console.log("\n--- Second send on loaded conversation ---\n");

    await sendChatMessage(page, BABYJOY_MSG);

    try {
      await page.waitForFunction(
        () => /campaign studio/i.test(document.body.innerText),
        { timeout: 120_000 }
      );
      console.log("Campaign Studio appeared");
    } catch {
      console.log("Campaign Studio did not appear within 120s");
    }

    await waitForStreamingEnd(page, 180_000);
    await wait(3000);

    const preReloadLogs = messageStateLogs.length;
    const convId = await page.evaluate(() => {
      const m = window.location.pathname.match(/\/ai\/([0-9a-f-]{36})/i);
      return m?.[1] ?? null;
    });

    if (convId) {
      const apiMessages = await page.evaluate(async (id) => {
        const res = await fetch(`/api/ai/conversations/${id}`);
        if (!res.ok) return { error: res.status, count: 0 };
        const data = await res.json();
        const msgs = data.conversation?.messages ?? [];
        return {
          count: msgs.length,
          roles: msgs.map((m) => m.role),
        };
      }, convId);
      console.log(`API messages before reload: ${JSON.stringify(apiMessages)}`);
    }

    await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
    await wait(5000);

    const regressionLogs = messageStateLogs.filter((l) =>
      /REGRESSION|before: [2-9]\nafter: 1|before: \d+\nafter: 1/.test(l.text)
    );

    const setMessagesLogs = messageStateLogs.filter((l) =>
      l.text.includes("setMessages")
    );

    const report = {
      timestamp: new Date().toISOString(),
      conversationId: convId,
      totalLogs: messageStateLogs.length,
      logsAfterReload: messageStateLogs.length - preReloadLogs,
      setMessagesCallCount: setMessagesLogs.length,
      regressionLogs,
      dropToOneLogs: setMessagesLogs.filter((l) => {
        const m = l.text.match(/before: (\d+)\nafter: (\d+)/);
        return m && Number(m[1]) >= 2 && Number(m[2]) === 1;
      }),
      allSetMessagesLogs: setMessagesLogs.map((l) => l.text),
      fullTimeline: messageStateLogs.map((l) => l.text),
    };

    fs.writeFileSync(
      path.join(OUT_DIR, "message-state-report.json"),
      JSON.stringify(report, null, 2)
    );

    console.log("\n=== MESSAGE STATE SUMMARY ===");
    console.log(`Total [message-state] logs: ${messageStateLogs.length}`);
    console.log(`setMessages calls: ${setMessagesLogs.length}`);
    console.log(`Regression warnings: ${regressionLogs.length}`);

    for (const log of setMessagesLogs) {
      const match = log.text.match(/before: (\d+)\nafter: (\d+)\ncaller: (\S+)/);
      if (match) {
        console.log(`  ${match[3]}: ${match[1]} → ${match[2]}`);
      }
    }

    if (regressionLogs.length > 0) {
      console.log("\n*** FIRST REGRESSION ***");
      console.log(regressionLogs[0].text);
    }

    console.log(`\nReport: ${path.join(OUT_DIR, "message-state-report.json")}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("Investigation script failed:", err);
  process.exit(1);
});
