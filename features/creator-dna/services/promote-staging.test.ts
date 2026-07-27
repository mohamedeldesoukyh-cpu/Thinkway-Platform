import assert from "node:assert/strict";
import { test } from "node:test";

import { CreatorDNAService } from "./creator-dna-service";
import { createEmptyCreatorDNADocument } from "./document-factory";
import { wrapValue } from "./field-envelope";

function stagingDocumentWithDisplayName(name: string) {
  const doc = createEmptyCreatorDNADocument();
  doc.identity.displayName = wrapValue(name, "apify", 0.9);
  return doc;
}

function createPromoteMock(options: {
  staging: null | {
    document: ReturnType<typeof stagingDocumentWithDisplayName>;
    promotedTo?: string | null;
  };
}) {
  const upserts: Array<Record<string, unknown>> = [];
  const stagingUpdates: Array<Record<string, unknown>> = [];
  const lineage: Array<Record<string, unknown>> = [];

  const from = (table: string) => {
    if (table === "creator_dna_staging") {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => {
                  if (!options.staging) return { data: null, error: null };
                  return {
                    data: {
                      id: "stg-1",
                      discovered_profile_id: "dp-1",
                      document: options.staging.document,
                      version: 1,
                      last_snapshot_id: null,
                      platform_account_id: null,
                      promoted_to_influencer_id: options.staging.promotedTo ?? null,
                      promoted_at: null,
                      created_at: "2026-01-01T00:00:00Z",
                      updated_at: "2026-01-01T00:00:00Z",
                    },
                    error: null,
                  };
                },
              };
            },
          };
        },
        update(payload: Record<string, unknown>) {
          stagingUpdates.push(payload);
          return {
            eq() {
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    }
    if (table === "creator_dna") {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({ data: null, error: null }),
              };
            },
          };
        },
        upsert(payload: Record<string, unknown>) {
          upserts.push(payload);
          return Promise.resolve({ error: null });
        },
      };
    }
    if (table === "creator_dna_versions") {
      return {
        insert() {
          return Promise.resolve({ error: null });
        },
      };
    }
    if (table === "creator_dna_lineage_events") {
      return {
        insert(payload: Record<string, unknown>) {
          lineage.push(payload);
          return Promise.resolve({ error: null });
        },
      };
    }
    throw new Error(`Unexpected table ${table}`);
  };

  return {
    supabase: { from } as never,
    upserts,
    stagingUpdates,
    lineage,
  };
}

test("promoteStaging no-ops when staging missing", async () => {
  const mock = createPromoteMock({ staging: null });
  const service = new CreatorDNAService(mock.supabase);
  const result = await service.promoteStaging("dp-1", "inf-1");
  assert.equal(result.ok, true);
  assert.equal(result.promoted, false);
  assert.equal(mock.upserts.length, 0);
});

test("promoteStaging merges staging fields and marks promoted", async () => {
  const mock = createPromoteMock({
    staging: { document: stagingDocumentWithDisplayName("Creator A") },
  });
  const service = new CreatorDNAService(mock.supabase);
  const result = await service.promoteStaging("dp-1", "inf-1");
  assert.equal(result.ok, true);
  assert.equal(result.promoted, true);
  assert.ok(result.changedFields.includes("identity.displayName"));
  assert.equal(mock.upserts.length, 1);
  assert.equal(mock.stagingUpdates.length, 1);
  assert.equal(mock.stagingUpdates[0]?.promoted_to_influencer_id, "inf-1");
  assert.ok(mock.lineage.some((e) => e.event_type === "staging_promotion"));
});

test("promoteStaging is idempotent when already promoted to same influencer", async () => {
  const mock = createPromoteMock({
    staging: {
      document: stagingDocumentWithDisplayName("Creator A"),
      promotedTo: "inf-1",
    },
  });
  const service = new CreatorDNAService(mock.supabase);
  const result = await service.promoteStaging("dp-1", "inf-1");
  assert.equal(result.ok, true);
  assert.equal(result.promoted, false);
  assert.equal(mock.upserts.length, 0);
});
