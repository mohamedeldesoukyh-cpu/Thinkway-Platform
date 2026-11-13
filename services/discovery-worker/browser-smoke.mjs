import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Run in the final Linux image during build. No credentials or network required.
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setContent('<title>Worker browser check</title><main data-views="123">ready</main>');
  assert.equal(await page.title(), 'Worker browser check');
  assert.equal(await page.locator('main').getAttribute('data-views'), '123');
  const screenshot = await page.screenshot();
  assert.ok(screenshot.length > 0);
  console.log('Worker Chromium launch, DOM extraction and screenshot: PASS');
} finally {
  await browser.close();
}
