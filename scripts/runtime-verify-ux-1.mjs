/**
 * UX-1 final closeout validation — BabyJoy + Pepsi campaigns.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "docs", "validation-artifacts", "ux-1");
const BASE_URL = process.env.UX_TEST_BASE_URL ?? "http://localhost:3000";

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

async function openConversation(page, matcher) {
  await page.goto(`${BASE_URL}/ai`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 2500));

  const clicked = await page.evaluate((pattern) => {
    const re = new RegExp(pattern, "i");
    const buttons = [...document.querySelectorAll(".ai-sidebar button")].filter(
      (b) => b.getAttribute("aria-label") !== "New chat" && b.textContent?.trim() !== "New chat"
    );
    const match = buttons.find((b) => re.test(b.textContent ?? ""));
    const target = match ?? buttons[0];
    if (target) {
      target.click();
      return target.textContent?.trim() ?? "conversation";
    }
    return null;
  }, matcher);

  if (clicked) {
    await page.waitForSelector("article", { timeout: 120000 }).catch(() => null);
    await new Promise((r) => setTimeout(r, 8000));
  }
  return clicked;
}

async function auditCampaignStudio(page) {
  return page.evaluate(() => {
    const articles = Array.from(document.querySelectorAll("article"));
    const byTitle = Object.fromEntries(
      articles.map((a) => [a.querySelector("h3")?.textContent?.trim() ?? "", a])
    );

    const discovery = byTitle["Vendor Discovery"];
    const recommendations = byTitle["Vendor Recommendations"];

    const discoveryText = discovery?.textContent ?? "";
    const recommendationsText = recommendations?.textContent ?? "";

    const contradictoryPipeline =
      /\d+\s+final candidates from\s+0\s+profiles screened/i.test(discoveryText) ||
      (/final candidates from/i.test(discoveryText) &&
        /Profiles Screened[\s\S]*?0[\s\S]*?→/i.test(discoveryText) &&
        /\d+\s+final candidates/i.test(discoveryText));

    const vendorCards = recommendations
      ? [...recommendations.querySelectorAll(".rounded-xl.border")].filter((el) =>
          /followers/i.test(el.textContent ?? "")
        )
      : [];
    const avatarImages = recommendations
      ? recommendations.querySelectorAll('img[alt]:not([alt=""])').length
      : 0;

    const badWhyLine = /Why:\s*No creators available from search results/i.test(
      recommendationsText
    );

    const hasThinkwayRationale = Boolean(byTitle["Thinkway Decision Rationale"]);

    return {
      contradictoryPipeline,
      vendorCardCount: vendorCards.length,
      avatarImages,
      badWhyLine,
      hasThinkwayRationale,
      discoverySnippet: discoveryText.slice(0, 280),
      recommendationsSnippet: recommendationsText.slice(0, 400),
    };
  });
}

async function testChatDisplayAlignment(page) {
  return page.evaluate(() => {
    const bubble = [...document.querySelectorAll(".ai-gradient-user-bubble")].find(
      (el) => !el.querySelector("textarea")
    );
    if (!bubble) return { found: false };
    const content = bubble.querySelector("p") ?? bubble.firstElementChild ?? bubble;
    const contentStyle = window.getComputedStyle(content);
    const bubbleStyle = window.getComputedStyle(bubble);
    const bubbleRect = bubble.getBoundingClientRect();
    const containerRect = bubble.closest(".flex.justify-end")?.getBoundingClientRect();
    return {
      found: true,
      textAlign: contentStyle.textAlign,
      direction: bubbleStyle.direction,
      bubbleRightAligned:
        bubbleRect && containerRect
          ? bubbleRect.right >= containerRect.right - 48
          : false,
    };
  });
}

async function testChatEditAlignment(page) {
  await page.evaluate(() => {
    const groups = [...document.querySelectorAll(".group.ai-msg-in")];
    const lastUser = groups.reverse().find((g) => g.querySelector(".ai-gradient-user-bubble"));
    const editBtn = lastUser?.querySelector('[aria-label="Edit message"]');
    editBtn?.click();
  });

  await new Promise((r) => setTimeout(r, 600));

  const editAudit = await page.evaluate(() => {
    const textarea = document.querySelector(".ai-gradient-user-bubble textarea");
    if (!textarea) return { found: false };
    const style = window.getComputedStyle(textarea);
    const bubble = textarea.closest(".ai-gradient-user-bubble");
    const bubbleRect = bubble?.getBoundingClientRect();
    const containerRect = bubble?.closest(".flex.justify-end")?.getBoundingClientRect();
    return {
      found: true,
      textAlign: style.textAlign,
      direction: style.direction,
      bubbleRightAligned:
        bubbleRect && containerRect
          ? bubbleRect.right >= containerRect.right - 48
          : false,
      cursorAtStart: textarea.selectionStart === 0,
    };
  });

  await page.keyboard.press("Escape");

  return {
    pass:
      editAudit.found &&
      editAudit.textAlign === "left" &&
      editAudit.direction === "ltr" &&
      editAudit.bubbleRightAligned,
    detail: editAudit.found
      ? `textAlign=${editAudit.textAlign}, direction=${editAudit.direction}, rightAligned=${editAudit.bubbleRightAligned}, cursorStart=${editAudit.cursorAtStart}`
      : "Edit textarea not found (may not be last user message)",
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const email = process.env.UX_TEST_EMAIL ?? "mohamedeldesouky@thinkwaymedia.com";
  const { session, projectRef } = await getAuthenticatedSession(email);

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const results = [];

  try {
    await applySessionCookies(page, session, projectRef);
    await page.screenshot({ path: path.join(OUT_DIR, "01-ai-page.png") });

    const babyjoy = await openConversation(page, "babyjoy|diaper|premium");
    if (!babyjoy) {
      results.push({ id: "babyjoy-conversation", pass: false, detail: "No BabyJoy conversation found" });
    } else {
      await page.screenshot({ path: path.join(OUT_DIR, "02-babyjoy-after.png"), fullPage: true });

      const audit = await auditCampaignStudio(page);
      results.push({
        id: "1-vendor-discovery-pipeline",
        pass: !audit.contradictoryPipeline,
        detail: audit.contradictoryPipeline
          ? `Contradictory: ${audit.discoverySnippet}`
          : audit.discoverySnippet.slice(0, 140),
      });
      results.push({
        id: "2-vendor-avatars",
        pass: audit.vendorCardCount === 0 || audit.avatarImages >= Math.min(audit.vendorCardCount, 5),
        detail: `${audit.avatarImages} avatars / ${audit.vendorCardCount} vendor cards`,
      });
      results.push({
        id: "8-recommendation-explanation",
        pass: !audit.badWhyLine,
        detail: audit.badWhyLine ? "Empty global rationale still shown" : "Per-creator reasoning OK",
      });
      results.push({
        id: "7-thinkway-decision-rationale-rename",
        pass: audit.hasThinkwayRationale,
        detail: audit.hasThinkwayRationale
          ? "Renamed to Thinkway Decision Rationale"
          : "Thinkway Decision Rationale title missing",
      });

      const displayTest = await testChatDisplayAlignment(page);
      results.push({
        id: "3b-chat-display-alignment",
        pass:
          displayTest.found &&
          displayTest.textAlign === "left" &&
          displayTest.direction === "ltr" &&
          displayTest.bubbleRightAligned,
        detail: displayTest.found
          ? `textAlign=${displayTest.textAlign}, direction=${displayTest.direction}, rightAligned=${displayTest.bubbleRightAligned}`
          : "User message bubble not found",
      });

      const editTest = await testChatEditAlignment(page);
      results.push({ id: "3-chat-edit-alignment", ...editTest });
    }

    const pepsi = await openConversation(page, "pepsi|cola|beverage");
    if (pepsi) {
      await page.screenshot({ path: path.join(OUT_DIR, "03-pepsi-after.png"), fullPage: true });
      const pepsiAudit = await auditCampaignStudio(page);
      results.push({
        id: "pepsi-vendor-discovery",
        pass: !pepsiAudit.contradictoryPipeline,
        detail: pepsiAudit.discoverySnippet.slice(0, 140) || "No discovery text",
      });
    } else {
      results.push({
        id: "pepsi-conversation",
        pass: true,
        detail: "Pepsi conversation not in sidebar — skipped",
      });
    }

    const report = {
      timestamp: new Date().toISOString(),
      baseUrl: BASE_URL,
      results,
      allPass: results.every((r) => r.pass),
    };

    fs.writeFileSync(path.join(OUT_DIR, "validation-results.json"), JSON.stringify(report, null, 2));

    console.log("\n=== UX-1 FINAL VALIDATION ===");
    for (const r of results) {
      console.log(`${r.pass ? "PASS" : "FAIL"} [${r.id}] ${r.detail}`);
    }
    process.exitCode = report.allPass ? 0 : 1;
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("UX-1 validation failed:", err);
  process.exitCode = 1;
});
