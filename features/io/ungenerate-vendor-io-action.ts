"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { syncCampaignHeaderStatus } from "@/lib/campaigns/sync-campaign-header-status";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ungenerateVendorIoSchema = z.object({
  vendor_io_id: z.string().uuid(),
  campaign_header_id: z.string().uuid(),
  reason: z.string().trim().min(3, "Reason is required (min 3 characters)."),
});

const ungenerateVendorIosFromLinesSchema = z.object({
  campaign_id: z.string().uuid(),
  line_ids: z
    .string()
    .transform((v) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    )
    .pipe(z.array(z.string().uuid()).min(1, "Select at least one assignment line.")),
  reason: z.string().trim().min(3, "Reason is required (min 3 characters)."),
});

export type UngenerateVendorIoState = {
  ok: boolean;
  message?: string;
};

async function requireAuth() {
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

async function reopenVendorIos(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, campaignId: string, ioIds: string[], reason: string) {
  const { error } = await supabase.rpc("reopen_vendor_ios_for_edit" as never, {p_campaign: campaignId, p_ios: ioIds, p_reason: reason} as never);
  return error ? {ok:false as const,message:error.message} : {ok:true as const};
}

export async function ungenerateVendorIoAction(
  _prev: UngenerateVendorIoState,
  formData: FormData
): Promise<UngenerateVendorIoState> {
  const parsed = ungenerateVendorIoSchema.safeParse({
    vendor_io_id: formData.get("vendor_io_id"),
    campaign_header_id: formData.get("campaign_header_id"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid request.",
    };
  }

  const { supabase, user, error: authError } = await requireAuth();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const { vendor_io_id: vendorIoId, campaign_header_id: campaignId } = parsed.data;

  const result = await reopenVendorIos(supabase, campaignId, [vendorIoId], parsed.data.reason);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  await syncCampaignHeaderStatus(supabase, campaignId);

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/campaigns");
  revalidatePath("/ios/vendor");

  return {
    ok: true,
    message: "Vendor IO reopened. Edit and save the amount and currency, then Generate Vendor IO. The previous document is preserved.",
  };
}

export async function ungenerateVendorIosFromLinesAction(
  _prev: UngenerateVendorIoState,
  formData: FormData
): Promise<UngenerateVendorIoState> {
  const parsed = ungenerateVendorIosFromLinesSchema.safeParse({
    campaign_id: formData.get("campaign_id"),
    line_ids: formData.get("line_ids"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Invalid request.",
    };
  }

  const { supabase, user, error: authError } = await requireAuth();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const { campaign_id: campaignId, line_ids: lineIds } = parsed.data;

  const { data: lines, error: linesError } = await supabase
    .from("campaign_lines")
    .select("id, vendor_io_id, operational_status, invoice_id, billing_status")
    .eq("campaign_header_id", campaignId)
    .in("id", lineIds);

  if (linesError) {
    return { ok: false, message: linesError.message };
  }

  if ((lines ?? []).length !== new Set(lineIds).size) return {ok:false,message:"Some selected assignments are unavailable. Refresh and try again."};

  const vendorIoIds = [...new Set((lines ?? []).map(line => line.vendor_io_id).filter((id): id is string => Boolean(id)))];
  if (vendorIoIds.length === 0) return {ok:false,message:"Selected assignments have no Vendor IO."};
  const result = await reopenVendorIos(supabase, campaignId, vendorIoIds, parsed.data.reason);
  if (!result.ok) return result;

  await syncCampaignHeaderStatus(supabase, campaignId);

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/campaigns");
  revalidatePath("/ios/vendor");

  return {ok:true,message:"Vendor IO reopened. Edit and save the amount and currency, then Generate Vendor IO. Previous documents are preserved."};
}
