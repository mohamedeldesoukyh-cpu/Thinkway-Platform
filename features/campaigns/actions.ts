"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ClientCreditLimitCheck } from "@/lib/finance/client-credit-exposure";
import {
  createCampaign,
  duplicateCampaign,
  getClientTaxonomy,
  updateCampaignHeader,
} from "@/lib/services/campaigns/campaign-service";
import { createDeliverable } from "@/lib/services/campaigns/campaign-assignment-service";
import {
  createCampaignLine,
  updateCampaignLine,
} from "@/lib/services/campaigns/campaign-line-service";
import { updateAssignmentCommercialNotes } from "@/lib/services/campaigns/assignment-commercial-notes-service";
import { updateLegacyDeliverableStatus } from "@/lib/services/campaigns/campaign-workflow-service";

import {
  createCampaignLineSchema,
  createCampaignSchema,
  createDeliverableSchema,
  duplicateCampaignSchema,
  updateCampaignHeaderSchema,
  updateCampaignLineSchema,
  updateDeliverableStatusSchema,
} from "./schemas";

export type { FormActionState } from "./form-action-state";
import type { FormActionState } from "./form-action-state";

export type CreateCampaignFormState = FormActionState & {
  creditLimit?: ClientCreditLimitCheck;
};

function revalidateCampaign(campaignId: string, clientId?: string) {
  revalidatePath("/campaigns");
  revalidatePath(`/campaigns/${campaignId}`);
  if (clientId) {
    revalidatePath(`/clients/${clientId}`);
  }
}

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

export async function createCampaignAction(
  _prevState: CreateCampaignFormState,
  formData: FormData
): Promise<CreateCampaignFormState> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = createCampaignSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const result = await createCampaign(supabase, user.id, parsed.data);

  if (!result.ok) {
    return {
      ok: false,
      message: result.message,
      creditLimit: result.creditLimit,
      fieldErrors: result.fieldErrors,
    };
  }

  revalidateCampaign(result.campaignId, result.clientId);

  return {
    ok: true,
    message: result.message,
    campaignId: result.campaignId,
  };
}

export async function updateCampaignHeaderAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = updateCampaignHeaderSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const result = await updateCampaignHeader(supabase, user.id, parsed.data);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  revalidateCampaign(parsed.data.campaign_id, result.clientId);
  return { ok: true, message: "Campaign updated." };
}

export async function createCampaignLineAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = createCampaignLineSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const result = await createCampaignLine(supabase, user.id, parsed.data);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  revalidateCampaign(parsed.data.campaign_id, result.clientId);
  return { ok: true, message: result.message };
}

export async function updateCampaignLineAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = updateCampaignLineSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const result = await updateCampaignLine(supabase, user.id, parsed.data);
  if (!result.ok) {
    return {
      ok: false,
      message: result.message,
      code: result.code,
      commercialSync: result.commercialSync,
    };
  }

  revalidateCampaign(parsed.data.campaign_id, result.clientId);
  if (result.reviseVendorIo) {
    revalidatePath("/ios/vendor");
  }
  // Also refresh linked quotation when commercials synced.
  revalidatePath("/quotations");
  return { ok: true, message: result.message };
}

export async function updateAssignmentCommercialNotesAction(input: {
  campaign_id: string;
  line_id: string;
  description?: string | null;
  usage_period?: string | null;
}): Promise<FormActionState> {
  const campaignId = input.campaign_id?.trim();
  const lineId = input.line_id?.trim();
  if (!campaignId || !lineId) {
    return { ok: false, message: "Missing Assignment context." };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const result = await updateAssignmentCommercialNotes(supabase, {
    campaignId,
    lineId,
    description: input.description,
    usagePeriod: input.usage_period,
  });
  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  revalidateCampaign(campaignId);
  revalidatePath("/quotations");
  revalidatePath("/ios/client");
  return { ok: true, message: "Saved." };
}

export async function assignCampaignVendorAction(
  _prev: FormActionState,
  _formData: FormData
): Promise<FormActionState> {
  return {
    ok: false,
    message:
      "Manual vendor assignment is deprecated. Use Assign influencer on the Assignments tab.",
  };
}

export async function updateCampaignVendorAction(
  _prev: FormActionState,
  _formData: FormData
): Promise<FormActionState> {
  return {
    ok: false,
    message:
      "Manual vendor updates are deprecated. Edit the influencer assignment on the Assignments tab.",
  };
}

export async function createDeliverableAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = createDeliverableSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const result = await createDeliverable(supabase, user.id, parsed.data);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  revalidateCampaign(parsed.data.campaign_id);
  return { ok: true, message: "Deliverable created." };
}

export async function updateDeliverableStatusAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = updateDeliverableStatusSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return { ok: false, message: "Invalid request." };
  }

  const { supabase, error: authError } = await requireAuthUser();
  if (authError) {
    return { ok: false, message: authError };
  }

  const result = await updateLegacyDeliverableStatus(supabase, parsed.data);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  revalidateCampaign(parsed.data.campaign_id);
  return { ok: true, message: "Deliverable status updated." };
}

export type InfluencerSearchState = {
  results: Awaited<
    ReturnType<
      typeof import("./queries").searchInfluencersForCampaign
    >
  >;
  error?: string;
};

export async function searchInfluencersAction(
  _prev: InfluencerSearchState,
  _formData: FormData
): Promise<InfluencerSearchState> {
  return {
    results: [],
    error: "Use the Assign influencer workflow on the Assignments tab.",
  };
}

export async function duplicateCampaignAction(
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const parsed = duplicateCampaignSchema.safeParse(
    Object.fromEntries(formData.entries())
  );
  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the errors below.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const result = await duplicateCampaign(supabase, user.id, parsed.data);
  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  revalidateCampaign(result.campaignId, result.clientId);

  return {
    ok: true,
    message: result.message,
    campaignId: result.campaignId,
  };
}

export type ClientTaxonomyActionResult = {
  ok: boolean;
  client_category: string | null;
  client_subcategory: string | null;
  message?: string;
};

/** Load legal-entity taxonomy slugs for the new campaign commercial summary. */
export async function getClientTaxonomyAction(
  clientId: string
): Promise<ClientTaxonomyActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      client_category: null,
      client_subcategory: null,
      message: authError?.message ?? "Unauthorized",
    };
  }

  return getClientTaxonomy(supabase, clientId);
}
