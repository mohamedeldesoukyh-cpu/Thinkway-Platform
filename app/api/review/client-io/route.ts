import { NextResponse } from "next/server";
import { resolveCommercialDocuments } from "@/features/client-workspace/commercial-documents";
import { canViewWorkspaceIo, isCurrentWorkspaceIo, sentIoApprovalToken, type WorkspaceIo } from "@/features/client-workspace/client-io-document-policy";
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
  if (!access.campaignId) return {...access, query, io:null, approvalToken:null};
  const {data, error} = await access.db.from("client_ios").select("id, document_number, status, approved_at, terms_html, generated_pdf_url, approval_token_hash, approval_token_expires_at")
    .eq("campaign_header_id",access.campaignId).eq("is_superseded",false).order("revision_number",{ascending:false}).limit(1).maybeSingle();
  if (error) throw new Error("Client IO unavailable");
  const io = data as WorkspaceIo | null;
  let approvalToken: string | null = null;
  if (io && ["sent","under_client_review"].includes(io.status)) {
    const {data:notifications,error:notificationError} = await access.db.from("io_notifications").select("payload")
      .eq("io_type","client").eq("io_id",io.id).eq("event_type","client_io_sent").eq("delivery_status","sent")
      .order("sent_at",{ascending:false}).limit(30);
    if (notificationError) throw new Error("Approval unavailable");
    approvalToken = sentIoApprovalToken(io,(notifications ?? []).map(n=>n.payload));
  }
  return {...access,query,io,approvalToken};
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
    // Issued documents must always use the saved snapshot, including after approval.
    let html=["draft","generated"].includes(io.status)
      ? await renderLiveClientIoHtml(db,io.id) : io.terms_html;
    if(!html) return NextResponse.json({error:"The saved Client IO is unavailable. Please contact Thinkway."},{status:409,headers:privateHeaders});
    if(io.status==="approved") {
      if(!io.approved_at) throw new Error("Approval date unavailable");
      html=approvedClientIoHtml(html,io.approved_at);
    }
    html=applyClientIoPrintLayout(html);
    const result=await renderHtmlToPdf(html,INSERTION_ORDER_PDF_OPTIONS);
    if(!result.ok) throw new Error("PDF unavailable");
    const name=(io.document_number || "Client-IO").replace(/[^a-zA-Z0-9_-]/g,"-")+(io.status==="approved" ? "-Approved" : "");
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
