import {
  getClientCategoryLabel,
  getClientSubcategoryLabel,
} from "@/lib/clients/client-category-taxonomy";
import { classificationSourceLabel } from "@/lib/clients/classify-client-category-types";
import { fetchClientRowsSafe } from "@/lib/clients/safe-client-query";
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

const CLASSIFICATION_REVIEW_COLUMNS = [
  "id",
  "name",
  "client_category",
  "client_subcategory",
  "classification_confidence",
  "classification_source",
  "classification_reason",
  "needs_review",
] as const;

export async function getClientClassificationReviewQueue(): Promise<{
  rows: ClientClassificationReviewRow[];
  error?: string;
}> {
  const supabase = await createSupabaseServerClient();

  const { rows, error, strippedColumns } = await fetchClientRowsSafe(
    supabase,
    CLASSIFICATION_REVIEW_COLUMNS,
    (select) =>
      supabase
        .from("clients")
        .select(select)
        .eq("needs_review", true)
        .order("name", { ascending: true }) as unknown as PromiseLike<{
        data: Record<string, unknown>[] | null;
        error: import("@supabase/supabase-js").PostgrestError | null;
      }>
  );

  if (error) {
    return { rows: [], error: error.message };
  }

  const stripped = new Set(strippedColumns);

  const mappedRows = rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    client_category: stripped.has("client_category")
      ? null
      : ((row.client_category as string | null | undefined) ?? null),
    client_subcategory: stripped.has("client_subcategory")
      ? null
      : ((row.client_subcategory as string | null | undefined) ?? null),
    category_label: getClientCategoryLabel(
      stripped.has("client_category")
        ? null
        : ((row.client_category as string | null | undefined) ?? null)
    ),
    subcategory_label: getClientSubcategoryLabel(
      stripped.has("client_category")
        ? null
        : ((row.client_category as string | null | undefined) ?? null),
      stripped.has("client_subcategory")
        ? null
        : ((row.client_subcategory as string | null | undefined) ?? null)
    ),
    classification_confidence: stripped.has("classification_confidence")
      ? null
      : ((row.classification_confidence as number | null | undefined) ?? null),
    classification_source: stripped.has("classification_source")
      ? null
      : ((row.classification_source as string | null | undefined) ?? null),
    source_label:
      !stripped.has("classification_source") && row.classification_source
        ? classificationSourceLabel(
            row.classification_source as Parameters<
              typeof classificationSourceLabel
            >[0]
          )
        : "—",
    classification_reason: stripped.has("classification_reason")
      ? null
      : ((row.classification_reason as string | null | undefined) ?? null),
    needs_review: stripped.has("needs_review")
      ? false
      : Boolean(row.needs_review),
  }));

  return { rows: mappedRows };
}
