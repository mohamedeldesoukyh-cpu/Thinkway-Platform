"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { emitEnterpriseTimelineEvent } from "@/lib/timeline/emit-enterprise-timeline-event";
import { debugIo } from "@/features/io/queries";

type ActionState = {
  ok: boolean;
  message?: string;
};

function revalidateVendorIoPaths(campaignHeaderId: string) {
  revalidatePath("/ios/vendor");
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaignHeaderId}`);
}

/**
 * Internal Traffic/ops path: record Vendor IO approval when the vendor signed
 * offline (e.g. after Mark as Delivered Manually) or confirmed outside email.
 */
export async function recordVendorIoManualApprovalAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const id = String(formData.get("id") ?? "").trim();
  const campaignHeaderId = String(formData.get("campaign_header_id") ?? "").trim();
  const approvedByOverride = String(formData.get("approved_by_name") ?? "").trim();

  if (!id || !campaignHeaderId) {
    return { ok: false, message: "Missing Vendor IO context." };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, message: authError?.message ?? "Unauthorized" };
  }

  const { data: existing, error: loadError } = await supabase
    .from("vendor_ios")
    .select(
      "id, status, is_superseded, revision_number, document_number, delivery_method, campaign_header_id"
    )
    .eq("id", id)
    .maybeSingle();

  if (loadError || !existing) {
    return { ok: false, message: loadError?.message ?? "Vendor IO not found." };
  }

  const row = existing as {
    id: string;
    status: string;
    is_superseded: boolean;
    revision_number: number | null;
    document_number: string | null;
    delivery_method: string | null;
    campaign_header_id: string;
  };

  if (row.is_superseded) {
    return {
      ok: false,
      message: "This Vendor IO revision is superseded. Approve the current version only.",
    };
  }

  if (row.status === "approved") {
    return { ok: true, message: "Vendor IO is already approved." };
  }

  if (!["draft", "generated", "sent", "rejected"].includes(row.status)) {
    return { ok: false, message: "This Vendor IO cannot be approved in its current status." };
  }

  if (row.status !== "sent" && row.delivery_method !== "manual") {
    return {
      ok: false,
      message: "Deliver the Vendor IO first (email or Mark as Delivered Manually), then record approval.",
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const profileRow = profile as { full_name?: string | null; email?: string | null } | null;
  const approvedByName =
    approvedByOverride ||
    profileRow?.full_name?.trim() ||
    profileRow?.email?.trim() ||
    "Thinkway Traffic";
  const approvedByEmail = profileRow?.email?.trim()?.toLowerCase() || null;
  const approvedAt = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("vendor_ios")
    .update({
      status: "approved",
      approved_at: approvedAt,
      approved_by_name: approvedByName,
      approved_by_email: approvedByEmail,
      approved_revision_number: row.revision_number ?? 0,
      approval_token_hash: null,
      approval_token_expires_at: null,
      rejection_reason: null,
      updated_by: user.id,
      updated_at: approvedAt,
    } as never)
    .eq("id", id)
    .eq("is_superseded", false);

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  await supabase.from("io_notifications").insert({
    io_type: "vendor",
    io_id: id,
    event_type: "vendor_io_approved",
    recipient_email: approvedByEmail,
    recipient_name: approvedByName,
    payload: {
      notification_kind: "manual_approval_recorded",
      approved_by: approvedByName,
      approved_by_email: approvedByEmail,
      approved_at: approvedAt,
      delivery_method: row.delivery_method,
      document_number: row.document_number,
    },
    sent_at: approvedAt,
  } as never);

  try {
    await emitEnterpriseTimelineEvent(supabase, {
      campaignHeaderId: row.campaign_header_id,
      actorId: user.id,
      entityType: "vendor_ios",
      entityId: id,
      action: "update",
      metadata: {
        event: "vendor_io.approved",
        summary: `Vendor IO ${row.document_number ?? id} approval recorded by ${approvedByName}`,
        module: "vendor_io",
        version: row.revision_number ?? 0,
      },
      newData: {
        status: "approved",
        approved_by_name: approvedByName,
        approved_by_email: approvedByEmail,
        approval_source: "manual_record",
      },
    });
  } catch {
    // Non-blocking
  }

  debugIo("vendor-io", "manual approval recorded", { id });
  revalidateVendorIoPaths(campaignHeaderId);
  return { ok: true, message: "Vendor IO marked as approved." };
}
