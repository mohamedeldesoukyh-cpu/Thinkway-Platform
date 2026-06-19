import type { SupabaseClient } from "@supabase/supabase-js";

import { lookupClientClassificationCache } from "@/lib/clients/client-classification-cache";
import {
  resolveClientTaxonomyFromRow,
  type ClientTaxonomySlugs,
} from "@/lib/clients/client-taxonomy-resolve";

export type ClientTaxonomyEnrichInput = {
  id: string;
  name: string;
  client_category?: string | null;
  client_subcategory?: string | null;
  metadata?: Record<string, unknown> | null;
};

function hasTaxonomySlugs(taxonomy: ClientTaxonomySlugs): boolean {
  return Boolean(taxonomy.client_category || taxonomy.client_subcategory);
}

function resolvedFromRow(client: ClientTaxonomyEnrichInput): ClientTaxonomySlugs {
  const resolved = resolveClientTaxonomyFromRow(client);
  return {
    client_category: resolved.client_category,
    client_subcategory: resolved.client_subcategory,
  };
}

/**
 * Fill missing client taxonomy from metadata and classification cache.
 * Classification cache is populated on overview save even when legacy enum
 * columns reject slug writes (22P02).
 */
export async function enrichClientsWithTaxonomyFallback<
  T extends ClientTaxonomyEnrichInput,
>(supabase: SupabaseClient, clients: readonly T[]): Promise<T[]> {
  if (clients.length === 0) {
    return [];
  }

  const enriched = clients.map((client) => {
    const taxonomy = resolvedFromRow(client);
    if (hasTaxonomySlugs(taxonomy)) {
      return {
        ...client,
        client_category: taxonomy.client_category,
        client_subcategory: taxonomy.client_subcategory,
      };
    }
    return client;
  });

  const missing = enriched.filter((client) => !hasTaxonomySlugs(resolvedFromRow(client)));
  if (missing.length === 0) {
    return enriched;
  }

  const cacheByClientId = new Map<string, ClientTaxonomySlugs>();

  await Promise.all(
    missing.map(async (client) => {
      const cached = await lookupClientClassificationCache(supabase, client.name);
      if (!cached?.categorySlug && !cached?.subcategorySlug) {
        return;
      }
      cacheByClientId.set(client.id, {
        client_category: cached.categorySlug ?? null,
        client_subcategory: cached.subcategorySlug ?? null,
      });
    })
  );

  return enriched.map((client) => {
    const cached = cacheByClientId.get(client.id);
    if (!cached) {
      return client;
    }

    const current = resolvedFromRow(client);
    if (hasTaxonomySlugs(current)) {
      return client;
    }

    if (process.env.NODE_ENV === "development") {
      console.info(
        `[clients] taxonomy enriched from classification cache for ${client.name} (${client.id})`
      );
    }

    return {
      ...client,
      client_category: cached.client_category,
      client_subcategory: cached.client_subcategory,
    };
  });
}
