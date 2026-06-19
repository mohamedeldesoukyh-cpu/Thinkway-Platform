import {
  getClientCategoryLabel,
  getClientSubcategoryLabel,
} from "@/lib/clients/client-category-taxonomy";

export type CommercialCategorySource = {
  brandCategoryName?: string | null;
  brandSubcategoryName?: string | null;
  clientCategorySlug?: string | null;
  clientSubcategorySlug?: string | null;
};

const EMPTY_LABEL = "—";

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Resolve category/subcategory display labels for campaign and brand forms.
 * Brand master-data names take precedence; client taxonomy slugs are the fallback.
 */
export function resolveCommercialCategoryLabels(
  source: CommercialCategorySource
): { category: string; subcategory: string } {
  const brandCategory = nonEmpty(source.brandCategoryName);
  const brandSubcategory = nonEmpty(source.brandSubcategoryName);
  const clientCategorySlug = nonEmpty(source.clientCategorySlug);
  const clientSubcategorySlug = nonEmpty(source.clientSubcategorySlug);

  const category =
    brandCategory ??
    (clientCategorySlug ? getClientCategoryLabel(clientCategorySlug) : EMPTY_LABEL);

  const subcategory =
    brandSubcategory ??
    (clientSubcategorySlug
      ? getClientSubcategoryLabel(clientCategorySlug, clientSubcategorySlug)
      : EMPTY_LABEL);

  return { category, subcategory };
}
