"use server";

import { revalidatePath } from "next/cache";

import {
  classifyClientCategory,
  isClientCategoryAiAvailable,
} from "@/lib/clients/classify-client-category";
import { lookupClientClassificationCache } from "@/lib/clients/client-classification-cache";
import { computeNeedsReview } from "@/lib/clients/client-classification-review";
import { findHistoricalClientClassification } from "@/lib/clients/classify-client-category-historical";
import type { ClientClassificationSource } from "@/lib/clients/classify-client-category-types";
import { isValidClientCategoryPair } from "@/lib/clients/client-category-taxonomy";
import { fetchClientRowSafe } from "@/lib/clients/safe-client-query";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ClassifyClientCategoryResult = {
  ok: boolean;
  categorySlug?: string;
  subcategorySlug?: string;
  confidence?: number;
  source?: ClientClassificationSource;
  reason?: string;
  needsReview?: boolean;
  message?: string;
};

export type ClientCategoryClassificationCapabilities = {
  aiAvailable: boolean;
};

export async function getClientCategoryClassificationCapabilitiesAction(): Promise<ClientCategoryClassificationCapabilities> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { aiAvailable: false };
  }

  return { aiAvailable: isClientCategoryAiAvailable() };
}

export async function classifyClientCategoryAction(input: {
  name: string;
  country?: string;
  website?: string;
  clientId?: string;
  /** Skip auto-classify when client already has user-approved classification */
  useStoredApproved?: boolean;
}): Promise<ClassifyClientCategoryResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return { ok: false, message: authError.message };
  }

  if (!user) {
    return { ok: false, message: "You must be signed in to continue." };
  }

  const name = input.name?.trim();
  if (!name || name.length < 2) {
    return { ok: false, message: "Enter a client name to classify." };
  }

  try {
    let approvedClassification = null;

    if (input.clientId && input.useStoredApproved) {
      const { row: client } = await fetchClientRowSafe(supabase, input.clientId, [
        "name",
        "client_category",
        "client_subcategory",
        "classification_source",
        "classification_confidence",
        "classification_reason",
        "approved_by_user",
      ]);

      if (
        client?.approved_by_user &&
        client.client_category &&
        client.client_subcategory &&
        isValidClientCategoryPair(
          String(client.client_category),
          String(client.client_subcategory)
        )
      ) {
        approvedClassification = {
          categorySlug: String(client.client_category),
          subcategorySlug: String(client.client_subcategory),
          confidence: Number(client.classification_confidence ?? 100),
          source:
            (client.classification_source as ClientClassificationSource) ??
            "approved",
          reason:
            client.classification_reason != null
              ? String(client.classification_reason)
              : undefined,
        };
      }
    }

    if (approvedClassification) {
      const result = await classifyClientCategory({
        name,
        country: input.country,
        website: input.website,
        approvedClassification,
      });
      if (!result) {
        return { ok: false, message: "No automatic match — choose category below if needed." };
      }
      return {
        ok: true,
        categorySlug: result.categorySlug,
        subcategorySlug: result.subcategorySlug,
        confidence: result.confidence,
        source: result.source,
        reason: result.reason,
        needsReview: computeNeedsReview(result.confidence, result.source),
      };
    }

    const cacheHit = await lookupClientClassificationCache(supabase, name);
    if (cacheHit) {
      return {
        ok: true,
        categorySlug: cacheHit.categorySlug,
        subcategorySlug: cacheHit.subcategorySlug,
        confidence: cacheHit.confidence,
        source: cacheHit.source,
        reason: cacheHit.reason ?? "Cached classification",
        needsReview: computeNeedsReview(cacheHit.confidence, cacheHit.source),
      };
    }

    const historicalMatch =
      input.clientId
        ? await findHistoricalClientClassification(supabase, name, {
            excludeClientId: input.clientId,
          })
        : await findHistoricalClientClassification(supabase, name);

    const result = await classifyClientCategory({
      name,
      country: input.country,
      website: input.website,
      historicalMatch,
    });

    if (!result) {
      return {
        ok: false,
        message: "No automatic match — choose category below if needed.",
      };
    }

    return {
      ok: true,
      categorySlug: result.categorySlug,
      subcategorySlug: result.subcategorySlug,
      confidence: result.confidence,
      source: result.source,
      reason: result.reason,
      needsReview: computeNeedsReview(result.confidence, result.source),
    };
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error
          ? e.message
          : "Classification unavailable — choose category below.",
    };
  }
}
