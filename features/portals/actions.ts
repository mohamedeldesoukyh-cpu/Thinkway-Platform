"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient, requireRequestUser } from "@/lib/supabase/server";
import { uploadEntityDocument } from "@/lib/supabase/storage";
import { requireClientScope, requireCreatorScope } from "@/features/portals/scope";

type PortalActionState = {
  ok: boolean;
  message?: string;
};

async function resolveClientIdForApproval(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  entityType: string,
  entityId: string
): Promise<string | null> {
  if (entityType === "client_io") {
    const { data } = await supabase
      .from("client_ios")
      .select("client_id")
      .eq("id", entityId)
      .maybeSingle();
    return (data as { client_id: string } | null)?.client_id ?? null;
  }
  if (entityType === "deliverable") {
    const { data } = await supabase
      .from("deliverables")
      .select("campaign_id")
      .eq("id", entityId)
      .maybeSingle();
    const campaignId = (data as { campaign_id: string } | null)?.campaign_id;
    if (!campaignId) return null;
    const { data: header } = await supabase
      .from("campaign_headers")
      .select("client_id")
      .eq("id", campaignId)
      .maybeSingle();
    return (header as { client_id: string } | null)?.client_id ?? null;
  }
  if (entityType === "publication") {
    const { data } = await supabase
      .from("campaign_publications")
      .select("campaign_header_id")
      .eq("id", entityId)
      .maybeSingle();
    const headerId = (data as { campaign_header_id: string } | null)?.campaign_header_id;
    if (!headerId) return null;
    const { data: header } = await supabase
      .from("campaign_headers")
      .select("client_id")
      .eq("id", headerId)
      .maybeSingle();
    return (header as { client_id: string } | null)?.client_id ?? null;
  }
  return null;
}

async function assertClientCanApprove(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  clientId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("client_users")
    .select("access_role")
    .eq("profile_id", userId)
    .eq("client_id", clientId)
    .maybeSingle();
  return (data as { access_role: string } | null)?.access_role === "approve";
}

function revalidateCreatorPortal() {
  revalidatePath("/creator-portal");
  revalidatePath("/creator-portal/campaigns");
  revalidatePath("/creator-portal/campaigns", "layout");
  revalidatePath("/creator-portal/deliverables");
  revalidatePath("/creator-portal/publications");
  revalidatePath("/creator-portal/payments");
  revalidatePath("/creator-portal/vendor-ios");
  revalidatePath("/creator-portal/notifications");
}

function revalidateClientPortal() {
  revalidatePath("/client-portal");
  revalidatePath("/client-portal/campaigns");
  revalidatePath("/client-portal/publications");
  revalidatePath("/client-portal/approvals");
  revalidatePath("/client-portal/invoices");
  revalidatePath("/client-portal/reports");
  revalidatePath("/client-portal/notifications");
  revalidatePath("/client-portal/client-io");
}

