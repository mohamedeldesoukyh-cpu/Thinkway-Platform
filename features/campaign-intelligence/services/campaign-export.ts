import type { SupabaseClient } from "@supabase/supabase-js";

import { enrichCampaignObjectWithStudioData } from "./studio-section-data-builders";
import { CampaignObjectPersistenceService } from "./campaign-object-persistence";
import {
  getCampaignObjectFromSnapshot,
  reviveCampaignObjectForExport,
  serializeCampaignObject,
} from "./campaign-object-store";
import type { CampaignObject, CampaignObjectSnapshot } from "../types/campaign-object";

/** Score how much structured campaign data a snapshot carries — pick the richest source. */
function snapshotRichness(snapshot: CampaignObjectSnapshot): number {
  let score = 0;
  if (snapshot.meta?.campaignFacts) score += 20;

  for (const section of Object.values(snapshot.sections ?? {})) {
    const data = section.data;
    if (data && Object.keys(data).length > 0) score += 3;
    const content = section.content;
    if (typeof content === "string" && content.trim().length > 24) score += 2;
    else if (content && typeof content === "object") score += 2;
    if (section.status === "complete") score += 1;
  }

  return score;
}

function pickRichestSnapshot(
  candidates: Array<CampaignObjectSnapshot | null | undefined>
): CampaignObjectSnapshot | null {
  let best: CampaignObjectSnapshot | null = null;
  let bestScore = -1;

  for (const candidate of candidates) {
    if (!candidate) continue;
    const score = snapshotRichness(candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

async function loadSnapshotFromConversationMessages(
  supabase: SupabaseClient,
  conversationId: string,
  campaignObjectId?: string
): Promise<CampaignObjectSnapshot | null> {
  const { data, error } = await supabase
    .from("ai_messages")
    .select("metadata")
    .eq("conversation_id", conversationId)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(24);

  if (error) throw new Error(error.message);

  for (const row of data ?? []) {
    const metadata = row.metadata as Record<string, unknown> | null;
    const raw = metadata?.campaignObject;
    if (!raw || typeof raw !== "object") continue;
    const snapshot = raw as CampaignObjectSnapshot;
    if (campaignObjectId && snapshot.id !== campaignObjectId) continue;
    return snapshot;
  }

  return null;
}

async function loadSnapshotFromConversationContext(
  supabase: SupabaseClient,
  conversationId: string,
  contextSnapshot?: Record<string, unknown>
): Promise<CampaignObjectSnapshot | null> {
  let snapshotRecord = contextSnapshot;
  if (!snapshotRecord) {
    const { data, error } = await supabase
      .from("ai_conversations")
      .select("context_snapshot")
      .eq("id", conversationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    snapshotRecord = (data?.context_snapshot as Record<string, unknown> | null) ?? undefined;
  }

  const fromSnapshot = getCampaignObjectFromSnapshot(snapshotRecord);
  return fromSnapshot ? serializeCampaignObject(fromSnapshot) : null;
}

/**
 * Returns the approved CampaignObject snapshot for export when available.
 * Falls back to the latest persisted version, then conversation message metadata
 * and contextSnapshot — Studio renders from message metadata, so export must too.
 */
export async function getApprovedSnapshot(
  supabase: SupabaseClient,
  input: {
    campaignObjectId?: string;
    conversationId?: string;
    contextSnapshot?: Record<string, unknown>;
  }
): Promise<CampaignObjectSnapshot | null> {
  const candidates: Array<CampaignObjectSnapshot | null> = [];

  if (input.campaignObjectId) {
    const approved = await CampaignObjectPersistenceService.getApprovedSnapshot(
      supabase,
      input.campaignObjectId
    );
    if (approved) candidates.push(approved);

    const { data: head } = await supabase
      .from("campaign_objects")
      .select("current_version")
      .eq("id", input.campaignObjectId)
      .maybeSingle();

    if (head && head.current_version > 0) {
      const latest = await CampaignObjectPersistenceService.loadVersion(
        supabase,
        input.campaignObjectId,
        head.current_version
      );
      if (latest) candidates.push(latest.snapshot);
    }
  }

  if (input.conversationId) {
    try {
      const latest = await CampaignObjectPersistenceService.loadLatestByConversation(
        supabase,
        input.conversationId
      );
      if (latest) {
        candidates.push(serializeCampaignObject(latest.campaignObject));
      }
    } catch {
      // RLS or missing table — fall through to message/context sources.
    }

    try {
      const fromMessages = await loadSnapshotFromConversationMessages(
        supabase,
        input.conversationId,
        input.campaignObjectId
      );
      if (fromMessages) candidates.push(fromMessages);
    } catch {
      // Non-fatal — other sources may still succeed.
    }

    try {
      const fromContext = await loadSnapshotFromConversationContext(
        supabase,
        input.conversationId,
        input.contextSnapshot
      );
      if (fromContext) candidates.push(fromContext);
    } catch {
      // Non-fatal — other sources may still succeed.
    }
  }

  const richest = pickRichestSnapshot(candidates);
  if (richest) return richest;

  const fromSnapshot = getCampaignObjectFromSnapshot(input.contextSnapshot);
  return fromSnapshot ? serializeCampaignObject(fromSnapshot) : null;
}

/** Revive stringified section payloads and run the same Studio enrichment resolvers. */
export function prepareCampaignObjectForExport(
  snapshot: CampaignObjectSnapshot
): CampaignObject {
  const revived = reviveCampaignObjectForExport(snapshot);
  return enrichCampaignObjectWithStudioData(revived);
}
