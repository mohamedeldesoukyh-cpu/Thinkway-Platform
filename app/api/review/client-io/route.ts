import { loadCommercialIo } from "@/features/client-workspace/load-commercial-io";
import { NextResponse } from "next/server";
import { resolveCommercialDocuments } from "@/features/client-workspace/commercial-documents";
import { canViewWorkspaceIo, isCurrentWorkspaceIo } from "@/features/client-workspace/client-io-document-policy";
import { approvedClientIoHtml } from "@/lib/io/client-io-email-attachment";
import { applyClientIoPrintLayout } from "@/lib/io/client-io-print-layout";
import { renderLiveClientIoHtml } from "@/lib/io/render-live-client-io-html";
import { renderHtmlToPdf, INSERTION_ORDER_PDF_OPTIONS } from "@/lib/io/vendor-io-pdf";
import { completeClientIoApprovalByToken } from "@/lib/io/complete-io-approval-by-token";
import { isValidClientIoEmail } from "@/lib/io/client-io-send-recipients";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
const privateHeaders = {"Cache-Control":"private, no-store", "Referrer-Policy":"no-referrer"};
async function load(request: Request) {
  const query = new URL(request.url).searchParams;
  const access = await resolveCommercialDocuments(query.get("sign")?.trim() || "");
  return {...access,query,...await loadCommercialIo(access.db,access.campaignId)};
}
export async function GET(request:Request) {
  try {
    const {db,campaignId,query,io,approvalToken}=await load(request);
    if(query.get("format")==="status") return NextResponse.json({io:io ? {id:io.id,number:io.document_number,status:io.status,
      approved:io.status==="approved",canApprove:Boolean(approvalToken),available:canViewWorkspaceIo(io)}:null,
      message:campaignId ? "Client IO is being prepared." : "Available once the campaign moves to Assignments."},{headers:privateHeaders});
    if(!io) return NextResponse.json({error:"Client IO is not available yet."},{status:404,headers:privateHeaders});
    if(!isCurrentWorkspaceIo(io,query.get("ioId"))) return NextResponse.json({error:"The Client IO has changed. Return to the workspace and reload it."},{status:409,headers:privateHeaders});
    if(!canViewWorkspaceIo(io)) return NextResponse.json({error:"This Client IO is no longer available. Please contact Thinkway."},{status:409,headers:privateHeaders});
    // Current preview matches the campaign Client IO tab. The default issued
    // document path remains unchanged and available separately; no records are written.
    const currentPreview=query.get("source")==="current" && io.status!=="approved";
    let html=currentPreview || ["draft","generated"].includes(io.status)
      ? await renderLiveClientIoHtml(db,io.id) : io.terms_html;
    if(!html) return NextResponse.json({error:"The saved Client IO is unavailable. Please contact Thinkway."},{status:409,headers:privateHeaders});
    if(io.status==="approved" && !currentPreview) {
      if(!io.approved_at) throw new Error("Approval date unavailable");
      html=approvedClientIoHtml(html,io.approved_at);
    }
    html=applyClientIoPrintLayout(html);
    // View uses the same HTML as Download without waiting for a browser/PDF job.
    if(query.get("format")==="html") return new NextResponse(html,{headers:{...privateHeaders,
      "Content-Type":"text/html; charset=utf-8", "X-Content-Type-Options":"nosniff",
      "Content-Security-Policy":"sandbox; default-src 'none'; style-src 'unsafe-inline' https:; img-src https: data:; font-src https: data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}});
    const result=await renderHtmlToPdf(html,INSERTION_ORDER_PDF_OPTIONS);
    if(!result.ok) throw new Error("PDF unavailable");
    const name=(io.document_number || "Client-IO").replace(/[^a-zA-Z0-9_-]/g,"-")+(currentPreview ? "-Current" : io.status==="approved" ? "-Approved" : "");
    return new NextResponse(result.buffer as unknown as BodyInit,{headers:{...privateHeaders,"Content-Type":"application/pdf",
      "Content-Disposition":`${query.get("view")==="1" ? "inline" : "attachment"}; filename="${name}.pdf"`}});
  } catch { return NextResponse.json({error:"Client IO is unavailable for this link. Please retry or contact Thinkway."},{status:403,headers:privateHeaders}); }
}
export async function POST(request:Request) {
  try {
    const {io,approvalToken}=await load(request);
    const input=await request.json();
    if(!isCurrentWorkspaceIo(io,input?.ioId)) return NextResponse.json({error:"The Client IO has changed. Reload and review it before approving."},{status:409,headers:privateHeaders});
    if(io.status==="approved") return NextResponse.json({ok:true},{headers:privateHeaders});
    if(!approvalToken || !isValidClientIoEmail(String(input.email ?? ""))) return NextResponse.json({error:"Enter a valid email. Only a sent Client IO with an active approval link can be approved."},{status:400,headers:privateHeaders});
    const result=await completeClientIoApprovalByToken({token:approvalToken,approverEmail:input.email});
    return NextResponse.json(result.ok ? {ok:true} : {error:"Approval could not be recorded. Please refresh and try again."},{status:result.ok ? 200 : 409,headers:privateHeaders});
  } catch { return NextResponse.json({error:"Approval unavailable for this review link."},{status:403,headers:privateHeaders}); }
}
