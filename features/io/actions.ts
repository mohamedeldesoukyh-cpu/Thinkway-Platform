"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { debugIo, buildIoEmailLink } from "@/features/io/queries";
import type { ClientIoStatus, VendorIoStatus } from "@/features/io/types";

type IoActionState = {
  ok: boolean;
  message?: string;
};

async function requireAuthUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { supabase, user: null, error: error?.message ?? "Unauthorized" };
  }
  return { supabase, user, error: null };
}

function revalidateIoPaths(campaignHeaderId?: string | null) {
  revalidatePath("/ios/client");
  revalidatePath("/ios/vendor");
  revalidatePath("/campaigns");
  if (campaignHeaderId) {
    revalidatePath(`/campaigns/${campaignHeaderId}`);
  }
}

export async function updateClientIoAction(
  _prev: IoActionState,
  formData: FormData
): Promise<IoActionState> {
  const id = String(formData.get("id") ?? "");
  const campaignHeaderId = String(formData.get("campaign_header_id") ?? "");
  const termsText = String(formData.get("terms_text") ?? "").trim();
  const termsHtml = String(formData.get("terms_html") ?? "").trim();
  const billingTerms = String(formData.get("billing_terms") ?? "").trim();
  const attachmentUrl = String(formData.get("attachment_url") ?? "").trim();
  const status = String(formData.get("status") ?? "draft") as ClientIoStatus;

  if (!id || !campaignHeaderId) return { ok: false, message: "Missing IO context." };

  const { supabase, user, error } = await requireAuthUser();
  if (error || !user) return { ok: false, message: error ?? "Unauthorized" };

  const { error: updateError } = await supabase
    .from("client_ios")
    .update({
      terms_text: termsText || null,
      terms_html: termsHtml || null,
      billing_terms: billingTerms || null,
      attachment_url: attachmentUrl || null,
      status,
      updated_by: user.id,
    } as never)
    .eq("id", id);

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  debugIo("client-io", "updated draft", { id, status });
  revalidateIoPaths(campaignHeaderId);
  return { ok: true, message: "Client IO saved." };
}

export async function sendClientIoAction(
  _prev: IoActionState,
  formData: FormData
): Promise<IoActionState> {
  const id = String(formData.get("id") ?? "");
  const campaignHeaderId = String(formData.get("campaign_header_id") ?? "");
  if (!id || !campaignHeaderId) return { ok: false, message: "Missing IO context." };

  const { supabase, user, error } = await requireAuthUser();
  if (error || !user) return { ok: false, message: error ?? "Unauthorized" };

  const { data, error: rpcError } = await (supabase as any).rpc("send_client_io", {
    p_client_io_id: id,
    p_actor_id: user.id,
  });

  if (rpcError) return { ok: false, message: rpcError.message };
  const token = (data as string | null) ?? "";
  const approvalUrl = token ? buildIoEmailLink("client", token) : null;

  debugIo("io-email", "client io send trigger", { id, approvalUrl });
  revalidateIoPaths(campaignHeaderId);
  return { ok: true, message: "Client IO sent." };
}

export async function updateVendorIoAction(
  _prev: IoActionState,
  formData: FormData
): Promise<IoActionState> {
  const id = String(formData.get("id") ?? "");
  const campaignHeaderId = String(formData.get("campaign_header_id") ?? "");
  const termsText = String(formData.get("terms_text") ?? "").trim();
  const termsHtml = String(formData.get("terms_html") ?? "").trim();
  const usageRights = String(formData.get("usage_rights") ?? "").trim();
  const exclusivity = String(formData.get("exclusivity") ?? "").trim();
  const attachmentUrl = String(formData.get("attachment_url") ?? "").trim();
  const status = String(formData.get("status") ?? "draft") as VendorIoStatus;

  if (!id || !campaignHeaderId) return { ok: false, message: "Missing IO context." };

  const { supabase, user, error } = await requireAuthUser();
  if (error || !user) return { ok: false, message: error ?? "Unauthorized" };

  const { error: updateError } = await supabase
    .from("vendor_ios")
    .update({
      terms_text: termsText || null,
      terms_html: termsHtml || null,
      usage_rights: usageRights || null,
      exclusivity: exclusivity || null,
      attachment_url: attachmentUrl || null,
      status,
      updated_by: user.id,
    } as never)
    .eq("id", id);

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  debugIo("vendor-io", "updated draft", { id, status });
  revalidateIoPaths(campaignHeaderId);
  return { ok: true, message: "Vendor IO saved." };
}

export async function sendVendorIoAction(
  _prev: IoActionState,
  formData: FormData
): Promise<IoActionState> {
  const id = String(formData.get("id") ?? "");
  const campaignHeaderId = String(formData.get("campaign_header_id") ?? "");
  if (!id || !campaignHeaderId) return { ok: false, message: "Missing IO context." };

  const { supabase, user, error } = await requireAuthUser();
  if (error || !user) return { ok: false, message: error ?? "Unauthorized" };

  const { data, error: rpcError } = await (supabase as any).rpc("send_vendor_io", {
    p_vendor_io_id: id,
    p_actor_id: user.id,
  });

  if (rpcError) return { ok: false, message: rpcError.message };
  const token = (data as string | null) ?? "";
  const approvalUrl = token ? buildIoEmailLink("vendor", token) : null;

  debugIo("io-email", "vendor io send trigger", { id, approvalUrl });
  revalidateIoPaths(campaignHeaderId);
  return { ok: true, message: "Vendor IO sent." };
}

