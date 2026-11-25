import {PDFDocument} from "pdf-lib";
import {renderHtmlToPdf,type HtmlToPdfOptions} from "@/lib/io/vendor-io-pdf";

/** Split only the trusted report renderer's top-level page sections. */
export function ratePdfBatches(html:string,pagesPerBatch=6):string[]{
 if(!Number.isInteger(pagesPerBatch)||pagesPerBatch<1)throw new Error("Invalid PDF batch size");
 const starts=[...html.matchAll(/<section class="page(?: [^"]*)?">/g)].map(m=>m.index!);
 const end=html.indexOf("<script>",starts.at(-1));
 if(!starts.length||end<0)throw new Error("Invalid rate-card report structure");
 const prefix=html.slice(0,starts[0]),suffix=html.slice(end);
 const pages=starts.map((start,i)=>html.slice(start,starts[i+1]??end));
 const batches:string[]=[];
 for(let i=0;i<pages.length;i+=pagesPerBatch)batches.push(prefix+pages.slice(i,i+pagesPerBatch).join("")+suffix);
 return batches;
}

/** Release Chromium between batches so large creator lists cannot exhaust it. */
export async function renderRateCardPdf(html:string,options:HtmlToPdfOptions,render=renderHtmlToPdf):Promise<Buffer>{
 const merged=await PDFDocument.create();
 async function appendBatch(batch:string):Promise<void>{
  const result=await render(batch,options);
  if(!result.ok){
   const pages=ratePdfBatches(batch,1);
   // A renderer process can run out of resources while decoding a whole batch.
   // Retry only process/frame crashes, with smaller documents in fresh browsers.
   if(pages.length>1 && /target closed|detached frame|frame.*detached|session closed|page crashed/i.test(result.error)){
    for(const smaller of ratePdfBatches(batch,Math.ceil(pages.length/2)))await appendBatch(smaller);
    return;
   }
   throw new Error(`Report PDF render failed: ${result.error}`);
  }
  const source=await PDFDocument.load(result.buffer);
  for(const page of await merged.copyPages(source,source.getPageIndices()))merged.addPage(page);
 }
 for(const batch of ratePdfBatches(html))await appendBatch(batch);
 return Buffer.from(await merged.save());
}
