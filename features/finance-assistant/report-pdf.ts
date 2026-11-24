import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { formattedReportHtml } from "@/features/accounting/formatted-report-model";
import { renderHtmlToPdf } from "@/lib/io/vendor-io-pdf";
import type { FinanceEvidence } from "./contracts";
import { financeReportCaption } from "./presentation";

export async function financeReportPdf(evidence:FinanceEvidence,retrievedAt:string){
 if(!evidence.tables?.length)throw Error("Choose a verified report before downloading a PDF.");
 let css=await readFile(path.join(process.cwd(),"public/report-assets/statement-shared.css"),"utf8");
 // Embed only fixed local assets, never user-supplied URLs.
 for(const name of [1,2,3,4,5,6].map(i=>`statement-font-${i}.woff2`)){
  const bytes=await readFile(path.join(process.cwd(),"public/report-assets",name));
  css=css.replaceAll(`/report-assets/${name}`,`data:font/woff2;base64,${bytes.toString("base64")}`);
 }
 const logo=await readFile(path.join(process.cwd(),"public/report-assets/statement-brand.png"));
 const html=formattedReportHtml(evidence.statementDocument??{title:evidence.title,company:String(evidence.facts.company??"Thinkway"),caption:financeReportCaption(evidence,retrievedAt),sections:evidence.tables})
  .replace('<link rel="stylesheet" href="/report-assets/statement-shared.css">',`<style>${css}${evidence.statementDocument?'':`\ntd{overflow-wrap:anywhere}td,th{font-size:10px}.page tbody td{padding:5px 8px}.page thead th{padding:7px 8px}.page .band{padding:16px 24px}.page .body{padding:16px 24px}.page .sum{margin:10px 0}.page .tile{padding:8px 12px}.page tr:has(+tr.total){break-after:avoid}.page tr.total{break-before:avoid}h1,h2,p,td{unicode-bidi:plaintext}`}
</style>`)
  .replaceAll('/report-assets/statement-brand.png',`data:image/png;base64,${logo.toString("base64")}`);
 const result=await renderHtmlToPdf(html.replaceAll("No transactions for this selection.","No matching report rows for this selection."),{format:"A4",printBackground:true,preferCSSPageSize:true,margin:evidence.statementDocument?{top:"0mm",bottom:"0mm",left:"0mm",right:"0mm"}:{top:"10mm",bottom:"10mm",left:"10mm",right:"10mm"},...(evidence.statementDocument?{viewport:{width:794,height:1123,deviceScaleFactor:1},waitForDocumentAttribute:{name:"data-statement-ready",value:"true"}}:{})});
 if(!result.ok)throw Error("PDF generation failed. Please retry.");
 if(result.buffer.length>2_000_000)throw Error("Narrow the report to create a PDF under 2 MB.");
 return result.buffer;
}
