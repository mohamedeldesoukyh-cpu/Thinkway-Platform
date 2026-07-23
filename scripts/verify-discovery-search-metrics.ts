/** Verify /discovery/search compiles and renders metrics (no "—" regression). */
import fs from "node:fs";

import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";

function loadEnv(path: string) {
  if (!fs.existsSync(path)) return;
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv(".env.local");
loadEnv(".env");

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const ref = new URL(url).hostname.split(".")[0];

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: "mohamedeldesouky@thinkwaymedia.com",
  });
  if (linkError) throw new Error(linkError.message);
  const { data, error: otpError } = await anon.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "email",
  });
  if (otpError) throw new Error(otpError.message);

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1100 });
  const encoded =
    "base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64url");
  await page.setCookie({
    name: `sb-${ref}-auth-token`,
    value: encoded,
    domain: "localhost",
    path: "/",
  });
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));

  await page.goto("http://localhost:3000/discovery/search", {
    waitUntil: "networkidle2",
    timeout: 180_000,
  });
  await new Promise((r) => setTimeout(r, 12_000));

  const report = await page.evaluate(() => {
    const rows = [...document.querySelectorAll(".discovery-search-exact-row")];
    const summary = rows.slice(0, 12).map((row) => {
      const name =
        row.querySelector(".discovery-search-exact-name")?.textContent?.trim() ?? "";
      const stats = [...row.querySelectorAll(".discovery-search-exact-stat-value")].map(
        (el) => el.textContent?.trim() ?? ""
      );
      return { name, stats };
    });
    const dashCount = summary.reduce(
      (acc, row) => acc + row.stats.filter((s) => s === "—").length,
      0
    );
    return { url: location.pathname, rowCount: rows.length, dashCount, summary };
  });
  console.log(JSON.stringify(report, null, 2));

  fs.mkdirSync("docs/validation-artifacts/discovery-metrics-recovery", { recursive: true });
  await page.screenshot({
    path: "docs/validation-artifacts/discovery-metrics-recovery/discovery-search-after-fix.png",
    fullPage: false,
  });
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
