import type { SupabaseClient } from "@supabase/supabase-js";

import type { ClientCategoryClassification } from "@/lib/clients/classify-client-category-types";
import { normalizeCompanyNameForCache } from "@/lib/clients/normalize-company-name";

export type ClientClassificationCacheRow = {
  id: string;
  company_name_normalized: string;
  category_slug: string;
  subcategory_slug: string;
  confidence: number;
  source: string;
  classification_reason: string | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
};

export function cacheKeyForCompanyName(companyName: string): string {
  return normalizeCompanyNameForCache(companyName);
}

export async function lookupClientClassificationCache(
  supabase: SupabaseClient,
  companyName: string
): Promise<ClientCategoryClassification | null> {
  const key = cacheKeyForCompanyName(companyName);
  if (key.length < 2) {
    return null;
  }

  const { data, error } = await supabase
    .from("client_classification_cache")
    .select(
      "category_slug, subcategory_slug, confidence, source, classification_reason"
    )
    .eq("company_name_normalized", key)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    categorySlug: data.category_slug,
    subcategorySlug: data.subcategory_slug,
    confidence: Number(data.confidence),
    source: data.source as ClientCategoryClassification["source"],
    reason: data.classification_reason ?? "Cached classification",
  };
}

export async function upsertClientClassificationCache(
  supabase: SupabaseClient,
  input: {
    companyName: string;
    categorySlug: string;
    subcategorySlug: string;
    confidence: number;
    source: string;
    classificationReason?: string | null;
    verified?: boolean;
  }
): Promise<void> {
  const key = cacheKeyForCompanyName(input.companyName);
  if (key.length < 2) {
    return;
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from("client_classification_cache").upsert(
    {
      company_name_normalized: key,
      category_slug: input.categorySlug,
      subcategory_slug: input.subcategorySlug,
      confidence: input.confidence,
      source: input.source,
      classification_reason: input.classificationReason ?? null,
      verified_at: input.verified ? now : null,
      updated_at: now,
    },
    { onConflict: "company_name_normalized" }
  );

  if (error) {
    console.warn("[client-classification-cache] upsert failed:", error.message);
  }
}
