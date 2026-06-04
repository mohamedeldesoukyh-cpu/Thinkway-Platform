"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { parseLineAssignment } from "@/features/campaigns/line-assignment";
import { isLineVendorIoGenerateEligible } from "@/lib/io/vendor-io-generate-eligibility";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const generateVendorIoSchema = z.object({
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
});

export type GenerateVendorIoState = {
  ok: boolean;
  message?: string;
  created?: number;
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

export async function generateVendorIosFromLinesAction(
  _prev: GenerateVendorIoState,
  formData: FormData
): Promise<GenerateVendorIoState> {
  const parsed = generateVendorIoSchema.safeParse({
    campaign_id: formData.get("campaign_id"),
    line_ids: formData.get("line_ids"),
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
    .select(
      "id, campaign_header_id, name, revenue, currency_code, metadata, operational_status, vendor_io_id, invoice_id, billing_status"
    )
    .eq("campaign_header_id", campaignId)
    .in("id", lineIds);

  if (linesError) {
    return { ok: false, message: linesError.message };
  }

  if (!lines?.length) {
    return { ok: false, message: "No assignment lines found." };
  }

  type LineRow = {
    id: string;
    campaign_header_id: string;
    name: string;
    revenue: number;
    currency_code: string;
    metadata: Record<string, unknown> | null;
    operational_status: string;
    vendor_io_id: string | null;
    invoice_id: string | null;
    billing_status: string;
  };

  const typedLines = lines as unknown as LineRow[];

  for (const line of typedLines) {
    if (
      !isLineVendorIoGenerateEligible({
        vendor_io_id: line.vendor_io_id,
        invoice_id: line.invoice_id,
        operational_status: line.operational_status,
        billing_status: line.billing_status,
      })
    ) {
      return {
        ok: false,
        message: `Line ${line.name} cannot receive a Vendor IO (already linked, invoiced, or closed).`,
      };
    }
  }

  const groups = new Map<
    string,
    { influencer_id: string; influencer_name: string; lines: LineRow[]; total_fee: number; currency: string }
  >();

  for (const line of typedLines) {
    const assignment = parseLineAssignment(line.metadata);
    if (!assignment?.influencer_id) {
      return {
        ok: false,
        message: `Line "${line.name}" has no influencer assignment. Assign a creator first.`,
      };
    }
    const key = assignment.influencer_id;
    const bucket = groups.get(key) ?? {
      influencer_id: assignment.influencer_id,
      influencer_name: assignment.influencer_name,
      lines: [],
      total_fee: 0,
      currency: line.currency_code || "USD",
    };
    bucket.lines.push(line);
    bucket.total_fee += Number(line.revenue) || 0;
    groups.set(key, bucket);
  }

  let created = 0;

  for (const group of groups.values()) {
    const primaryLine = group.lines[0]!;

    const { data: existingCi } = await supabase
      .from("campaign_influencers")
      .select("id")
      .eq("campaign_line_id", primaryLine.id)
      .eq("influencer_id", group.influencer_id)
      .maybeSingle();

    let assignmentId = existingCi?.id as string | undefined;

    if (!assignmentId) {
      const { data: insertedCi, error: ciError } = await supabase
        .from("campaign_influencers")
        .insert({
          campaign_header_id: campaignId,
          campaign_line_id: primaryLine.id,
          influencer_id: group.influencer_id,
          status: "confirmed",
          agreed_fee: group.total_fee,
          currency: primaryLine.currency_code || "USD",
          deliverable_count: 0,
        } as never)
        .select("id")
        .single();

      if (ciError || !insertedCi) {
        return { ok: false, message: ciError?.message ?? "Failed to link influencer assignment." };
      }
      assignmentId = (insertedCi as { id: string }).id;
    }

    const { data: vendorIo, error: vioError } = await supabase
      .from("vendor_ios")
      .insert({
        assignment_id: assignmentId,
        campaign_header_id: campaignId,
        influencer_id: group.influencer_id,
        amount: group.total_fee,
        currency_code: group.currency,
        status: "draft",
        terms_text: `Vendor IO for ${group.influencer_name} — ${group.lines.length} assignment line(s).`,
        created_by: user.id,
        updated_by: user.id,
        revision_number: 0,
      } as never)
      .select("id, document_number")
      .single();

    if (vioError || !vendorIo) {
      return { ok: false, message: vioError?.message ?? "Vendor IO creation failed." };
    }

    const vendorIoId = (vendorIo as { id: string }).id;

    for (const line of group.lines) {
      const { error: linkError } = await supabase.from("vendor_io_lines").insert({
        vendor_io_id: vendorIoId,
        campaign_line_id: line.id,
      } as never);

      if (linkError) {
        return { ok: false, message: linkError.message };
      }

      const { error: lineUpdateError } = await supabase
        .from("campaign_lines")
        .update({
          vendor_io_id: vendorIoId,
          operational_status: "io_generated",
        } as never)
        .eq("id", line.id);

      if (lineUpdateError) {
        return { ok: false, message: lineUpdateError.message };
      }
    }

    created += 1;
  }

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/campaigns");
  revalidatePath("/ios/vendor");

  const docNumbers = created === 1 ? "Vendor IO" : `${created} Vendor IOs`;
  return {
    ok: true,
    message: `${docNumbers} generated for ${typedLines.length} assignment line(s). Lines are now invoice-eligible.`,
    created,
  };
}
