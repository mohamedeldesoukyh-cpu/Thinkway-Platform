// Controlled browser verification of the real queue component. Backend accounting
// is independently exercised by test-tw-accounting-media-posting.sql on Dev.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
const require=createRequire(import.meta.url);
const {chromium}=require('C:/thinkway-platform/services/discovery-worker/node_modules/playwright');
const root=process.cwd(),out=path.join(root,'.tmp/media-posting-ui');fs.mkdirSync(out,{recursive:true});
const entry=`import React from 'react';import{createRoot}from'react-dom/client';import{PostingPageHeader}from ${JSON.stringify(path.join(root,'features/finance/posting-center/components/posting-page-header.tsx'))};import{AccountingPostingQueue}from ${JSON.stringify(path.join(root,'features/finance/posting-center/components/accounting-posting-queue.tsx'))};createRoot(document.getElementById('root')).render(<><PostingPageHeader/><AccountingPostingQueue company="11111111-1111-4111-8111-111111111111" manage={true} today="2026-11-22"/></>);`;
fs.writeFileSync(path.join(out,'entry.tsx'),entry);
await build({entryPoints:[path.join(out,'entry.tsx')],bundle:true,outfile:path.join(out,'app.js'),platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env':'{}'}});
const calls=[],posted=new Set();let failSecond=true;
const css=fs.readdirSync('.next/static/chunks').filter(f=>f.endsWith('.css')).map(f=>fs.readFileSync('.next/static/chunks/'+f,'utf8')).join('\n');
const server=http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1');
 if(url.pathname==='/'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><html><head><link rel="stylesheet" href="/style.css"></head><body class="finance-suite" style="padding:24px;font-family:Arial,sans-serif"><div id="root"></div><script src="/app.js"></script></body></html>');}
 if(url.pathname==='/style.css'){res.setHeader('Content-Type','text/css');return res.end(css);}
 if(url.pathname==='/app.js'){res.setHeader('Content-Type','text/javascript');return res.end(fs.readFileSync(path.join(out,'app.js')));}
 if(url.pathname!=='/api/accounting/media-posting'){res.statusCode=404;return res.end();}
 res.setHeader('Content-Type','application/json');
 if(req.method==='GET'){
  if(url.searchParams.get('mode')==='allocations')return res.end(JSON.stringify({note:{number:'QA-1',currency:'EGP',total:'1140',version:1,invoice:'inv-1'},invoices:[{id:'inv-1',number:'INV-1',date:'2026-11-20',total:'2000',paid:'100',outstanding:'1900',allocated:'0',locked:false}]}));
  const kind=url.searchParams.get('type');calls.push({method:'GET',kind});
  const rows=[1,2].map(n=>({id:String(n),type:kind==='cost'?'supplier_invoice':kind,number:'QA-'+n,date:'2026-11-22',party:'Isolated browser fixture',campaign:'Summer campaign',code:'100'+n,currency:'EGP',net:'1000',tax:'140',total:'1140',eligible:true,reason:'',status:posted.has(String(n))?'posted':'unposted',token:'test-preview',version:1,journal:posted.has(String(n))?'22222222-2222-4222-8222-222222222222':null,accruals:[]})).filter(r=>(r.status==='posted')===(url.searchParams.get('posted')==='true'));
  return res.end(JSON.stringify({rows,count:rows.length,more:false}));
 }
 let body='';for await(const chunk of req)body+=chunk;const v=JSON.parse(body);calls.push({method:'POST',...v});
 if(v.id==='2'&&failSecond){res.statusCode=409;return res.end(JSON.stringify({error:'Document changed. Browse again.'}));}
 if(v.operation==='allocate')return res.end(JSON.stringify({saved:true}));
 if(v.operation==='post')posted.add(v.id);else posted.delete(v.id);res.end(JSON.stringify({journal:'22222222-2222-4222-8222-222222222222'}));
 }catch(e){res.statusCode=500;res.end(JSON.stringify({error:e.message}));}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('Browser error: '+e.message);});
