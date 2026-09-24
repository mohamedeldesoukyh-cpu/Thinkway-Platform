/** Headless component regression. Server action is mocked; no database or email writes. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";
import puppeteer from "puppeteer-core";

const root = process.cwd();
const output = path.join(root, "tmp", "vendor-io-terms-ui");
fs.mkdirSync(output, { recursive: true });
const bundle = await build({
  stdin: {
    contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
      import {VendorIoCampaignTermsEditor} from './features/io/components/vendor-io-campaign-terms-editor';
      const row={id:'00000000-0000-4000-8000-000000000001',campaign_header_id:'00000000-0000-4000-8000-000000000002',
        updated_at:'2026-09-24T12:00:00+00:00',influencer_name:'themiladsalami',document_number:'VIO-TEST',campaign_name:'Campaign terms preview',
        usage_rights:null,special_payment_terms:null,compliance_country_code:null,creator_country_code:'AE',
        vendor_payment_terms_label:'Net 30 Days from Invoice',effective_payment_terms_label:'Net 30 Days from Invoice'};
      createRoot(document.getElementById('root')).render(<main className='p-8'><h1 className='mb-4 text-xl font-semibold'>Vendor IO campaign terms</h1>
        <div className='grid gap-4 md:grid-cols-3'>{['payment','usage','country'].map(field=><VendorIoCampaignTermsEditor key={field} row={row} field={field}/>)}</div></main>);`,
    resolveDir: root, loader: "tsx",
  },
  bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic",
  define: { "process.env.NODE_ENV": '"development"' },
  plugins: [{ name: "mock-io-action", setup(b) {
    b.onResolve({ filter: /next\/navigation$/ }, () => ({ path: "navigation", namespace: "mock" }));
    b.onResolve({ filter: /update-vendor-io-campaign-terms-action$/ }, () => ({ path: "action", namespace: "mock" }));
    b.onLoad({ filter: /.*/, namespace: "mock" }, args => ({ contents: args.path === "navigation"
      ? "export const useRouter=()=>({refresh(){}});"
      : "export async function updateVendorIoCampaignTermsAction(input){window.__saved=input;return window.__fail?{ok:false,message:'Refresh and try again.'}:{ok:true,message:'Saved'};}" }));
  }}],
});

function collectCss(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const file = path.join(dir, e.name);
    return e.isDirectory() ? collectCss(file) : e.name.endsWith(".css") ? [file] : [];
  });
}
const css = collectCss(path.join(root, ".next", "static")).map(f=>fs.readFileSync(f,"utf8")).join("\n");
const executablePath = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"].find(p=>p && fs.existsSync(p));
if (!executablePath) throw new Error("Chrome or Edge required");
const browser = await puppeteer.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.setViewport({ width: 1200, height: 900 });
  await page.setContent(`<html><head><style>${css}</style></head><body><div id="root"></div></body></html>`);
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await page.waitForSelector('button[aria-label^="Edit payment"]');
  await page.click('button[aria-label^="Edit payment"]');
  await page.waitForSelector('[role="dialog"]');
  assert.equal(await page.$eval('select[id^="country-"]', e => e.value), "");
  assert.match(await page.$eval('select[id^="country-"] option', e => e.textContent), /United Arab Emirates/);
  await page.select('select[id^="payment-"]', "custom");
  assert.equal(await page.$eval('button[type="submit"]', e => e.disabled), true);
  await page.type('textarea[id^="usage-"]', "30 days from first publication");
  await page.type('textarea[id^="manual-payment-"]', "50% advance, 50% after approval");
  await page.select('select[id^="country-"]', "EG");
  await page.screenshot({ path: path.join(output, "desktop.png"), fullPage: true });
  await page.setViewport({ width: 375, height: 812 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await page.screenshot({ path: path.join(output, "mobile.png"), fullPage: true });
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => window.__saved && !document.querySelector('[role="dialog"]'));
  const saved = await page.evaluate(() => window.__saved);
  assert.equal(saved.campaign_header_id, "00000000-0000-4000-8000-000000000002");
  assert.equal(saved.usage_rights, "30 days from first publication");
  assert.equal(saved.special_payment_terms, "50% advance, 50% after approval");
  assert.equal(saved.compliance_country_code, "EG");
  await page.click('button[aria-label^="Edit usage"]');
  await page.waitForSelector('[role="dialog"]');
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
  await page.click('button[aria-label^="Edit payment"]');
  await page.waitForSelector('[role="dialog"]');
  await page.evaluate(() => { window.__fail = true; });
  await page.click('button[type="submit"]');
  await page.waitForSelector('[role="alert"]');
  assert.match(await page.$eval('[role="alert"]', e => e.textContent), /Refresh/);
  assert.deepEqual(errors, []);
  console.log("PASS: presets/manual input, CRM country default, IO-scoped save, mobile width, Escape and save error");
} finally { await browser.close(); }
