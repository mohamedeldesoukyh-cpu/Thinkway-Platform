import assert from "node:assert/strict";

import type { SupabaseClient } from "@supabase/supabase-js";

import { enrichClientsWithTaxonomyFallback } from "./client-taxonomy-enrich";

function createMockSupabase(cacheByName: Record<string, { categorySlug: string; subcategorySlug: string } | null>) {
  return {
    from() {
      return {
        select() {
          return this;
        },
        eq(_column: string, key: string) {
          const entry = cacheByName[key];
          return {
            maybeSingle: async () => ({
              data: entry
                ? {
                    category_slug: entry.categorySlug,
                    subcategory_slug: entry.subcategorySlug,
                    confidence: 95,
                    source: "approved",
                    classification_reason: "Cached",
                  }
                : null,
              error: null,
            }),
          };
        },
      };
    },
  } as unknown as SupabaseClient;
}

async function run() {
  const supabase = createMockSupabase({
    "mind share": {
      categorySlug: "marketing_advertising_media_agencies",
      subcategorySlug: "media_agency",
    },
  });

  const enriched = await enrichClientsWithTaxonomyFallback(supabase, [
    {
      id: "client-1",
      name: "Mind Share Egypt LTD",
      client_category: null,
      client_subcategory: null,
      metadata: {},
    },
    {
      id: "client-2",
      name: "Acme",
      client_category: "retail_ecommerce",
      client_subcategory: "fashion",
      metadata: {},
    },
    {
      id: "client-3",
      name: "Metadata Only LLC",
      client_category: null,
      client_subcategory: null,
      metadata: {
        client_category_slug: "retail_ecommerce",
        client_subcategory_slug: "grocery",
      },
    },
  ]);

  assert.equal(enriched[0]?.client_category, "marketing_advertising_media_agencies");
  assert.equal(enriched[0]?.client_subcategory, "media_agency");
  assert.equal(enriched[1]?.client_category, "retail_ecommerce");
  assert.equal(enriched[2]?.client_category, "retail_ecommerce");
  assert.equal(enriched[2]?.client_subcategory, "grocery");

  console.log("client-taxonomy-enrich.test.ts: ok");
}

void run();
