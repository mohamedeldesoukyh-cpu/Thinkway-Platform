import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { maybeActivateCommercialCreatorForAssignment } from "./campaign-influencer-commercial";
import { syncCampaignInfluencerForLine } from "./campaign-influencer-sync";

const WRITERS_KEY = "CREATOR_CRM_WRITERS_ENABLED";
let writersSnapshot: string | undefined;

beforeEach(() => {
  writersSnapshot = process.env[WRITERS_KEY];
});

afterEach(() => {
  if (writersSnapshot === undefined) delete process.env[WRITERS_KEY];
  else process.env[WRITERS_KEY] = writersSnapshot;
});

type CrmState = {
  profiles: Map<string, { influencer_id: string; crm_status: string }>;
  events: Array<{
    id: string;
    influencer_id: string;
    reason: string;
    source_entity_id: string | null;
  }>;
};

function createCrmAwareSupabase(state: CrmState, ciId = "ci-1") {
  let eventSeq = 0;
  const from = (table: string) => {
    if (table === "campaign_influencers") {
      return {
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({ data: null, error: null }),
                is() {
                  return {
                    maybeSingle: async () => ({ data: null, error: null }),
                  };
                },
              };
            },
            or() {
              return {
                eq() {
                  return {
                    is() {
                      return {
                        maybeSingle: async () => ({ data: null, error: null }),
                      };
                    },
                  };
                },
              };
            },
          };
        },
        upsert() {
          return {
            select() {
              return {
                single: async () => ({ data: { id: ciId }, error: null }),
              };
            },
          };
        },
        update() {
          return {
            eq() {
              return {
                select() {
                  return {
                    single: async () => ({ data: { id: ciId }, error: null }),
                  };
                },
              };
            },
          };
        },
      };
    }
    if (table === "creator_crm_profiles") {
      return {
        select() {
          return {
            eq(_c: string, id: string) {
              return {
                maybeSingle: async () => ({
                  data: state.profiles.get(id) ?? null,
                  error: null,
                }),
              };
            },
          };
        },
        insert(row: { influencer_id: string; crm_status: string }) {
          if (state.profiles.has(row.influencer_id)) {
            return Promise.resolve({
              error: { code: "23505", message: "duplicate" },
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
        select() {
          return {
            eq() {
              return {
                maybeSingle: async () => ({ data: { id: "inf-1" }, error: null }),
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
          source_entity_id: string | null;
        }) {
          const dup = state.events.some(
            (e) =>
              e.influencer_id === row.influencer_id &&
              e.reason === row.reason &&
              e.source_entity_id === row.source_entity_id &&
              row.source_entity_id != null
          );
          if (dup) {
            return {
              select() {
                return {
                  maybeSingle: async () => ({
                    data: null,
                    error: { code: "23505", message: "duplicate" },
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

test("maybeActivate no-ops persistence when writers OFF", async () => {
  process.env[WRITERS_KEY] = "false";
  const state: CrmState = { profiles: new Map(), events: [] };
  await maybeActivateCommercialCreatorForAssignment(createCrmAwareSupabase(state), {
    influencerId: "inf-1",
    campaignInfluencerId: "ci-1",
    actorId: "actor-1",
  });
  assert.equal(state.profiles.size, 0);
  assert.equal(state.events.length, 0);
});

test("syncCampaignInfluencerForLine activates CRM once when writers ON", async () => {
  process.env[WRITERS_KEY] = "true";
  const state: CrmState = { profiles: new Map(), events: [] };
  const supabase = createCrmAwareSupabase(state, "ci-1");

  const first = await syncCampaignInfluencerForLine(supabase, {
    campaignId: "camp-1",
    lineId: "line-1",
    influencerId: "inf-1",
    payload: {
      status: "confirmed",
      currency: "AED",
      deliverable_count: 1,
      cost_before_vat: 0,
      cost_vat_percent: 0,
      cost_vat_amount: 0,
      cost_after_vat: 0,
      created_by: "actor-1",
    },
  });
  assert.equal(first.id, "ci-1");
  assert.equal(state.profiles.size, 1);
  assert.equal(state.events.length, 1);
  assert.equal(state.events[0]?.reason, "campaign_assignment");

  // Second sync same CI — profile reused; event deduped
  const second = await syncCampaignInfluencerForLine(supabase, {
    campaignId: "camp-1",
    lineId: "line-1",
    influencerId: "inf-1",
    payload: {
      status: "confirmed",
      currency: "AED",
      deliverable_count: 1,
      cost_before_vat: 0,
      cost_vat_percent: 0,
      cost_vat_amount: 0,
      cost_after_vat: 0,
      created_by: "actor-1",
    },
  });
  assert.equal(second.id, "ci-1");
  assert.equal(state.profiles.size, 1);
  assert.equal(state.events.length, 1);
});

test("second campaign influencer id yields second event, still one profile", async () => {
  process.env[WRITERS_KEY] = "true";
  const state: CrmState = { profiles: new Map(), events: [] };

  await maybeActivateCommercialCreatorForAssignment(
    createCrmAwareSupabase(state, "ci-a"),
    { influencerId: "inf-1", campaignInfluencerId: "ci-a", actorId: "a" }
  );
  await maybeActivateCommercialCreatorForAssignment(
    createCrmAwareSupabase(state, "ci-b"),
    { influencerId: "inf-1", campaignInfluencerId: "ci-b", actorId: "a" }
  );

  assert.equal(state.profiles.size, 1);
  assert.equal(state.events.length, 2);
});