const evidence={method:'Real React component, controlled HTTP responses; Dev SQL fixture validates financial operations',checks:[]};
try{
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForTimeout(1000);if(errors.length)throw Error(errors.join('; '));
 for(const type of ['client_invoice','cost','client_credit_note','vendor_credit_note','client_debit_note','vendor_debit_note']){await page.getByLabel('Document type').selectOption(type);await page.getByRole('button',{name:'Browse',exact:true}).click();await page.getByRole('status').filter({hasText:'2 unposted'}).waitFor();assert.equal(calls.at(-1).kind,type);}
 assert.deepEqual((await page.getByRole('columnheader').allTextContents()).slice(0,5),['Select','Date','Number','Client / vendor','Campaign']);await page.getByRole('cell',{name:'Summer campaign',exact:true}).first().waitFor();await page.getByRole('cell',{name:'22 Nov 2026',exact:true}).first().waitFor();assert.equal(await page.getByRole('cell',{name:/1001.*Isolated browser fixture/}).count(),0);evidence.checks.push('All six document filters, date-first columns, campaign names and hidden party codes');
 await page.getByRole('button',{name:'Select all in period'}).click();await page.getByText('2 selected',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Post selected',exact:true}).click();await page.getByRole('alertdialog').waitFor();await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(calls.filter(c=>c.method==='POST').length,0);
 evidence.checks.push('Cancel sends no posting request');
 await page.getByRole('button',{name:'Post selected',exact:true}).click();await page.getByRole('button',{name:'Confirm posting',exact:true}).click();await page.getByRole('status').filter({hasText:'1 posted to Accounting. 1 failed.'}).waitFor();assert.equal(await page.getByLabel('Select QA-1').count(),0);await page.getByRole('alert').filter({hasText:'Document changed'}).waitFor();assert.equal(calls.filter(c=>c.method==='POST').length,2);
 evidence.checks.push('One request per selected document; success disappears and failed row remains with error');
 failSecond=false;await page.getByRole('button',{name:'Browse',exact:true}).click();await page.getByRole('status').filter({hasText:'1 unposted'}).waitFor();await page.getByLabel('Select QA-2').check();await page.getByRole('button',{name:'Post selected',exact:true}).click();await page.getByRole('button',{name:'Confirm posting',exact:true}).click();await page.getByRole('status').filter({hasText:'1 posted to Accounting. 0 failed.'}).waitFor();
 await page.getByLabel('View').selectOption('true');await page.getByRole('button',{name:'Browse',exact:true}).click();await page.getByRole('status').filter({hasText:'2 posted documents'}).waitFor();await page.getByRole('button',{name:'Invoice allocations',exact:true}).first().click();
 await page.getByLabel('Allocate INV-1',{exact:true}).fill('100.00');await page.getByRole('button',{name:'Save allocations',exact:true}).click();
 const before=calls.filter(c=>c.method==='POST').length;
 await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(calls.filter(c=>c.method==='POST').length,before);
 await page.getByRole('button',{name:'Save allocations',exact:true}).click();await page.getByRole('button',{name:'Confirm allocations',exact:true}).click();
 await page.getByRole('heading',{name:/Invoice allocations/}).waitFor({state:'hidden'});
 const allocationCall=calls.filter(c=>c.operation==='allocate').at(-1);assert.deepEqual(allocationCall.lines,[{id:'inv-1',amount:'100.00'}]);assert.equal(allocationCall.version,1);
 evidence.checks.push('Note allocations display invoice balances, cancel without saving and submit confirmed amounts with version');
 await page.getByLabel('Select QA-1').check();await page.getByLabel('Unposting reason').fill('Correct supplier cost');await page.getByRole('button',{name:'Unpost selected',exact:true}).click();await page.getByRole('button',{name:'Confirm unposting',exact:true}).click();await page.getByRole('status').filter({hasText:'1 unposted; linked JVs are pending'}).waitFor();assert.equal(calls.at(-1).operation,'unpost');assert.equal(calls.at(-1).reason,'Correct supplier cost');
 evidence.checks.push('Posted view, reason and confirmed unposting work');
 await page.screenshot({path:path.join(out,'queue.png'),fullPage:true});assert.deepEqual(errors,[]);evidence.passed=true;console.log('PASS: '+evidence.checks.join('; '));
}catch(e){evidence.passed=false;evidence.error=e.stack;evidence.browserErrors=errors;process.exitCode=1;console.error(e.stack);}finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(evidence,null,2));await browser.close();await new Promise(r=>server.close(r));}
