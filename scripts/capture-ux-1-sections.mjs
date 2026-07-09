import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "docs", "validation-artifacts", "ux-1");

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

const SECTIONS = [
  "Vendor Discovery",
  "Vendor Recommendations",
  "Campaign Summary",
  "Budget Planner",
  "KPI Forecast",
  "Risk Analysis",
  "Thinkway Decision Rationale",
];

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
  await new Promise((r) => setTimeout(r, 10000));

  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const title of SECTIONS) {
    await page.evaluate((t) => {
      const h = [...document.querySelectorAll("h3")].find((x) => x.textContent?.trim() === t);
      h?.scrollIntoView({ block: "center" });
    }, title);
    await new Promise((r) => setTimeout(r, 800));
    const file = `${title.toLowerCase().replace(/\s+/g, "-")}-after.png`;
    await page.screenshot({ path: path.join(OUT_DIR, file) });
    console.log("saved", file);
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