export async function creatorUploadDeliverableAction(
  _prev: PortalActionState,
  formData: FormData
): Promise<PortalActionState> {
  const deliverableId = String(formData.get("deliverable_id") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const externalLink = String(formData.get("external_link") ?? "").trim();
  const file = formData.get("file");

  if (!deliverableId) {
    return { ok: false, message: "Deliverable is required." };
  }

  try {
    const { supabase, scope } = await requireCreatorScope("creator_portal.write");
    const { data: deliverable, error: deliverableError } = await supabase
      .from("deliverables")
      .select("id, campaign_id, influencer_id")
      .eq("id", deliverableId)
      .maybeSingle();

    if (deliverableError || !deliverable) {
      return { ok: false, message: deliverableError?.message ?? "Deliverable not found." };
    }

    if ((deliverable as { influencer_id: string }).influencer_id !== scope.influencerId) {
      return { ok: false, message: "You cannot upload for this deliverable." };
    }

    let storagePath: string | null = null;
    let mimeType: string | null = null;
    let fileSize: number | null = null;
    let fileName: string | null = null;

    if (file instanceof File && file.size > 0) {
      const upload = await uploadEntityDocument({
        supabase,
        bucket: "influencer-documents",
        entityId: scope.influencerId,
        documentType: "deliverable-upload",
        file,
      });
      storagePath = upload.storagePath;
      mimeType = upload.mimeType;
      fileSize = upload.fileSize;
      fileName = file.name;
    }

    const contentUrl = externalLink || (storagePath ? `storage://influencer-documents/${storagePath}` : null);

    const { error: submitError } = await (supabase as any).rpc("creator_portal_submit_deliverable", {
      p_deliverable_id: deliverableId,
      p_content_url: contentUrl,
      p_notes: notes || null,
    });
    if (submitError) {
      return { ok: false, message: submitError.message };
    }

    const { error: uploadLogError } = await supabase.from("portal_uploads").insert({
      portal_type: "creator",
      entity_type: "deliverable",
      entity_id: deliverableId,
      campaign_header_id: (deliverable as { campaign_id: string }).campaign_id,
      influencer_id: scope.influencerId,
      file_name: fileName,
      storage_bucket: storagePath ? "influencer-documents" : null,
      storage_path: storagePath,
      mime_type: mimeType,
      file_size: fileSize,
      external_link: externalLink || null,
      uploaded_by: scope.userId,
    } as never);

    if (uploadLogError) {
      return { ok: false, message: uploadLogError.message };
    }

    await supabase.from("access_logs").insert({
      actor_id: scope.userId,
      action: "creator_deliverable_submitted",
      module: "creator_portal",
      metadata: {
        deliverable_id: deliverableId,
        campaign_id: (deliverable as { campaign_id: string }).campaign_id,
        influencer_id: scope.influencerId,
      },
    } as never);

    const { error: notificationError } = await supabase.from("portal_notifications").insert({
      audience_type: "creator",
      influencer_id: scope.influencerId,
      campaign_header_id: (deliverable as { campaign_id: string }).campaign_id,
      event_type: "deliverable_request",
      title: "Deliverable uploaded",
      message: "Your deliverable upload has been submitted for review.",
      metadata: { deliverable_id: deliverableId },
    } as never);
    if (notificationError) {
      return { ok: false, message: notificationError.message };
    }

    console.debug("[creator-upload]", "deliverable submitted", {
      deliverableId,
      influencerId: scope.influencerId,
    });

    revalidateCreatorPortal();
    return { ok: true, message: "Deliverable submitted." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Upload failed." };
  }
}

export async function creatorRejectVendorIoAction(
  _prev: PortalActionState,
  formData: FormData
): Promise<PortalActionState> {
  const vendorIoId = String(formData.get("vendor_io_id") ?? "").trim();
  const approvedByName = String(formData.get("approved_by_name") ?? "").trim();
  const rejectionReason = String(formData.get("rejection_reason") ?? "").trim();
  if (!vendorIoId) return { ok: false, message: "Vendor IO is required." };

  try {
    const { supabase } = await requireCreatorScope("creator_portal.approve");
    const { data, error } = await (supabase as any).rpc("reject_vendor_io_portal", {
      p_vendor_io_id: vendorIoId,
      p_approved_by_name: approvedByName || null,
      p_rejection_reason: rejectionReason || null,
    });
    if (error || !data) return { ok: false, message: error?.message ?? "Rejection failed." };

    revalidateCreatorPortal();
    return { ok: true, message: "Vendor IO rejected." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Rejection failed." };
  }
}

export async function creatorApproveVendorIoAction(
  _prev: PortalActionState,
  formData: FormData
): Promise<PortalActionState> {
  const vendorIoId = String(formData.get("vendor_io_id") ?? "").trim();
  const approvedByName = String(formData.get("approved_by_name") ?? "").trim();
  if (!vendorIoId) return { ok: false, message: "Vendor IO is required." };

  try {
    const { supabase } = await requireCreatorScope("creator_portal.approve");
    const { data, error } = await (supabase as any).rpc("approve_vendor_io_portal", {
      p_vendor_io_id: vendorIoId,
      p_approved_by_name: approvedByName || null,
    });
    if (error || !data) return { ok: false, message: error?.message ?? "Approval failed." };

    revalidateCreatorPortal();
    return { ok: true, message: "Vendor IO approved." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Approval failed." };
  }
}

export async function markPortalNotificationReadAction(
  _prev: PortalActionState,
  formData: FormData
): Promise<PortalActionState> {
  const notificationId = String(formData.get("notification_id") ?? "").trim();
  const audienceType = String(formData.get("audience_type") ?? "").trim();
  if (!notificationId || !audienceType) {
    return { ok: false, message: "Notification is required." };
  }

  try {
    const { supabase } = await requireRequestUser();

    const { error } = await supabase
      .from("portal_notifications")
      .update({ is_read: true, read_at: new Date().toISOString() } as never)
      .eq("id", notificationId);
    if (error) return { ok: false, message: error.message };

    if (audienceType === "creator") revalidateCreatorPortal();
    if (audienceType === "client") revalidateClientPortal();

    return { ok: true, message: "Notification marked as read." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Could not update notification." };
  }
}

export async function clientApproveAction(
  _prev: PortalActionState,
  formData: FormData
): Promise<PortalActionState> {
  const entityType = String(formData.get("entity_type") ?? "").trim();
  const entityId = String(formData.get("entity_id") ?? "").trim();
  const decision = String(formData.get("decision") ?? "").trim();
  const approvedByName = String(formData.get("approved_by_name") ?? "").trim();

  if (!entityType || !entityId || !decision) {
    return { ok: false, message: "Approval payload is incomplete." };
  }

  try {
    const { supabase, scope } = await requireClientScope("client_portal.approve");
    console.debug("[client-approval]", "decision requested", { entityType, entityId, decision });

    const clientId = await resolveClientIdForApproval(supabase, entityType, entityId);
    if (!clientId || !scope.clientIds.includes(clientId)) {
      return { ok: false, message: "You cannot approve items for this legal entity." };
    }

    const canApprove = await assertClientCanApprove(supabase, scope.userId, clientId);
    if (!canApprove) {
      return {
        ok: false,
        message: "Your client access role is view-only. Approvals require an approve role.",
      };
    }

    if (entityType === "client_io" && decision === "approved") {
      const { data, error } = await (supabase as any).rpc("approve_client_io_portal", {
        p_client_io_id: entityId,
        p_approved_by_name: approvedByName || null,
      });
      if (error || !data) return { ok: false, message: error?.message ?? "Client IO approval failed." };
    } else if (entityType === "deliverable") {
      const { data, error } = await (supabase as any).rpc("client_portal_set_deliverable_status", {
        p_deliverable_id: entityId,
        p_decision: decision,
        p_approved_by_name: approvedByName || null,
      });
      if (error || !data) return { ok: false, message: error?.message ?? "Deliverable decision failed." };
    } else if (entityType === "publication") {
      const { data, error } = await (supabase as any).rpc("client_portal_set_publication_status", {
        p_publication_id: entityId,
        p_decision: decision,
        p_approved_by_name: approvedByName || null,
      });
      if (error || !data) return { ok: false, message: error?.message ?? "Publication decision failed." };
    } else {
      return { ok: false, message: "Unsupported approval action." };
    }

    revalidateClientPortal();
    return { ok: true, message: "Decision saved." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Approval failed." };
  }
}

export async function clientUploadPoAction(
  _prev: PortalActionState,
  formData: FormData
): Promise<PortalActionState> {
  const campaignHeaderId = String(formData.get("campaign_header_id") ?? "").trim();
  const externalLink = String(formData.get("external_link") ?? "").trim();
  const file = formData.get("file");

  if (!campaignHeaderId) return { ok: false, message: "Campaign is required." };
  if (!(file instanceof File) && !externalLink) {
    return { ok: false, message: "Upload a file or provide a link." };
  }

  try {
    const { supabase, scope } = await requireClientScope("client_portal.write");
    const { data: header, error: headerError } = await supabase
      .from("campaign_headers")
      .select("id, client_id")
      .eq("id", campaignHeaderId)
      .maybeSingle();
    if (headerError || !header) {
      return { ok: false, message: headerError?.message ?? "Campaign not found." };
    }

    const clientId = (header as { client_id: string }).client_id;
    if (!scope.clientIds.includes(clientId)) {
      return { ok: false, message: "You cannot upload PO for this campaign." };
    }

    let storagePath: string | null = null;
    let mimeType: string | null = null;
    let fileSize: number | null = null;
    let fileName: string | null = null;

    if (file instanceof File && file.size > 0) {
      const upload = await uploadEntityDocument({
        supabase,
        bucket: "client-documents",
        entityId: clientId,
        documentType: "po-upload",
        file,
      });
      storagePath = upload.storagePath;
      mimeType = upload.mimeType;
      fileSize = upload.fileSize;
      fileName = file.name;
    }

    const { error: uploadError } = await supabase.from("portal_uploads").insert({
      portal_type: "client",
      entity_type: "purchase_order",
      entity_id: campaignHeaderId,
      campaign_header_id: campaignHeaderId,
      client_id: clientId,
      file_name: fileName,
      storage_bucket: storagePath ? "client-documents" : null,
      storage_path: storagePath,
      mime_type: mimeType,
      file_size: fileSize,
      external_link: externalLink || null,
      uploaded_by: scope.userId,
    } as never);
    if (uploadError) return { ok: false, message: uploadError.message };

    const { error: notifyError } = await supabase.from("portal_notifications").insert({
      audience_type: "client",
      client_id: clientId,
      campaign_header_id: campaignHeaderId,
      event_type: "po_uploaded",
      title: "PO uploaded",
      message: "Purchase order was uploaded in client portal.",
      metadata: { campaign_header_id: campaignHeaderId },
    } as never);
    if (notifyError) return { ok: false, message: notifyError.message };

    revalidateClientPortal();
    return { ok: true, message: "PO uploaded." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "PO upload failed." };
  }
}
