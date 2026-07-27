import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { ensureCommercialCreatorFromQuoteToCampaign } from "./activation-helpers";

const WRITERS_KEY = "CREATOR_CRM_WRITERS_ENABLED";
let writersSnapshot: string | undefined;

beforeEach(() => {
  writersSnapshot = process.env[WRITERS_KEY];
  process.env[WRITERS_KEY] = "true";
});

afterEach(() => {
  if (writersSnapshot === undefined) delete process.env[WRITERS_KEY];
  else process.env[WRITERS_KEY] = writersSnapshot;
});

type EventRow = {
  id: string;
  reason: string;
  source_entity_type: string | null;
  source_entity_id: string | null;
};

function createDualEventMock() {
  const profiles = new Map<string, { influencer_id: string; crm_status: string }>();
  const events: EventRow[] = [];
  let eventSeq = 0;

  const from = (table: string) => {
    if (table === "creator_crm_profiles") {
      return {
        select() {
          return {
            eq(_c: string, id: string) {
              return {
                maybeSingle: async () => ({
                  data: profiles.get(id) ?? null,
                  error: null,
                }),
              };
            },
          };
        },
        insert(row: {
          influencer_id: string;
          crm_status: string;
        }) {
          profiles.set(row.influencer_id, {
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
          source_entity_type: string | null;
          source_entity_id: string | null;
        }) {
          const id = `evt-${++eventSeq}`;
          events.push({
            id,
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

  return { supabase: { from } as never, profiles, events };
}

test("dual-event quote→campaign records quotation_operational and campaign_assignment", async () => {
  const mock = createDualEventMock();
  const result = await ensureCommercialCreatorFromQuoteToCampaign(mock.supabase, {
    influencerId: "inf-1",
    quotationId: "quote-1",
    campaignInfluencerId: "ci-1",
    actorId: "actor-1",
  });

  assert.equal(result.profile.ok, true);
  assert.equal(mock.profiles.size, 1);
  assert.equal(mock.events.length, 2);
  assert.deepEqual(
    mock.events.map((e) => e.reason).sort(),
    ["campaign_assignment", "quotation_operational"]
  );
  assert.ok(result.quotationEventId);
  assert.ok(result.assignmentEventId);
});

test("dual-event respects writers gate OFF (no persistence)", async () => {
  process.env[WRITERS_KEY] = "false";
  const mock = createDualEventMock();
  const result = await ensureCommercialCreatorFromQuoteToCampaign(mock.supabase, {
    influencerId: "inf-1",
    quotationId: "quote-1",
    campaignInfluencerId: "ci-1",
    actorId: "actor-1",
  });
  assert.equal(result.profile.ok, true);
  if (!result.profile.ok) return;
  assert.equal(result.profile.writersDisabled, true);
  assert.equal(mock.profiles.size, 0);
  assert.equal(mock.events.length, 0);
});
