"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canGenerateFromCampaignPlan } from "@/lib/domains/commercial/campaign-plan-provenance";
import { resolveCampaignObjectHead } from "@/lib/domains/commercial/resolve-campaign-object-head";
import { resolveCampaignPlanBrandId } from "@/lib/domains/commercial/resolve-campaign-plan-brand";
import { generateCampaignFromCampaignPlan } from "@/lib/services/campaigns/generate-campaign-from-campaign-plan";
import { CampaignObjectPersistenceService } from "@/features/campaign-intelligence/services/campaign-object-persistence";
import { getCampaignFacts } from "@/features/campaign-director/facts/facts-display-bridge";

const generateCampaignSchema = z.object({
  campaignObjectId: z.string().uuid(),
  brandId: z.string().uuid().optional(),
  campaignName: z.string().trim().max(200).optional(),
  conversationId: z.string().uuid().optional(),
});

export type GenerateCampaignFromPlanInput = z.infer<typeof generateCampaignSchema>;

export type GenerateCampaignFromPlanResult =
  | {
      ok: true;
      campaignId: string;
      documentNumber: string;
      linesCreated: number;
      alreadyExists: boolean;
      message: string;
      href: string;
    }
  | { ok: false; message: string };

export type CampaignPlanExecutionContext = {
  lifecycleStatus: string;
  canGenerate: boolean;
  existingCampaign: { id: string; documentNumber: string } | null;
  brandId: string | null;
  brandName: string | null;
};

export async function getCampaignPlanExecutionContext(input: {
  campaignObjectId: string;
  conversationId?: string;
}): Promise<CampaignPlanExecutionContext | { error: string } | null> {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "campaigns.read");
  if ("error" in auth) return { error: auth.error };

  const resolved = await resolveCampaignObjectHead(supabase, input);
  if (resolved.error) return { error: resolved.error };
  const head = resolved.head;
  if (!head) return null;

  let existingCampaign: CampaignPlanExecutionContext["existingCampaign"] = null;
  if (head.campaign_header_id) {
    const { data: linked } = await supabase
      .from("campaign_headers")
      .select("id, document_number")
      .eq("id", head.campaign_header_id)
      .maybeSingle();
    if (linked) {
      existingCampaign = {
        id: linked.id,
        documentNumber: linked.document_number,
      };
    }
  } else {
    const { data: byProvenance } = await supabase
      .from("campaign_headers")
      .select("id, document_number")
      .eq("campaign_object_id", head.id)
      .maybeSingle();
    if (byProvenance) {
      existingCampaign = {
        id: byProvenance.id,
        documentNumber: byProvenance.document_number,
      };
    }
  }

  const conversationId = input.conversationId ?? head.conversation_id;
  let brandNameHint: string | null = null;
  const tip = await CampaignObjectPersistenceService.loadVersion(
    supabase,
    head.id,
    head.current_version
  );
  if (tip?.campaignObject) {
    brandNameHint = getCampaignFacts(tip.campaignObject)?.brandName?.trim() || null;
  }

  const brandId = await resolveCampaignPlanBrandId(supabase, {
    conversationId,
    brandNameHint,
  });

  return {
    lifecycleStatus: head.lifecycle_status,
    canGenerate: canGenerateFromCampaignPlan(head.lifecycle_status),
    existingCampaign,
    brandId,
    brandName: brandNameHint,
  };
}

export async function generateCampaignFromPlanAction(
  input: GenerateCampaignFromPlanInput
): Promise<GenerateCampaignFromPlanResult> {
  const parsed = generateCampaignSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Invalid input for campaign generation." };
  }

  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "campaigns.write");
  if ("error" in auth) {
    return { ok: false, message: "You need campaign write access to generate a campaign." };
  }

  const result = await generateCampaignFromCampaignPlan(supabase, auth.userId, parsed.data);
  if (!result.ok) return result;

  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${result.campaignId}`);

  return {
    ...result,
    href: `/campaigns/${result.campaignId}`,
  };
}
