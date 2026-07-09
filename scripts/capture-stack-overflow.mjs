/**
 * Capture full browser stack trace for AI workspace stack overflow.
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

const exceptions = [];
const pageErrors = [];
const consoleMessages = [];

function formatStackTrace(stackTrace) {
  if (!stackTrace?.callFrames) return "";
  return stackTrace.callFrames
    .map((f) => {
      const loc = f.url ? `${f.url}:${f.lineNumber}:${f.columnNumber}` : "<unknown>";
      return `    at ${f.functionName || "(anonymous)"} (${loc})`;
    })
    .join("\n");
}

function findFirstRepeatedFrame(stackTrace) {
  if (!stackTrace?.callFrames?.length) return null;
  const names = stackTrace.callFrames.map((f) => f.functionName || "(anonymous)");
  const seen = new Map();
  for (let i = 0; i < names.length; i++) {
    const key = `${names[i]}@${stackTrace.callFrames[i].url}:${stackTrace.callFrames[i].lineNumber}`;
    if (seen.has(key)) {
      return {
        index: i,
        firstIndex: seen.get(key),
        functionName: names[i],
        url: stackTrace.callFrames[i].url,
        lineNumber: stackTrace.callFrames[i].lineNumber,
        columnNumber: stackTrace.callFrames[i].columnNumber,
      };
    }
    seen.set(key, i);
  }
  return null;
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
  const client = await page.createCDPSession();
  await client.send("Runtime.enable");

  client.on("Runtime.exceptionThrown", (params) => {
    const { exceptionDetails } = params;
    const text = exceptionDetails.exception?.description ?? exceptionDetails.text;
    const stack = formatStackTrace(exceptionDetails.stackTrace);
    const repeated = findFirstRepeatedFrame(exceptionDetails.stackTrace);
    exceptions.push({ source: "CDP", text, stack, repeated, raw: exceptionDetails });
    console.log("\n=== CDP Runtime.exceptionThrown ===");
    console.log(text);
    console.log(stack);
    if (repeated) {
      console.log(
        `\n>>> FIRST REPEATED FRAME: ${repeated.functionName} @ ${repeated.url}:${repeated.lineNumber}`
      );
    }
  });

  page.on("pageerror", (err) => {
    const entry = { source: "pageerror", message: err.message, stack: err.stack };
    pageErrors.push(entry);
    console.log("\n=== page.on('pageerror') ===");
    console.log(err.message);
    console.log(err.stack);
  });

  page.on("console", async (msg) => {
    const text = msg.text();
    const type = msg.type();
    let stack = "";
    try {
      const args = msg.args();
      if (args.length > 0) {
        const props = await Promise.all(
          args.map((a) =>
            a.jsonValue().catch(() => null)
          )
        );
        stack = JSON.stringify(props);
      }
    } catch {
      // ignore
    }
    consoleMessages.push({ type, text, stack });
    if (type === "error" || /maximum call stack/i.test(text)) {
      console.log(`\n=== console.${type} ===`);
      console.log(text);
      const trace = msg.stackTrace?.();
      if (trace) {
        console.log(
          trace
            .map((f) => `    at ${f.url}:${f.lineNumber}:${f.columnNumber}`)
            .join("\n")
        );
      }
    }
  });

  await applySessionCookies(page, session, projectRef);
  await page.goto(`${BASE_URL}/ai`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await wait(2000);

  console.log(`\nLoaded: ${page.url()}`);

  const textarea = await page.waitForSelector("textarea", { timeout: 30_000 });
  await textarea.click({ clickCount: 3 });
  await page.keyboard.press("Backspace");
  await textarea.type(BABYJOY_MSG, { delay: 5 });
  const sendBtn = await page.waitForSelector('button[aria-label="Send message"]:not([disabled])', {
    timeout: 10_000,
  });
  await sendBtn.click();

  console.log("\nBabyJoy message sent, waiting for stack overflow...");

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const hasOverflow =
      exceptions.some((e) => /maximum call stack/i.test(e.text)) ||
      pageErrors.some((e) => /maximum call stack/i.test(e.message)) ||
      consoleMessages.some((e) => /maximum call stack/i.test(e.text));
    if (hasOverflow) break;
    await wait(500);
  }

  await wait(3000);
  const domError = await page.evaluate(() => {
    const errEl = document.querySelector(".text-destructive");
    return errEl?.textContent?.trim() ?? "";
  });

  if (domError) {
    console.log("\n=== DOM ERROR (AiChatInput) ===");
    console.log(domError);
  }

  const overlayText = await page.evaluate(() => {
    const overlay = document.querySelector("nextjs-portal, [data-nextjs-dialog]");
    return overlay?.textContent ?? document.body.innerText.slice(0, 2000);
  });

  const report = {
    timestamp: new Date().toISOString(),
    url: page.url(),
    exceptions,
    pageErrors,
    overflowConsole: consoleMessages.filter((m) => /maximum call stack|error/i.test(m.text)),
    overlayText: overlayText.slice(0, 3000),
  };

  fs.writeFileSync(path.join(OUT_DIR, "stack-trace-report.json"), JSON.stringify(report, null, 2));
  console.log(`\nReport written to ${path.join(OUT_DIR, "stack-trace-report.json")}`);

  await browser.close();
}

main().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
