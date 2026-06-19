export const CLIENT_TAXONOMY_METADATA_CATEGORY_KEY = "client_category_slug";
export const CLIENT_TAXONOMY_METADATA_SUBCATEGORY_KEY = "client_subcategory_slug";

export type ClientTaxonomySlugs = {
  client_category: string | null;
  client_subcategory: string | null;
};

export type ClientTaxonomyResolveSource = "column" | "metadata" | null;

export type ResolvedClientTaxonomy = ClientTaxonomySlugs & {
  source: ClientTaxonomyResolveSource;
};

function nonEmptySlug(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/** Read taxonomy slugs stored in clients.metadata when column writes were stripped. */
export function readClientTaxonomyFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): ClientTaxonomySlugs | null {
  if (!metadata) {
    return null;
  }

  const client_category = nonEmptySlug(metadata[CLIENT_TAXONOMY_METADATA_CATEGORY_KEY]);
  const client_subcategory = nonEmptySlug(
    metadata[CLIENT_TAXONOMY_METADATA_SUBCATEGORY_KEY]
  );

  if (!client_category && !client_subcategory) {
    return null;
  }

  return { client_category, client_subcategory };
}

/** Merge taxonomy slugs into an existing metadata object without dropping other keys. */
export function buildClientTaxonomyMetadataMerge(
  existing: Record<string, unknown> | null | undefined,
  categorySlug: string,
  subcategorySlug: string
): Record<string, unknown> {
  return {
    ...(existing ?? {}),
    [CLIENT_TAXONOMY_METADATA_CATEGORY_KEY]: categorySlug,
    [CLIENT_TAXONOMY_METADATA_SUBCATEGORY_KEY]: subcategorySlug,
  };
}

/**
 * Resolve client taxonomy from DB columns first, then metadata fallback.
 * Used when production schema lags or legacy enum writes were stripped on save.
 */
export function resolveClientTaxonomyFromRow(input: {
  client_category?: string | null;
  client_subcategory?: string | null;
  metadata?: Record<string, unknown> | null;
}): ResolvedClientTaxonomy {
  const columnCategory = nonEmptySlug(input.client_category);
  const columnSubcategory = nonEmptySlug(input.client_subcategory);

  if (columnCategory || columnSubcategory) {
    return {
      client_category: columnCategory,
      client_subcategory: columnSubcategory,
      source: "column",
    };
  }

  const fromMetadata = readClientTaxonomyFromMetadata(input.metadata);
  if (fromMetadata) {
    return {
      client_category: fromMetadata.client_category,
      client_subcategory: fromMetadata.client_subcategory,
      source: "metadata",
    };
  }

  return {
    client_category: null,
    client_subcategory: null,
    source: null,
  };
}

export function wasClientTaxonomyColumnStripped(
  strippedColumns: readonly string[]
): boolean {
  return strippedColumns.some(
    (column) => column === "client_category" || column === "client_subcategory"
  );
}
