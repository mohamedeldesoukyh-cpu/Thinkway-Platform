/** Read-only responsive smoke audit. Uses an existing user's login; never edits business data. */
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { createClient } from '@supabase/supabase-js';
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd(), true);
const base = process.env.RESPONSIVE_BASE_URL || 'http://localhost:3000';
const browser = await puppeteer.launch({headless:true, pipe:true, executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const page = await browser.newPage();
await page.setBypassServiceWorker(true);
if(process.env.RESPONSIVE_BYPASS_SECRET) {
  await page.setRequestInterception(true);
  page.on('request', request => request.continue(new URL(request.url()).origin === new URL(base).origin ? {headers:{...request.headers(),'x-vercel-protection-bypass':process.env.RESPONSIVE_BYPASS_SECRET}} : {}));
}
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
    const response=await page.goto(base+route,{waitUntil:'load'});
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
        overflowing:[...document.querySelectorAll('main, [data-dashboard-shell-root], .home-dashboard-suite, .tw-main, .platform-v6-page, header, .home-dashboard-suite .tw-ms2 b, .home-dashboard-suite .tw-jn, .home-dashboard-suite .tw-lr span, .home-dashboard-suite .tw-qd, .home-dashboard-suite .tw-big')].filter(e=>e.clientWidth && e.scrollWidth>e.clientWidth+2).map(e=>({tag:e.tagName,cls:e.className,width:e.clientWidth,scroll:e.scrollWidth})),
      }));
      results.push({route,width,status:response.status(),url:page.url(),...measurement});
      console.log(JSON.stringify({route,width,status:response.status(),overflow:measurement.overflowing}));
      if(width===390 || width===768 || route==='/') await page.screenshot({path:`tmp/responsive/${route.replace(/[^\w-]/g,'_')||'home'}-${width}.png`});
      const home = await page.$('.home-dashboard-suite');
      if(home) {
        const layout = await page.evaluate(() => {
          const root=document.querySelector('.home-dashboard-suite');
          root.scrollTop=0;
          const mast=root.querySelector('.tw-frozen').getBoundingClientRect();
          const content=root.querySelector('.tw-main').getBoundingClientRect();
          return {overlap:mast.bottom>content.top+1,contentWidth:content.width,available:root.clientWidth};
        });
        if(layout.overlap || layout.contentWidth>layout.available+2) throw new Error(`Home overlap or clipped content: ${JSON.stringify(layout)}`);
        await home.evaluate(e=>{e.scrollTop=e.scrollHeight;});
        await new Promise(r=>setTimeout(r,300));
        const reachable=await page.$eval('.home-dashboard-suite',e=>e.scrollTop+e.clientHeight>=e.scrollHeight-2);
        if(!reachable) throw new Error('Home bottom cannot be reached');
        if(width===390 || width===768 || route==='/') await page.screenshot({path:`tmp/responsive/${route.replace(/[^\w-]/g,'_')}-bottom-${width}.png`});
        await home.evaluate(e=>{e.scrollTop=0;});
      }
    }
    if(route===routes[0]) {
      await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
      const trigger=await page.$('[aria-label="Open main navigation"]');
      if(!trigger) throw new Error('Mobile navigation trigger missing (possibly redirected to login).');
      await trigger.click();
      await page.waitForSelector('[role="dialog"]');
      const count=await page.$$eval('[role="dialog"] nav a',els=>els.length);
      if(count<30) throw new Error(`Navigation incomplete: ${count} destinations`);
      const sizes=await page.$$eval('[role="dialog"] nav a',els=>els.map(e=>({height:e.getBoundingClientRect().height,icon:e.querySelector('svg')?.getBoundingClientRect().width})));
      if(sizes.some(s=>s.height<44 || s.height>70 || !s.icon || s.icon>24)) throw new Error(`Navigation rows or icons incorrectly sized: ${JSON.stringify(sizes)}`);
      await page.screenshot({path:'tmp/responsive/navigation-top.png'});
      const last=await page.$('[role="dialog"] nav section:last-child a:last-child');
      await last.evaluate(e=>e.scrollIntoView({block:'center'}));
      const reachable=await last.evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;});
      if(!reachable) throw new Error('Last navigation destination cannot be reached');
      await page.screenshot({path:'tmp/responsive/navigation-bottom.png'});
      await page.type('#mobile-navigation-search','Treasury');
      const filtered=await page.$$eval('[role="dialog"] nav a',els=>els.map(e=>e.textContent));
      if(filtered.length!==1 || !filtered[0].includes('Treasury')) throw new Error('Workspace search failed');
      await page.keyboard.press('Escape');
      await page.waitForSelector('[role="dialog"]',{hidden:true});
      console.log(`Mobile navigation: ${count} correctly sized destinations; last link reachable; search and Escape passed`);
    }
  }
  const report = process.env.RESPONSIVE_REPORT || 'results';
  if(!/^[\w-]+$/.test(report)) throw new Error('Invalid report name');
  fs.writeFileSync(`tmp/responsive/${report}.json`,JSON.stringify({base,results,errors},null,2));
  if(errors.length || results.some(r=>r.status>=400 || r.url.includes('/login') || r.documentWidth>r.width+2 || r.overflowing.length)) process.exitCode=1;
} finally {await browser.close();}

