"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  isLineUngenerateIoEligible,
  vendorIoUngenerateEligibility,
  type VendorIoLineBillingSnapshot,
} from "@/lib/io/vendor-io-ungenerate-eligibility";
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

async function loadLinkedLineSnapshots(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  vendorIoId: string
): Promise<VendorIoLineBillingSnapshot[]> {
  const snapshots: VendorIoLineBillingSnapshot[] = [];
  const seen = new Set<string>();

  const { data: directLines } = await supabase
    .from("campaign_lines")
    .select("id, operational_status, invoice_id, billing_status")
    .eq("vendor_io_id", vendorIoId);

  for (const row of directLines ?? []) {
    const line = row as VendorIoLineBillingSnapshot & { id: string };
    if (seen.has(line.id)) continue;
    seen.add(line.id);
    snapshots.push(line);
  }

  const { data: joinRows } = await supabase
    .from("vendor_io_lines")
    .select(
      "campaign_line:campaign_lines(id, operational_status, invoice_id, billing_status)"
    )
    .eq("vendor_io_id", vendorIoId);

  for (const join of joinRows ?? []) {
    const line = (join as { campaign_line: VendorIoLineBillingSnapshot & { id: string } | null })
      .campaign_line;
    if (!line || seen.has(line.id)) continue;
    seen.add(line.id);
    snapshots.push(line);
  }

  return snapshots;
}

async function ungenerateOneVendorIo(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  vendorIoId: string,
  campaignId: string
): Promise<{ ok: true; documentNumber: string } | { ok: false; message: string }> {
  const { data: vendorIo, error: vioError } = await supabase
    .from("vendor_ios")
    .select("id, document_number, campaign_header_id")
    .eq("id", vendorIoId)
    .eq("campaign_header_id", campaignId)
    .maybeSingle();

  if (vioError || !vendorIo) {
    return { ok: false, message: vioError?.message ?? "Vendor IO not found." };
  }

  const lineSnapshots = await loadLinkedLineSnapshots(supabase, vendorIoId);
  const eligibility = vendorIoUngenerateEligibility(lineSnapshots);
  if (!eligibility.eligible) {
    return { ok: false, message: eligibility.reason ?? "Not eligible to un-generate." };
  }

  const lineIds = new Set<string>();
  const { data: directIds } = await supabase
    .from("campaign_lines")
    .select("id")
    .eq("vendor_io_id", vendorIoId);
  for (const row of directIds ?? []) {
    lineIds.add((row as { id: string }).id);
  }

  const { data: joinIds } = await supabase
    .from("vendor_io_lines")
    .select("campaign_line_id")
    .eq("vendor_io_id", vendorIoId);
  for (const row of joinIds ?? []) {
    lineIds.add((row as { campaign_line_id: string }).campaign_line_id);
  }

  if (lineIds.size > 0) {
    const { error: lineResetError } = await supabase
      .from("campaign_lines")
      .update({
        vendor_io_id: null,
        operational_status: "draft",
      } as never)
      .in("id", [...lineIds]);

    if (lineResetError) {
      return { ok: false, message: lineResetError.message };
    }
  }

  const { error: deleteError } = await supabase
    .from("vendor_ios")
    .delete()
    .eq("id", vendorIoId);

  if (deleteError) {
    return { ok: false, message: deleteError.message };
  }

  const documentNumber =
    (vendorIo as { document_number?: string | null }).document_number ?? "Vendor IO";

  return { ok: true, documentNumber };
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

  const result = await ungenerateOneVendorIo(supabase, vendorIoId, campaignId);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  await syncCampaignHeaderStatus(supabase, campaignId);

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/campaigns");
  revalidatePath("/ios/vendor");

  return {
    ok: true,
    message: `${result.documentNumber} un-generated. Linked assignment lines are draft again and can receive a new Vendor IO.`,
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

  const vendorIoIds = new Set<string>();
  for (const row of lines ?? []) {
    const line = row as VendorIoLineBillingSnapshot & {
      id: string;
      vendor_io_id: string | null;
    };
    if (!isLineUngenerateIoEligible(line)) {
      return {
        ok: false,
        message: "Selected lines include invoiced assignments — un-generate IO is not allowed.",
      };
    }
    if (line.vendor_io_id) {
      vendorIoIds.add(line.vendor_io_id);
    }
  }

  if (vendorIoIds.size === 0) {
    return {
      ok: false,
      message: "Selected lines have no Vendor IO to un-generate.",
    };
  }

  const docNumbers: string[] = [];
  for (const vendorIoId of vendorIoIds) {
    const result = await ungenerateOneVendorIo(supabase, vendorIoId, campaignId);
    if (!result.ok) {
      return { ok: false, message: result.message };
    }
    docNumbers.push(result.documentNumber);
  }

  await syncCampaignHeaderStatus(supabase, campaignId);

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/campaigns");
  revalidatePath("/ios/vendor");

  const label =
    docNumbers.length === 1
      ? docNumbers[0]
      : `${docNumbers.length} Vendor IOs (${docNumbers.join(", ")})`;

  return {
    ok: true,
    message: `${label} un-generated. Assignment lines are draft again.`,
  };
}
