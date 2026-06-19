import type { SupabaseClient } from "@supabase/supabase-js";

import {
  buildClientTaxonomyMetadataMerge,
} from "@/lib/clients/client-taxonomy-resolve";
import { fetchClientRowSafe } from "@/lib/clients/safe-client-query";

/** Persist taxonomy slugs in clients.metadata when column writes were stripped. */
export async function persistClientTaxonomyMetadataFallback(
  supabase: SupabaseClient,
  clientId: string,
  categorySlug: string,
  subcategorySlug: string
): Promise<void> {
  const { row, error } = await fetchClientRowSafe(supabase, clientId, ["metadata"]);

  if (error) {
    console.warn(
      `[clients] could not load metadata for taxonomy fallback on client ${clientId}:`,
      error.message
    );
    return;
  }

  const existingMetadata =
    row?.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};

  const { error: updateError } = await supabase
    .from("clients")
    .update({
      metadata: buildClientTaxonomyMetadataMerge(
        existingMetadata,
        categorySlug,
        subcategorySlug
      ),
    })
    .eq("id", clientId);

  if (updateError) {
    console.warn(
      `[clients] taxonomy metadata fallback failed for client ${clientId}:`,
      updateError.message
    );
    return;
  }

  if (process.env.NODE_ENV === "development") {
    console.info(
      `[clients] taxonomy persisted to metadata for client ${clientId} (legacy enum column write was stripped)`
    );
  }
}
