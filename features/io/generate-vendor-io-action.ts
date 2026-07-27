"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { parseLineAssignment } from "@/features/campaigns/line-assignment";
import { resolveActiveVendorIoId } from "@/lib/io/vendor-io-active-link";
import { resolveVendorIoLineAmount } from "@/lib/io/vendor-io-line-amount";
import {
  explainVendorIoGenerateEligibility,
  logVendorIoEligibility,
} from "@/lib/io/vendor-io-generate-eligibility";
import { generateVendorIoDocument } from "@/lib/io/vendor-io-document-service";
import { syncCampaignHeaderStatus } from "@/lib/campaigns/sync-campaign-header-status";
import { ensureCommercialCreatorFromVendorIo } from "@/lib/creators/crm/activation-helpers";
import { composeCreatorAgreementTerms } from "@/lib/creators/crm/agreement-compose";
import { logVendorPaymentTimelineEvent } from "@/lib/creators/crm/payment-timeline";
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
      "id, campaign_header_id, name, revenue, revenue_before_vat, cost, cost_before_vat, currency_code, metadata, operational_status, vendor_io_id, invoice_id, billing_status"
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
    revenue_before_vat?: number | null;
    cost?: number | null;
    cost_before_vat?: number | null;
    currency_code: string;
    metadata: Record<string, unknown> | null;
    operational_status: string;
    vendor_io_id: string | null;
    invoice_id: string | null;
    billing_status: string;
  };

  const typedLines = lines as unknown as LineRow[];

  for (const line of typedLines) {
    const activeVendorIoId = await resolveActiveVendorIoId(supabase, line.vendor_io_id);
    const assignment = parseLineAssignment(line.metadata);
    const snapshot = {
      vendor_io_id: line.vendor_io_id,
      active_vendor_io_id: activeVendorIoId,
      invoice_id: line.invoice_id,
      operational_status: line.operational_status,
      billing_status: line.billing_status,
      influencer_id: assignment?.influencer_id ?? null,
      campaign_influencer_id: null,
    };
    logVendorIoEligibility(line.id, snapshot);
    const { eligible, reason } = explainVendorIoGenerateEligibility(snapshot);
    if (!eligible) {
      return {
        ok: false,
        message: `Line "${line.name}" cannot receive a Vendor IO: ${reason}`,
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
    bucket.total_fee += resolveVendorIoLineAmount(line);
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

    const [{ data: influencerDefaults }, { data: campaignHeader }] = await Promise.all([
      supabase
        .from("influencers")
        .select("vendor_io_terms_text")
        .eq("id", group.influencer_id)
        .maybeSingle(),
      supabase
        .from("campaign_headers")
        .select("client_id, brand_id")
        .eq("id", campaignId)
        .maybeSingle(),
    ]);

    const vendorDefaultTerms =
      typeof (influencerDefaults as { vendor_io_terms_text?: string | null } | null)
        ?.vendor_io_terms_text === "string"
        ? (influencerDefaults as { vendor_io_terms_text: string }).vendor_io_terms_text.trim() ||
          null
        : null;

    let composedTerms: string | null = null;
    const clientId = (campaignHeader as { client_id?: string | null } | null)?.client_id;
    const brandId = (campaignHeader as { brand_id?: string | null } | null)?.brand_id;
    if (clientId) {
      try {
        const composed = await composeCreatorAgreementTerms(supabase, {
          influencerId: group.influencer_id,
          clientId,
          brandId,
          preferSavedTemplate: true,
        });
        if (composed.termsText.trim()) {
          composedTerms = composed.termsText.trim();
        }
      } catch {
        composedTerms = null;
      }
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
        // Prefer composed client/brand agreement; else vendor defaults; else platform.
        terms_text: composedTerms ?? vendorDefaultTerms,
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
          billing_status: "moved_to_billing",
        } as never)
        .eq("id", line.id);

      if (lineUpdateError) {
        return { ok: false, message: lineUpdateError.message };
      }
    }

    try {
      await generateVendorIoDocument(supabase, vendorIoId, user.id);
    } catch (docError) {
      return {
        ok: false,
        message:
          docError instanceof Error
            ? `Vendor IO created but document generation failed: ${docError.message}`
            : "Vendor IO created but document generation failed.",
      };
    }

    await ensureCommercialCreatorFromVendorIo(supabase, {
      influencerId: group.influencer_id,
      vendorIoId,
      actorId: user.id,
      bypassRoleCheck: true,
    });

    await logVendorPaymentTimelineEvent(supabase, {
      influencerId: group.influencer_id,
      assignmentId,
      vendorIoId,
      eventType: "io_generated",
      summary: "IO generated",
      actorId: user.id,
    });

    created += 1;
  }

  await syncCampaignHeaderStatus(supabase, campaignId);

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/ios/vendor");
  revalidatePath("/campaigns");
  revalidatePath("/ios/vendor");
  revalidatePath("/vendors");

  const docNumbers = created === 1 ? "Vendor IO" : `${created} Vendor IOs`;
  return {
    ok: true,
    message: `${docNumbers} generated for ${typedLines.length} assignment line(s). Lines are now invoice-eligible.`,
    created,
  };
}
