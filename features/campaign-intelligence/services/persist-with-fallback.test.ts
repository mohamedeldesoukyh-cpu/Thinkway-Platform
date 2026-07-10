import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

import {
  CampaignDirector,
  persistCampaignObjectWithFallback,
} from "@/features/campaign-intelligence/services/campaign-director";
import { clearCampaignObjectMemory } from "@/features/campaign-intelligence/services/campaign-object-store";

/**
 * Regression: a campaign_objects DB failure at workflow_complete must NOT throw
 * away the finished workflow output. persistCampaignObjectWithFallback falls back
 * to memory-only persistence and reports the DB error instead of propagating it
 * (the propagated error previously aborted the chat stream before the assistant
 * message was appended — Studio cards vanished, only the brief remained).
 */

/** Supabase stub whose campaign_objects reads always fail (broken RLS / missing row). */
function failingSupabaseStub(message: string): SupabaseClient<Database> {
  const failure = { data: null, error: { message } };
  const chain = {
    select: () => chain,
    insert: () => chain,
    eq: () => chain,
    maybeSingle: async () => failure,
    single: async () => failure,
  };
  return { from: () => chain } as unknown as SupabaseClient<Database>;
}

function newDirector(conversationId: string): CampaignDirector {
  clearCampaignObjectMemory(conversationId);
  return CampaignDirector.initialize({
    conversationId,
    workflowId: "create-campaign",
  });
}

test("falls back to memory persistence when the DB write fails at workflow_complete", async () => {
  const conversationId = "conv-fallback-1";
  const director = newDirector(conversationId);

  const result = await persistCampaignObjectWithFallback(director, conversationId, {
    persistToDb: true,
    supabase: failingSupabaseStub("permission denied for table campaign_objects"),
    userId: "user-1",
    saveReason: "workflow_complete",
  });

  // Never throws; the finished object survives with the DB error reported.
  assert.ok(result.campaignObject);
  assert.equal(result.campaignObject.conversationId, conversationId);
  assert.match(result.dbPersistError ?? "", /permission denied/);
  clearCampaignObjectMemory(conversationId);
});

test("reports no error and returns the object when the DB write is skipped (memory-only)", async () => {
  const conversationId = "conv-fallback-2";
  const director = newDirector(conversationId);

  const result = await persistCampaignObjectWithFallback(director, conversationId, {
    persistToDb: false,
    saveReason: "workflow_complete",
  });

  assert.ok(result.campaignObject);
  assert.equal(result.dbPersistError, undefined);
  clearCampaignObjectMemory(conversationId);
});
