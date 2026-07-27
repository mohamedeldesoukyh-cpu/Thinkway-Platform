import assert from "node:assert/strict";
import { test } from "node:test";

import { ensureCommercialCreator } from "./ensure-commercial-creator";
import type { EnsureCommercialCreatorInput } from "./types";

type TableState = {
  profiles: Map<string, { influencer_id: string; crm_status: string }>;
  events: Array<{
    id: string;
    influencer_id: string;
    reason: string;
    source_entity_type: string | null;
    source_entity_id: string | null;
  }>;
  influencers: Set<string>;
};

function createMockSupabase(state: TableState) {
  let eventSeq = 0;

  const from = (table: string) => {
    if (table === "creator_crm_profiles") {
      return {
        select(_cols: string) {
          return {
            eq(_col: string, id: string) {
              return {
                maybeSingle: async () => {
                  const row = state.profiles.get(id);
                  return { data: row ?? null, error: null };
                },
              };
            },
          };
        },
        insert(row: {
          influencer_id: string;
          crm_status: string;
          activated_by: string | null;
          activated_reason: string;
        }) {
          if (state.profiles.has(row.influencer_id)) {
            return Promise.resolve({
              error: { code: "23505", message: "duplicate key" },
            });
          }
          state.profiles.set(row.influencer_id, {
            influencer_id: row.influencer_id,
            crm_status: row.crm_status,
          });
          return Promise.resolve({ error: null });
        },
      };
    }

    if (table === "influencers") {
      return {
        select(_cols: string) {
          return {
            eq(_col: string, id: string) {
              return {
                maybeSingle: async () => {
                  if (!state.influencers.has(id)) {
                    return { data: null, error: null };
                  }
                  return { data: { id }, error: null };
                },
              };
            },
          };
        },
      };
    }

    if (table === "creator_crm_activation_events") {
      return {
        insert(row: {
          influencer_id: string;
          reason: string;
          actor_id: string | null;
          source_entity_type: string | null;
          source_entity_id: string | null;
          metadata: Record<string, unknown>;
        }) {
          const duplicate = state.events.some(
            (e) =>
              e.influencer_id === row.influencer_id &&
              e.reason === row.reason &&
              e.source_entity_type === row.source_entity_type &&
              e.source_entity_id === row.source_entity_id &&
              row.source_entity_id != null
          );
          if (duplicate) {
            return {
              select() {
                return {
                  maybeSingle: async () => ({
                    data: null,
                    error: { code: "23505", message: "duplicate key" },
                  }),
                };
              },
            };
          }
          const id = `evt-${++eventSeq}`;
          state.events.push({
            id,
            influencer_id: row.influencer_id,
            reason: row.reason,
            source_entity_type: row.source_entity_type,
            source_entity_id: row.source_entity_id,
          });
          return {
            select() {
              return {
                maybeSingle: async () => ({ data: { id }, error: null }),
              };
            },
          };
        },
      };
    }

    throw new Error(`Unexpected table ${table}`);
  };

  return { from } as never;
}

function baseInput(
  overrides: Partial<EnsureCommercialCreatorInput> = {}
): EnsureCommercialCreatorInput {
  return {
    influencerId: "inf-1",
    reason: "campaign_assignment",
    actorId: "actor-1",
    bypassRoleCheck: true,
    ...overrides,
  };
}

test("ensureCommercialCreator creates profile + event when missing", async () => {
  const state: TableState = {
    profiles: new Map(),
    events: [],
    influencers: new Set(["inf-1"]),
  };
  const result = await ensureCommercialCreator(createMockSupabase(state), baseInput());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.created, true);
  assert.equal(result.crmStatus, "incomplete");
  assert.ok(result.eventId);
  assert.equal(state.profiles.size, 1);
  assert.equal(state.events.length, 1);
});

test("ensureCommercialCreator is idempotent on profile (created=false)", async () => {
  const state: TableState = {
    profiles: new Map([
      ["inf-1", { influencer_id: "inf-1", crm_status: "prospect" }],
    ]),
    events: [],
    influencers: new Set(["inf-1"]),
  };
  const first = await ensureCommercialCreator(
    createMockSupabase(state),
    baseInput({
      reason: "vendor_io",
      sourceEntityType: "vendor_io",
      sourceEntityId: "vio-1",
    })
  );
  const second = await ensureCommercialCreator(
    createMockSupabase(state),
    baseInput({
      reason: "vendor_io",
      sourceEntityType: "vendor_io",
      sourceEntityId: "vio-1",
    })
  );
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (!first.ok || !second.ok) return;
  assert.equal(first.created, false);
  assert.equal(second.created, false);
  assert.equal(second.crmStatus, "prospect");
  assert.equal(state.profiles.size, 1);
  // Unique source: second event insert soft-fails → null eventId
  assert.equal(state.events.length, 1);
  assert.equal(second.eventId, null);
});

test("ensureCommercialCreator records distinct source events without duplicating profile", async () => {
  const state: TableState = {
    profiles: new Map([
      ["inf-1", { influencer_id: "inf-1", crm_status: "incomplete" }],
    ]),
    events: [],
    influencers: new Set(["inf-1"]),
  };
  await ensureCommercialCreator(
    createMockSupabase(state),
    baseInput({
      reason: "campaign_assignment",
      sourceEntityType: "campaign_influencer",
      sourceEntityId: "ci-1",
    })
  );
  await ensureCommercialCreator(
    createMockSupabase(state),
    baseInput({
      reason: "vendor_io",
      sourceEntityType: "vendor_io",
      sourceEntityId: "vio-1",
    })
  );
  assert.equal(state.profiles.size, 1);
  assert.equal(state.events.length, 2);
});

test("ensureCommercialCreator denies manual convert without convert role", async () => {
  const state: TableState = {
    profiles: new Map(),
    events: [],
    influencers: new Set(["inf-1"]),
  };
  const result = await ensureCommercialCreator(
    createMockSupabase(state),
    baseInput({
      reason: "manual_convert",
      roleSlug: "finance",
      bypassRoleCheck: false,
    })
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "permission_denied");
  assert.equal(state.profiles.size, 0);
});

test("ensureCommercialCreator allows manual convert for account_manager", async () => {
  const state: TableState = {
    profiles: new Map(),
    events: [],
    influencers: new Set(["inf-1"]),
  };
  const result = await ensureCommercialCreator(
    createMockSupabase(state),
    baseInput({
      reason: "manual_convert",
      roleSlug: "account_manager",
      bypassRoleCheck: false,
    })
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.created, true);
});

test("ensureCommercialCreator fails when identity influencer is missing", async () => {
  const state: TableState = {
    profiles: new Map(),
    events: [],
    influencers: new Set(),
  };
  const result = await ensureCommercialCreator(createMockSupabase(state), baseInput());
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, "not_found");
});

test("ensureCommercialCreator never invents identity rows", async () => {
  const state: TableState = {
    profiles: new Map(),
    events: [],
    influencers: new Set(),
  };
  await ensureCommercialCreator(createMockSupabase(state), baseInput());
  assert.equal(state.influencers.size, 0);
  assert.equal(state.profiles.size, 0);
});
