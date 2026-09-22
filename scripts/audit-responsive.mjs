/** Read-only responsive smoke audit. Uses an existing user's login; never edits business data. */
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { createClient } from '@supabase/supabase-js';
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd(), true);
const base = process.env.RESPONSIVE_BASE_URL || 'http://localhost:3000';
const browser = await puppeteer.launch({headless:true, pipe:true, executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const page = await browser.newPage();
page.setDefaultNavigationTimeout(120000);
await page.evaluateOnNewDocument(()=>{ try { localStorage.setItem('thinkway.pwa.dismissedAt',new Date().toISOString()); } catch {} });
const errors=[];
page.on('pageerror', e=> errors.push(e.message));
try {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const admin=createClient(url,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const client=createClient(url,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:link,error}=await admin.auth.admin.generateLink({type:'magiclink',email:process.env.UX_TEST_EMAIL || 'mohamedeldesouky@thinkwaymedia.com'});
  if(error) throw new Error(error.message);
  const {data:auth,error:authError}=await client.auth.verifyOtp({token_hash:link.properties.hashed_token,type:'email'});
  if(authError) throw new Error(authError.message);
  const name=`sb-${new URL(url).hostname.split('.')[0]}-auth-token`;
  const value=`base64-${Buffer.from(JSON.stringify(auth.session)).toString('base64url')}`;
  await page.setCookie({url:base,name,value,path:'/',secure:base.startsWith('https:'),sameSite:'Lax'});
  const routes=(process.env.RESPONSIVE_ROUTES || '/,/campaigns,/clients,/vendors,/billing,/finance/po-tracker,/discovery/search,/settings/users,/studio').split(',');
  const sizes=process.env.RESPONSIVE_WIDTHS ? process.env.RESPONSIVE_WIDTHS.split(',').map(Number) : [390,768,1024,1440];
  const results=[];
  fs.mkdirSync('tmp/responsive',{recursive:true});
  for(const route of routes) {
    await page.setViewport({width:sizes[0],height:844,isMobile:true,hasTouch:true,deviceScaleFactor:1});
    const response=await page.goto(base+route,{waitUntil:'domcontentloaded'});
    await page.waitForSelector('main, form', {timeout:60000});
    await new Promise(r=>setTimeout(r,1500));
    if(process.env.RESPONSIVE_DETAILS === '1' && ['/campaigns','/clients','/vendors'].includes(route)) {
      const detail=await page.$$eval(`a[href^="${route}/"]`,links=>links.map(a=>a.getAttribute('href')).find(h=>h && !/\/(new|create)(\/|$|\?)/.test(h)));
      if(detail && !routes.includes(detail)) routes.push(detail);
    }
    await page.evaluate(()=>{ [...document.querySelectorAll('button')].find(b=>b.textContent?.trim()==='Maybe Later')?.click(); });
    for(const width of sizes) {
      await page.setViewport({width,height:width>=768?1024:844,isMobile:true,hasTouch:true,deviceScaleFactor:1});
      await new Promise(r=>setTimeout(r,300));
      const measurement=await page.evaluate(()=>({
        title:document.title,
        documentWidth:document.documentElement.scrollWidth,
        viewport:innerWidth,
        overflowing:[...document.querySelectorAll('main, [data-dashboard-shell-root], .tw-main, .platform-v6-page, header')].filter(e=>e.clientWidth && e.scrollWidth>e.clientWidth+2).map(e=>({tag:e.tagName,cls:e.className,width:e.clientWidth,scroll:e.scrollWidth})),
      }));
      results.push({route,width,status:response.status(),url:page.url(),...measurement});
      console.log(JSON.stringify({route,width,status:response.status(),overflow:measurement.overflowing}));
      if(width===390 || width===768) await page.screenshot({path:`tmp/responsive/${route.replace(/[^\w-]/g,'_')||'home'}-${width}.png`});
    }
    if(route===routes[0]) {
      await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
      const trigger=await page.$('[aria-label="Open main navigation"]');
      if(!trigger) throw new Error('Mobile navigation trigger missing (possibly redirected to login).');
      await trigger.click();
      await page.waitForSelector('[role="dialog"]');
      const count=await page.$$eval('[role="dialog"] nav a',els=>els.length);
      if(count<30) throw new Error(`Navigation incomplete: ${count} destinations`);
      await page.type('#mobile-navigation-search','Treasury');
      const filtered=await page.$$eval('[role="dialog"] nav a',els=>els.map(e=>e.textContent));
      if(filtered.length!==1 || !filtered[0].includes('Treasury')) throw new Error('Workspace search failed');
      await page.keyboard.press('Escape');
      await page.waitForSelector('[role="dialog"]',{hidden:true});
      console.log(`Mobile navigation: ${count} destinations, Escape closes drawer`);
    }
  }
  const report = process.env.RESPONSIVE_REPORT || 'results';
  if(!/^[\w-]+$/.test(report)) throw new Error('Invalid report name');
  fs.writeFileSync(`tmp/responsive/${report}.json`,JSON.stringify({base,results,errors},null,2));
  if(errors.length || results.some(r=>r.status>=400 || r.url.includes('/login') || r.documentWidth>r.width+2 || r.overflowing.length)) process.exitCode=1;
} finally {await browser.close();}

