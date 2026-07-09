import type { SupabaseClient } from "@supabase/supabase-js";

import { CampaignObjectPersistenceService } from "./campaign-object-persistence";
import {
  getCampaignObjectFromSnapshot,
  serializeCampaignObject,
} from "./campaign-object-store";
import type { CampaignObjectSnapshot } from "../types/campaign-object";

/**
 * Returns the approved CampaignObject snapshot for export when available.
 * Falls back to the latest persisted version, then conversation contextSnapshot.
 */
export async function getApprovedSnapshot(
  supabase: SupabaseClient,
  input: {
    campaignObjectId?: string;
    conversationId?: string;
    contextSnapshot?: Record<string, unknown>;
  }
): Promise<CampaignObjectSnapshot | null> {
  if (input.campaignObjectId) {
    const approved = await CampaignObjectPersistenceService.getApprovedSnapshot(
      supabase,
      input.campaignObjectId
    );
    if (approved) return approved;

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
      if (latest) return latest.snapshot;
    }
  }

  if (input.conversationId) {
    const latest = await CampaignObjectPersistenceService.loadLatestByConversation(
      supabase,
      input.conversationId
    );
    if (latest) {
      if (
        latest.record.lifecycleStatus === "approved" ||
        latest.record.lifecycleStatus === "published"
      ) {
        return serializeCampaignObject(latest.campaignObject);
      }
      return serializeCampaignObject(latest.campaignObject);
    }
  }

  const fromSnapshot = getCampaignObjectFromSnapshot(input.contextSnapshot);
  return fromSnapshot ? serializeCampaignObject(fromSnapshot) : null;
}
