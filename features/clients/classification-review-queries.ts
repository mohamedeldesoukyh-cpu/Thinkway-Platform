import {
  getClientCategoryLabel,
  getClientSubcategoryLabel,
} from "@/lib/clients/client-category-taxonomy";
import { classificationSourceLabel } from "@/lib/clients/classify-client-category-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ClientClassificationReviewRow = {
  id: string;
  name: string;
  client_category: string | null;
  client_subcategory: string | null;
  category_label: string;
  subcategory_label: string;
  classification_confidence: number | null;
  classification_source: string | null;
  source_label: string;
  classification_reason: string | null;
  needs_review: boolean;
};

export async function getClientClassificationReviewQueue(): Promise<{
  rows: ClientClassificationReviewRow[];
  error?: string;
}> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("clients")
    .select(
      "id, name, client_category, client_subcategory, classification_confidence, classification_source, classification_reason, needs_review"
    )
    .eq("needs_review", true)
    .order("name", { ascending: true });

  if (error) {
    return { rows: [], error: error.message };
  }

  const rows = (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    client_category: row.client_category,
    client_subcategory: row.client_subcategory,
    category_label: getClientCategoryLabel(row.client_category),
    subcategory_label: getClientSubcategoryLabel(
      row.client_category,
      row.client_subcategory
    ),
    classification_confidence: row.classification_confidence,
    classification_source: row.classification_source,
    source_label: row.classification_source
      ? classificationSourceLabel(
          row.classification_source as Parameters<typeof classificationSourceLabel>[0]
        )
      : "—",
    classification_reason: row.classification_reason,
    needs_review: row.needs_review,
  }));

  return { rows };
}
