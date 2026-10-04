import {mkdir,writeFile} from "node:fs/promises";
import assert from "node:assert/strict";
import JSZip from "jszip";
import puppeteer from "puppeteer-core";
import {fixture as sourceFixture} from "../features/rate-cards/report-test-fixture";
import {buildRateCardReportHtml,rateReportPdfOptions,rateReportLayout} from "../features/rate-cards/report";
import {renderHtmlPagesToImages,renderHtmlToPdf} from "../lib/io/vendor-io-pdf";

import {buildPptxFromPageImages} from "../features/quotations/export/quotation-pptx-from-html";

async function main(){
 const fixture=structuredClone(sourceFixture);
 if(process.env.RATE_REPORT_TEST_FOUR_PRICES)for(const creator of fixture.creators)creator.rates=Array.from({length:4},(_,i)=>({...creator.rates[i%creator.rates.length]}));
 for(const creator of fixture.creators)creator.rates=creator.rates.map((r,i)=>({...r,deliverable:i%3===0?"usage_right":i%3===1?"boosting":"event_attendance",period_months:i%3===0?12:i%3===1?2:0}));
 if(process.env.RATE_REPORT_TEST_PACKAGES){
  fixture.creators=fixture.creators.slice(0,3);
  for(const [i,c] of fixture.creators.entries()){
   const name=["Ahmed","Mostafa","Sara"][i],platforms=[["instagram","tiktok","facebook"],["instagram","tiktok"],["facebook"]][i];
   const profiles=platforms.map(platform=>({platform,profile_url:`https://${platform}.com/${platform==="tiktok"?"@":""}${name.toLowerCase()}`}));
   const details={name:"Reel + Story Package",reels:1,stories:1,profiles};
   c.group.creator=name;c.group.handle="@"+name.toLowerCase();c.group.creatorKey="test-"+name;
   c.rates=[{platform:"all",deliverable:"package",amount:[100000,400000,700000][i],currency:"EGP",agency_fee_percent:null,package_key:"reel-story",package_details:details},{platform:"all",deliverable:"usage_right",amount:[20000,30000,90000][i],currency:"EGP",agency_fee_percent:null,period_months:1,package_key:"reel-story",package_details:details},{platform:"all",deliverable:"boosting",amount:[10000,20000,40000][i],currency:"EGP",agency_fee_percent:null,period_months:1,package_key:"reel-story",package_details:details}];
   c.performance=profiles.map(p=>({...c.performance[0],platform:p.platform,profileUrl:p.profile_url}));
  }
 }
 const dir=".tmp/rate-card-export-qa";await mkdir(dir,{recursive:true});
 const browser=await puppeteer.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true,args:["--no-sandbox"]});
 try{for(const lang of ["en","ar"] as const)for(const template of ["creator-list","creator-list-details"] as const){
  const pdfOptions=rateReportPdfOptions(fixture,template);const html=buildRateCardReportHtml(fixture,template,lang),name=`${template}-${lang}`;await writeFile(`${dir}/${name}.html`,html);
  const page=await browser.newPage();await page.setViewport({width:1600,height:900});await page.setContent(html);await page.screenshot({path:`${dir}/${name}.png`});await (await page.$(".page:not(.page--cov):not(.page--end)"))!.screenshot({path:`${dir}/${name}-content.png`});assert.equal(await page.$$eval(".creator-card",els=>els.filter(e=>e.scrollHeight>e.clientHeight+2).length),0,`${name}: card overflow`);
  const overflow=await page.$$eval(".page",elements=>elements.filter(e=>e.scrollHeight>e.clientHeight+2).length);assert.equal(overflow,0,`${name}: page overflow`);
  await page.setViewport({width:390,height:844});await page.screenshot({path:`${dir}/${name}-mobile.png`});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${name}: mobile overflow`);assert.equal(await page.$$eval(".page",els=>els.filter(e=>e.scrollHeight>e.clientHeight+2).length),0,`${name}: mobile vertical clipping`);await page.close();
  const pdf=await renderHtmlToPdf(html,pdfOptions);assert.ok(pdf.ok,pdf.ok?"":pdf.error);if(pdf.ok){await writeFile(`${dir}/${name}.pdf`,pdf.buffer);assert.ok(pdf.buffer.toString("latin1").includes("/Subtype /Link"),"PDF hyperlink annotations missing");}
  const images=await renderHtmlPagesToImages(html,{...pdfOptions,pageSelector:".page",imageType:"jpeg",quality:85});assert.ok(images.ok,images.ok?"":images.error);
  if(images.ok){assert.equal(images.pages.length,2+Math.ceil(fixture.creators.length/rateReportLayout(fixture,template).cardsPerPage));assert.ok(images.pages.slice(1,-1).every(p=>p.links.length>0));const pptx=await buildPptxFromPageImages(images.pages,name);await writeFile(`${dir}/${name}.pptx`,pptx);const zip=await JSZip.loadAsync(pptx);const links=await zip.file("ppt/slides/_rels/slide2.xml.rels")!.async("string");assert.ok(links.includes("instagram.com"));}
  console.log(`${name}: pagination, HTML, PDF annotations, PPTX hyperlinks, desktop and mobile passed`);
 }}finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
