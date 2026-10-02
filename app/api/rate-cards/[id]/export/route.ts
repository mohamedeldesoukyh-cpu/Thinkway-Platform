import {z} from "zod";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {requirePermission} from "@/lib/auth/permissions-server";
import {loadRateCardReport} from "@/features/rate-cards/report-data";
import {buildRateCardReportHtml} from "@/features/rate-cards/report";
import {errorLabel,textFor} from "@/features/rate-cards/labels";
import {renderHtmlPagesToImages,renderHtmlToPdf} from "@/lib/io/vendor-io-pdf";
import {QUOTATION_PDF_OPTIONS} from "@/features/quotations/export/quotation-pdf";
import {buildPptxFromPageImages} from "@/features/quotations/export/quotation-pptx-from-html";
import {EMBEDDABLE_DOCUMENT_FRAME_HEADERS} from "@/lib/security/embeddable-document-headers";

export const maxDuration=300;
export const dynamic="force-dynamic";
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
  const query=new URL(request.url).searchParams,lang=query.get("lang")==="ar"?"ar":"en";
  try{
    const {id}=await params;if(!z.uuid().safeParse(id).success)return new Response(null,{status:400});
    const db=await createSupabaseServerClient();if("error" in await requirePermission(db,"rate_cards.read"))return new Response(null,{status:403});
    const template=query.get("template")==="creator-list-details"?"creator-list-details":"creator-list";
    const format=query.get("format")??"html";if(!["html","pdf","pptx"].includes(format))return new Response(null,{status:400});
    const doc=await loadRateCardReport(db,id);const html=buildRateCardReportHtml(doc,template,lang);
    const headers={"Cache-Control":"no-store",...EMBEDDABLE_DOCUMENT_FRAME_HEADERS,"Content-Disposition":`${query.get("download")==="1"?"attachment":"inline"}; filename="rate-card-${template}.${format}"`};
    if(format==="html")return new Response(html,{headers:{...headers,"Content-Type":"text/html; charset=utf-8"}});
    if(format==="pdf"){
      const pdf=await renderHtmlToPdf(html,QUOTATION_PDF_OPTIONS);if(!pdf.ok)throw new Error("error");
      return new Response(new Uint8Array(pdf.buffer),{headers:{...headers,"Content-Type":"application/pdf"}});
    }
    const images=await renderHtmlPagesToImages(html,{...QUOTATION_PDF_OPTIONS,pageSelector:".rcpage",imageType:"jpeg",quality:90,deviceScaleFactor:1.5});
    if(!images.ok)throw new Error("error");
    const buffer=await buildPptxFromPageImages(images.pages,doc.name);
    return new Response(new Uint8Array(buffer),{headers:{...headers,"Content-Type":"application/vnd.openxmlformats-officedocument.presentationml.presentation"}});
  }catch(e){return Response.json({error:textFor(lang,errorLabel(e))},{status:422});}
}
