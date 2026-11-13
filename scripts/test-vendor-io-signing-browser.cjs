/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS validation script. */
// Real React signing form in Chromium; submission is intercepted, never sent.
const { build } = require('esbuild');
const puppeteer = require('puppeteer-core');
const assert = require('node:assert/strict');
const { existsSync } = require('node:fs');
(async () => {
  const bundle = await build({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {VendorIoSigningForm} from './features/io/components/vendor-io-signing-form'; createRoot(document.getElementById('root')).render(<VendorIoSigningForm token="synthetic-token-1234" documentHash={'a'.repeat(64)}/>);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'browser', define: { 'process.env.NODE_ENV': '"test"' }, plugins: [{ name: 'no-server', setup(b) {
    b.onResolve({ filter: /sign-vendor-io-action$/ }, () => ({ path: 'action', namespace: 'test' }));
    b.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: `export async function signVendorIoAction(input) { window.signingCalls = [...(window.signingCalls || []), input]; if (!window.signingSuccess) throw new Error('offline'); return {ok:true,message:'Signed copy ready',downloadUrl:'https://example.invalid/signed.pdf'}; }` }));
  } }] });
  const executablePath = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
  assert.ok(executablePath, 'Local browser required');
  const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
  try {
    for (const mobile of [false, true]) {
      const page = await browser.newPage();
      await page.setViewport({ width: mobile ? 390 : 1000, height: 844, isMobile: mobile, hasTouch: mobile });
      await page.setContent('<meta name="viewport" content="width=device-width, initial-scale=1"><style>canvas{width:100%;max-width:600px;touch-action:none}input{display:block}body{margin:16px}</style><div id="root"></div>');
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      await page.waitForSelector('canvas');
      assert.equal(await page.$eval('button[type=submit]', e => e.disabled), true);
      await page.type('#signer-name', 'Synthetic Creator');
      assert.equal(await page.$eval('button[type=submit]', e => e.disabled), true);
      const canvas = await page.$('canvas'); const box = await canvas.boundingBox();
      const x = box.x + 20, y = box.y + 25;
      if (mobile) {
        const client = await page.createCDPSession();
        await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{x,y}] });
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{x:x+75,y:y+25}] });
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{x:x+130,y:y+5}] });
        await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await page.mouse.move(x,y); await page.mouse.down(); await page.mouse.move(x+90,y+30,{steps:8}); await page.mouse.move(x+160,y+5,{steps:8}); await page.mouse.up();
      }
      await page.waitForFunction(() => !document.querySelector('button[type=submit]').disabled);
      const signatureBefore = await page.$eval('canvas', c => c.toDataURL());
      await page.click('button[type=submit]'); await page.waitForSelector('[role=alert]');
      assert.equal(await page.$eval('#signer-name', e => e.value), 'Synthetic Creator');
      assert.equal(await page.$eval('canvas', c => c.toDataURL()), signatureBefore);
      await page.evaluate(() => { window.signingSuccess = true; });
      await page.click('button[type=submit]'); await page.waitForSelector('[role=status] a');
      assert.equal(await page.$eval('[role=status] a', a => a.href), 'https://example.invalid/signed.pdf');
      const calls = await page.evaluate(() => window.signingCalls);
      assert.equal(calls.length, 2); assert.deepEqual(calls[0], calls[1]); assert.ok(calls[0].strokes[0].length > 1);
      console.log(`PASS ${mobile ? 'mobile touch' : 'desktop mouse'}: validation, drawing, failure retains signature, retry, signed PDF link`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
