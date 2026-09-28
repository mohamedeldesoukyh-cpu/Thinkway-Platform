import type { SupabaseClient } from "@supabase/supabase-js";
import { canViewWorkspaceIo, sentIoApprovalToken, type WorkspaceIo } from "./client-io-document-policy";
import type { CommercialIoSnapshot } from "./types";

/** Server only. Never serialize approval tokens or document bodies into the workspace. */
export async function loadCommercialIo(db: SupabaseClient, campaignId: string | null) {
  if (!campaignId) return {io:null, approvalToken:null};
  const {data, error} = await db.from("client_ios").select("id, document_number, status, approved_at, terms_html, generated_pdf_url, approval_token_hash, approval_token_expires_at")
    .eq("campaign_header_id",campaignId).eq("is_superseded",false).order("revision_number",{ascending:false}).limit(1).maybeSingle();
  if (error) throw new Error("Client IO unavailable");
  const io = data as WorkspaceIo | null;
  let approvalToken: string | null = null;
  if (io && ["sent","under_client_review"].includes(io.status)) {
    const {data:notifications,error:notificationError} = await db.from("io_notifications").select("payload")
      .eq("io_type","client").eq("io_id",io.id).eq("event_type","client_io_sent").eq("delivery_status","sent")
      .order("sent_at",{ascending:false}).limit(30);
    if (notificationError) throw new Error("Approval unavailable");
    approvalToken = sentIoApprovalToken(io,(notifications ?? []).map(n=>n.payload));
  }
  return {io,approvalToken};
}
export async function loadCommercialIoSnapshot(db: SupabaseClient, campaignId: string | null): Promise<CommercialIoSnapshot> {
  const {io,approvalToken}=await loadCommercialIo(db,campaignId);
  return {io:io ? {id:io.id,number:io.document_number,status:io.status,approved:io.status==="approved",canApprove:Boolean(approvalToken),available:canViewWorkspaceIo(io)}:null,
    message:campaignId ? "Client IO is being prepared." : "Available once the campaign moves to Assignments."};
}
