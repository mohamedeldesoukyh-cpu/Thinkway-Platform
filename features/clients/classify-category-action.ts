"use server";

import { classifyClientCategory } from "@/lib/clients/classify-client-category";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ClassifyClientCategoryResult = {
  ok: boolean;
  categorySlug?: string;
  subcategorySlug?: string;
  confidence?: "high" | "medium" | "low";
  source?: "web_search" | "keyword";
  message?: string;
};

export async function classifyClientCategoryAction(input: {
  name: string;
  country?: string;
  website?: string;
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
    const result = await classifyClientCategory({
      name,
      country: input.country,
      website: input.website,
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
