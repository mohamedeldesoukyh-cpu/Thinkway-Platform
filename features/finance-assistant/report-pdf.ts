import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { formattedReportHtml } from "@/features/accounting/formatted-report-model";
import { renderHtmlToPdf } from "@/lib/io/vendor-io-pdf";
import type { FinanceEvidence } from "./contracts";

export async function financeReportPdf(evidence:FinanceEvidence,retrievedAt:string){
 if(!evidence.tables?.length)throw Error("Choose a verified report before downloading a PDF.");
 let css=await readFile(path.join(process.cwd(),"public/report-assets/statement-shared.css"),"utf8");
 // Embed only fixed local assets, never user-supplied URLs.
 for(const name of [1,2,3,4,5,6].map(i=>`statement-font-${i}.woff2`)){
  const bytes=await readFile(path.join(process.cwd(),"public/report-assets",name));
  css=css.replaceAll(`/report-assets/${name}`,`data:font/woff2;base64,${bytes.toString("base64")}`);
 }
 const logo=await readFile(path.join(process.cwd(),"public/report-assets/statement-brand.png"));
 const html=formattedReportHtml({title:evidence.title,company:String(evidence.facts.company??"Thinkway"),caption:`${evidence.scope} Generated ${retrievedAt}.`,sections:evidence.tables})
  .replace('<link rel="stylesheet" href="/report-assets/statement-shared.css">',`<style>${css}\ntd{overflow-wrap:anywhere}td,th{font-size:10px}h1,h2,p,td{unicode-bidi:plaintext}</style>`)
  .replaceAll('/report-assets/statement-brand.png',`data:image/png;base64,${logo.toString("base64")}`);
 const result=await renderHtmlToPdf(html.replaceAll("No transactions for this selection.","No matching report rows for this selection."),{format:"A4",printBackground:true,preferCSSPageSize:true,margin:{top:"10mm",bottom:"10mm",left:"10mm",right:"10mm"}});
 if(!result.ok)throw Error("PDF generation failed. Please retry.");
 if(result.buffer.length>2_000_000)throw Error("Narrow the report to create a PDF under 2 MB.");
 return result.buffer;
}
