import {mkdir,writeFile} from "node:fs/promises";
import assert from "node:assert/strict";
import JSZip from "jszip";
import puppeteer from "puppeteer-core";
import {fixture} from "../features/rate-cards/report.test";
import {buildRateCardReportHtml} from "../features/rate-cards/report";
import {renderHtmlPagesToImages,renderHtmlToPdf} from "../lib/io/vendor-io-pdf";
import {CREATOR_LIST_PDF_OPTIONS} from "../features/discovery/shortlists/export/creator-list-html";
import {buildPptxFromPageImages} from "../features/quotations/export/quotation-pptx-from-html";

async function main(){
 const dir=".tmp/rate-card-export-qa";await mkdir(dir,{recursive:true});
 const browser=await puppeteer.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true,args:["--no-sandbox"]});
 try{for(const lang of ["en","ar"] as const)for(const template of ["creator-list","creator-list-details"] as const){
  const html=buildRateCardReportHtml(fixture,template,lang),name=`${template}-${lang}`;await writeFile(`${dir}/${name}.html`,html);
  const page=await browser.newPage();await page.setViewport({width:1600,height:900});await page.setContent(html);await page.screenshot({path:`${dir}/${name}.png`});await (await page.$(".page:not(.page--cov):not(.page--end)"))!.screenshot({path:`${dir}/${name}-content.png`});assert.equal(await page.$$eval(".creator-card",els=>els.filter(e=>e.scrollHeight>e.clientHeight+2).length),0,`${name}: card overflow`);
  const overflow=await page.$$eval(".page",elements=>elements.filter(e=>e.scrollHeight>e.clientHeight+2).length);assert.equal(overflow,0,`${name}: page overflow`);
  await page.setViewport({width:390,height:844});await page.screenshot({path:`${dir}/${name}-mobile.png`});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${name}: mobile overflow`);await page.close();
  const pdf=await renderHtmlToPdf(html,CREATOR_LIST_PDF_OPTIONS);assert.ok(pdf.ok,pdf.ok?"":pdf.error);if(pdf.ok){await writeFile(`${dir}/${name}.pdf`,pdf.buffer);assert.ok(pdf.buffer.toString("latin1").includes("/Subtype /Link"),"PDF hyperlink annotations missing");}
  const images=await renderHtmlPagesToImages(html,{...CREATOR_LIST_PDF_OPTIONS,pageSelector:".page",imageType:"jpeg",quality:85});assert.ok(images.ok,images.ok?"":images.error);
  if(images.ok){assert.equal(images.pages.length,template==="creator-list"?4:12);assert.ok(images.pages.slice(1,-1).every(p=>p.links.length>0));const pptx=await buildPptxFromPageImages(images.pages,name);await writeFile(`${dir}/${name}.pptx`,pptx);const zip=await JSZip.loadAsync(pptx);const links=await zip.file("ppt/slides/_rels/slide2.xml.rels")!.async("string");assert.ok(links.includes("instagram.com"));}
  console.log(`${name}: pagination, HTML, PDF annotations, PPTX hyperlinks, desktop and mobile passed`);
 }}finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
