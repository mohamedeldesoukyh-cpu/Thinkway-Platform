"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/permissions-server";
import { QUOTATION_PERMISSIONS, quotationDetailPath } from "@/lib/domains/commercial/quotation-constants";
import { canGenerateFromCampaignPlan } from "@/lib/domains/commercial/campaign-plan-provenance";
import { resolveCampaignObjectHead } from "@/lib/domains/commercial/resolve-campaign-object-head";
import { generateQuotationFromCampaignPlan } from "@/lib/services/quotations/generate-quotation-from-campaign-plan";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const generateQuotationSchema = z.object({
  campaignObjectId: z.string().uuid(),
  brandId: z.string().uuid().optional(),
  quotationName: z.string().trim().max(200).optional(),
  conversationId: z.string().uuid().optional(),
  anchorStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export type GenerateQuotationFromPlanInput = z.infer<typeof generateQuotationSchema>;

export type GenerateQuotationFromPlanResult =
  | {
      ok: true;
      quotationId: string;
      serialNumber: string | null;
      itemsCreated: number;
      alreadyExists: boolean;
      message: string;
      href: string;
    }
  | { ok: false; message: string };

export type CampaignPlanQuotationContext = {
  lifecycleStatus: string;
  canGenerate: boolean;
  existingQuotation: { id: string; serialNumber: string | null } | null;
  brandId: string | null;
  brandName: string | null;
};

export async function getCampaignPlanQuotationContext(input: {
  campaignObjectId: string;
  conversationId?: string;
}): Promise<CampaignPlanQuotationContext | { error: string } | null> {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, QUOTATION_PERMISSIONS.read);
  if ("error" in auth) return { error: auth.error };

  const resolved = await resolveCampaignObjectHead(supabase, input);
  if (resolved.error) return { error: resolved.error };
  const head = resolved.head;
  if (!head) return null;

  const { data: existingQuotation } = await supabase
    .from("quotations")
    .select("id, serial_number")
    .eq("campaign_object_id", head.id)
    .eq("is_archived", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let brandId: string | null = null;
  let brandName: string | null = null;
  const conversationId = input.conversationId ?? head.conversation_id;
  if (conversationId) {
    const { data: conversation } = await supabase
      .from("ai_conversations")
      .select("workspace_type, workspace_id")
      .eq("id", conversationId)
      .maybeSingle();

    const row = conversation as {
      workspace_type?: string;
      workspace_id?: string | null;
    } | null;

    if (row?.workspace_id) {
      if (row.workspace_type === "quotation") {
        const { data: quotation } = await supabase
          .from("quotations")
          .select("brand_id, temporary_brand_name")
          .eq("id", row.workspace_id)
          .maybeSingle();
        brandId = (quotation as { brand_id?: string | null } | null)?.brand_id ?? null;
      } else if (row.workspace_type === "shortlist") {
        const { data: shortlist } = await supabase
          .from("discovery_shortlists")
          .select("brand_id")
          .eq("id", row.workspace_id)
          .maybeSingle();
        brandId = (shortlist as { brand_id?: string | null } | null)?.brand_id ?? null;
      }
    }
  }

  if (brandId) {
    const { data: brand } = await supabase
      .from("brands")
      .select("name")
      .eq("id", brandId)
      .maybeSingle();
    brandName = (brand as { name?: string } | null)?.name ?? null;
  }

  return {
    lifecycleStatus: head.lifecycle_status,
    canGenerate: canGenerateFromCampaignPlan(head.lifecycle_status),
    existingQuotation: existingQuotation
      ? {
          id: existingQuotation.id,
          serialNumber: existingQuotation.serial_number,
        }
      : null,
    brandId,
    brandName,
  };
}

export async function generateQuotationFromPlanAction(
  input: GenerateQuotationFromPlanInput
): Promise<GenerateQuotationFromPlanResult> {
  const parsed = generateQuotationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid input for quotation generation." };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, QUOTATION_PERMISSIONS.write);
  if ("error" in auth) {
    return { ok: false, message: "You need quotation write access to generate a quotation." };
  }

  const result = await generateQuotationFromCampaignPlan(supabase, auth.userId, parsed.data);
  if (!result.ok) return result;

  revalidatePath(quotationDetailPath(result.quotationId));

  return {
    ...result,
    href: quotationDetailPath(result.quotationId),
  };
}
