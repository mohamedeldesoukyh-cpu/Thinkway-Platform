import {z} from "zod";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {requirePermission} from "@/lib/auth/permissions-server";
import {loadRateCardReport} from "@/features/rate-cards/report-data";
import {buildRateCardReportHtml,rateReportPdfOptions} from "@/features/rate-cards/report";
import {errorLabel,textFor} from "@/features/rate-cards/labels";
import {renderHtmlPagesToImages,renderHtmlToPdf} from "@/lib/io/vendor-io-pdf";

import {buildPptxFromPageImages} from "@/features/quotations/export/quotation-pptx-from-html";
import {EMBEDDABLE_DOCUMENT_FRAME_HEADERS} from "@/lib/security/embeddable-document-headers";
import {addRatePreviewNavigation} from "@/features/rate-cards/report-preview";

export const maxDuration=300;
export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  const query=new URL(request.url).searchParams,lang=query.get("lang")==="ar"?"ar":"en";
  try{
    const {id}=await params;if(!z.uuid().safeParse(id).success)return new Response(null,{status:400});
    const db=await createSupabaseServerClient();if("error" in await requirePermission(db,"rate_cards.read"))return new Response(null,{status:403});
    const template=query.get("template")==="client-list-by-name"?"client-list-by-name":query.get("template")==="creator-list-details"?"creator-list-details":"creator-list";
    const format=query.get("format")??"html";if(!["html","pdf","pptx"].includes(format))return new Response(null,{status:400});
    const preview=format==="html"&&query.get("download")!=="1";
    const page=z.coerce.number().int().min(1).safeParse(query.get("page")??1);
    if(!page.success)return new Response(null,{status:400});
    const doc=await loadRateCardReport(db,id,preview?page.data:undefined,template!=="client-list-by-name");
    let html=buildRateCardReportHtml(doc,template,lang);const pdfOptions=rateReportPdfOptions(doc,template);
    if(doc.preview)html=addRatePreviewNavigation(html,new URL(request.url),doc.preview,lang);
    const headers={"Cache-Control":"no-store",...EMBEDDABLE_DOCUMENT_FRAME_HEADERS,"Content-Disposition":`${query.get("download")==="1"?"attachment":"inline"}; filename="rate-card-${template}.${format}"`};
    // Complete downloads can exceed a buffered serverless response even after
    // shrinking images. Stream the HTML while preview stays bounded above.
    if(format==="html")return new Response(new Blob([html]).stream(),{headers:{...headers,"Content-Type":"text/html; charset=utf-8"}});
    if(format==="pdf"){
      const pdf=await renderHtmlToPdf(html,pdfOptions);if(!pdf.ok)throw new Error("error");
      return new Response(new Uint8Array(pdf.buffer),{headers:{...headers,"Content-Type":"application/pdf"}});
    }
    const images=await renderHtmlPagesToImages(html,{...pdfOptions,pageSelector:".page",imageType:"jpeg",quality:90,deviceScaleFactor:1.5});
    if(!images.ok)throw new Error("error");
    const buffer=await buildPptxFromPageImages(images.pages,doc.name);
    return new Response(new Uint8Array(buffer),{headers:{...headers,"Content-Type":"application/vnd.openxmlformats-officedocument.presentationml.presentation"}});
  }catch(e){console.error("rate-card.export.failed",e instanceof Error?e.message:"Report data could not be loaded");return Response.json({error:textFor(lang,errorLabel(e))},{status:422});}
}
