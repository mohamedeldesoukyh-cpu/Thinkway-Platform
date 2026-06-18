"use server";

import { revalidatePath } from "next/cache";

import { classifyClientCategoryAction } from "@/features/clients/classify-category-action";
import { upsertClientClassificationCache } from "@/lib/clients/client-classification-cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ClassificationReviewActionState = {
  ok: boolean;
  message?: string;
};

async function requireAuthUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    return { supabase, user: null, error: error.message };
  }

  if (!user) {
    return { supabase, user: null, error: "You must be signed in to continue." };
  }

  return { supabase, user, error: null };
}

function revalidateReviewPaths(clientId?: string) {
  revalidatePath("/settings/client-classification-review");
  revalidatePath("/clients");
  if (clientId) {
    revalidatePath(`/clients/${clientId}`);
  }
}

export async function approveClientClassificationAction(
  clientId: string
): Promise<ClassificationReviewActionState> {
  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const { data: client, error: fetchError } = await supabase
    .from("clients")
    .select(
      "id, name, client_category, client_subcategory, classification_source, classification_confidence, classification_reason"
    )
    .eq("id", clientId)
    .maybeSingle();

  if (fetchError || !client) {
    return { ok: false, message: fetchError?.message ?? "Client not found." };
  }

  if (!client.client_category || !client.client_subcategory) {
    return { ok: false, message: "Client has no classification to approve." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("clients")
    .update({
      needs_review: false,
      approved_by_user: user.id,
      last_verified_at: now,
    })
    .eq("id", clientId);

  if (error) {
    return { ok: false, message: error.message };
  }

  if (client.classification_source && client.classification_confidence != null) {
    await upsertClientClassificationCache(supabase, {
      companyName: client.name,
      categorySlug: client.client_category,
      subcategorySlug: client.client_subcategory,
      confidence: client.classification_confidence,
      source: client.classification_source,
      classificationReason: client.classification_reason,
      verified: true,
    });
  }

  revalidateReviewPaths(clientId);
  return { ok: true, message: "Classification approved." };
}

export async function rejectClientClassificationAction(
  clientId: string
): Promise<ClassificationReviewActionState> {
  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const { error } = await supabase
    .from("clients")
    .update({
      needs_review: false,
      client_category: null,
      client_subcategory: null,
      classification_source: null,
      classification_confidence: null,
      classification_reason: null,
      classified_at: null,
      approved_by_user: null,
      last_verified_at: null,
    })
    .eq("id", clientId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateReviewPaths(clientId);
  return {
    ok: true,
    message: "Suggestion rejected — classify manually from the client profile.",
  };
}

export async function reclassifyClientAction(
  clientId: string
): Promise<ClassificationReviewActionState> {
  const { supabase, user, error: authError } = await requireAuthUser();
  if (authError || !user) {
    return { ok: false, message: authError ?? "Unauthorized" };
  }

  const { data: client, error: fetchError } = await supabase
    .from("clients")
    .select("id, name, country, website")
    .eq("id", clientId)
    .maybeSingle();

  if (fetchError || !client) {
    return { ok: false, message: fetchError?.message ?? "Client not found." };
  }

  const result = await classifyClientCategoryAction({
    name: client.name,
    country: client.country ?? undefined,
    website: client.website ?? undefined,
    clientId: client.id,
    useStoredApproved: false,
  });

  if (!result.ok || !result.categorySlug || !result.subcategorySlug) {
    return {
      ok: false,
      message: result.message ?? "Re-classification did not return a match.",
    };
  }

  const now = new Date().toISOString();
  const needsReview = result.needsReview ?? false;

  const { error } = await supabase
    .from("clients")
    .update({
      client_category: result.categorySlug,
      client_subcategory: result.subcategorySlug,
      classification_source: result.source ?? "fallback",
      classification_confidence: result.confidence ?? null,
      classification_reason: result.reason ?? null,
      classified_at: now,
      needs_review: needsReview,
      approved_by_user: needsReview ? null : user.id,
      last_verified_at: needsReview ? null : now,
    })
    .eq("id", clientId);

  if (error) {
    return { ok: false, message: error.message };
  }

  if (!needsReview && result.source && result.confidence != null) {
    await upsertClientClassificationCache(supabase, {
      companyName: client.name,
      categorySlug: result.categorySlug,
      subcategorySlug: result.subcategorySlug,
      confidence: result.confidence,
      source: result.source,
      classificationReason: result.reason,
      verified: true,
    });
  }

  revalidateReviewPaths(clientId);
  return { ok: true, message: "Client re-classified." };
}
