/**
 * Runtime country-flag tracer for Discovery Search.
 *
 * Modes:
 *  1) Offline payload preflight (no browser):
 *       node scripts/trace-discovery-flag-runtime.mjs --offline
 *  2) Live browser (authenticated session / open page):
 *       node scripts/trace-discovery-flag-runtime.mjs --url http://localhost:3000/discovery/search
 *
 * Browser console (manual):
 *       // paste scripts/trace-discovery-flag-runtime.browser.js
 *       await __TW_FLAG_TRACE__.traceVisibleRows()
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import puppeteer from "puppeteer";

const ROOT = process.cwd();
const OUT_DIR = path.join(
  ROOT,
  "docs/validation-artifacts/discovery-release-readiness"
);

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}

loadEnv(path.join(ROOT, ".env.local"));
loadEnv(path.join(ROOT, ".env"));

const args = process.argv.slice(2);
const offline = args.includes("--offline");
const urlArg = args.find((a) => a.startsWith("--url="))?.slice(6) ||
  (args.includes("--url") ? args[args.indexOf("--url") + 1] : null);

function deriveCodes(creator) {
  const codes = [];
  const push = (v) => {
    if (!v) return;
    const n = String(v).trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(n) && !codes.includes(n)) codes.push(n);
  };
  if (Array.isArray(creator.country_codes)) creator.country_codes.forEach(push);
  push(creator.country_code);
  push(creator.estimated_country);
  for (const p of creator.platforms || []) push(p.audience_country);
  return codes;
}

async function offlinePreflight() {
  const { browseUnifiedCreators } = await import(
    pathToFileURL(path.join(ROOT, "lib/creators/unified-browse.ts")).href
  ).catch(async () => {
    // tsx path
    return import("@/lib/creators/unified-browse");
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase env for offline preflight");
  }
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const result = await browseUnifiedCreators(
    supabase,
    { page: 1, pageSize: 50 },
    "flag-runtime-trace"
  );

  const rows = result.creators.map((creator, index) => {
    const countryFlagCodes = deriveCodes(creator);
    return {
      virtualRowIndex: index,
      virtualItemKey: creator.unified_id,
      creatorId: creator.influencer_id,
      creatorUnifiedId: creator.unified_id,
      displayName: creator.display_name,
      countryFlagCodes,
      country_codes: creator.country_codes ?? null,
      country_code: creator.country_code ?? null,
      audience_country: (creator.platforms || []).map((p) => p.audience_country),
      expectedCountryFlagsStackProps: {
        countryCodes: countryFlagCodes,
        size: "md",
        overlay: true,
        className: "size-full",
      },
      expectedDomHasFlagSlot: countryFlagCodes.length > 0,
      classification:
        countryFlagCodes.length === 0
          ? "empty_props"
          : "expect_flag_dom_in_discovery_search",
    };
  });

  const empty = rows.filter((r) => r.classification === "empty_props");
  const expectFlag = rows.filter((r) => r.expectedDomHasFlagSlot);

  const report = {
    mode: "offline_payload_preflight",
    measuredAt: new Date().toISOString(),
    note:
      "Offline mode cannot see React virtualization or live DOM. Use --url or browser paste for divergence vs Puppeteer probe.",
    probeBaseline: {
      source: "flag-render-probe-full-chain",
      expectsFlagDom: true,
      countryFlagCodes: ["EG"],
    },
    summary: {
      creators: rows.length,
      emptyCountryProps: empty.length,
      expectFlagDom: expectFlag.length,
    },
    firstEmptyPropsExample: empty[0] ?? null,
    firstExpectFlagExample: expectFlag[0] ?? null,
    // Candidate "user reports missing flag but props should be full"
    candidatesForLiveDomCheck: expectFlag.slice(0, 5),
    rows,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, "flag-runtime-trace-offline.json");
  fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nWrote ${out}`);
  return report;
}

async function liveBrowserTrace(pageUrl) {
  const tracerSrc = fs.readFileSync(
    path.join(ROOT, "scripts/trace-discovery-flag-runtime.browser.js"),
    "utf8"
  );

  const browser = await puppeteer.launch({
    headless: false,
    executablePath:
      process.env.PUPPETEER_EXECUTABLE_PATH ||
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: ["--no-sandbox"],
    defaultViewport: { width: 1440, height: 900 },
  });

  const page = await browser.newPage();
  await page.goto(pageUrl, { waitUntil: "networkidle2", timeout: 120000 });

  // Wait for either login or results
  await page
    .waitForSelector(".discovery-search-exact-row, input[type='email'], form", {
      timeout: 60000,
    })
    .catch(() => null);

  const hasRows = (await page.$(".discovery-search-exact-row")) != null;
  if (!hasRows) {
    const report = {
      mode: "live_browser",
      error:
        "No .discovery-search-exact-row found. Authenticate in the opened browser, load Discovery Search results, then re-run or paste the browser tracer.",
      url: pageUrl,
      pageTitle: await page.title(),
    };
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const out = path.join(OUT_DIR, "flag-runtime-trace-live.json");
    fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
    console.log(
      "Browser left open for login. After results load, DevTools → paste scripts/trace-discovery-flag-runtime.browser.js"
    );
    return report;
  }

  await page.addScriptTag({ content: tracerSrc });
  const report = await page.evaluate(async () => {
    return window.__TW_FLAG_TRACE__.traceVisibleRows();
  });

  report.mode = "live_browser";
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, "flag-runtime-trace-live.json");
  fs.writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  console.log(`\nWrote ${out}`);
  await browser.close();
  return report;
}

async function main() {
  if (offline || !urlArg) {
    if (!urlArg) {
      console.log("No --url provided; running offline payload preflight first.\n");
    }
    await offlinePreflight();
    if (!urlArg) {
      console.log(
        "\nNext: open Discovery Search, paste scripts/trace-discovery-flag-runtime.browser.js, then:\n  await __TW_FLAG_TRACE__.traceRowAtPoint()\n"
      );
      return;
    }
  }
  await liveBrowserTrace(urlArg);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
