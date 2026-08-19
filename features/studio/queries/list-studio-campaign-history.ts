import { deserializeCampaignObject } from "@/features/campaign-intelligence";
import type { CampaignObjectSnapshot } from "@/features/campaign-intelligence";
import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  projectStudioCampaignHistoryItem,
  type StudioCampaignHistoryItem,
} from "../services/studio-campaign-history";

const HISTORY_LIMIT = 50;

export async function listStudioCampaignHistory(): Promise<
  StudioCampaignHistoryItem[] | { error: string }
> {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "ai.read");
  if ("error" in auth) return { error: auth.error };

  const { data: heads, error: headsError } = await supabase
    .from("campaign_objects")
    .select("id, conversation_id, lifecycle_status, current_version, updated_at")
    .eq("created_by", auth.userId)
    .gt("current_version", 0)
    .order("updated_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  if (headsError) return { error: headsError.message };
  if (!heads?.length) return [];

  const objectIds = heads.map((row) => row.id);
  const conversationIds = [...new Set(heads.map((row) => row.conversation_id))];

  const { data: versions, error: versionsError } = await supabase
    .from("campaign_object_versions")
    .select("campaign_object_id, version, snapshot")
    .in("campaign_object_id", objectIds);

  if (versionsError) return { error: versionsError.message };

  const { data: conversationRows } = await supabase
    .from("ai_conversations")
    .select("id, title")
    .eq("created_by", auth.userId)
    .in("id", conversationIds);

  const conversations = (conversationRows ?? []) as Array<{ id: string; title: string | null }>;

  const titleByConversation = new Map(
    conversations.map((row) => [row.id, row.title])
  );
  const snapshotByObjectVersion = new Map(
    (versions ?? []).map((row) => [
      `${row.campaign_object_id}:${row.version}`,
      row.snapshot,
    ])
  );

  const items: StudioCampaignHistoryItem[] = [];
  for (const head of heads) {
    const snapshot = snapshotByObjectVersion.get(`${head.id}:${head.current_version}`);
    if (!snapshot || typeof snapshot !== "object") continue;
    try {
      const campaignObject = deserializeCampaignObject(
        snapshot as unknown as CampaignObjectSnapshot
      );
      items.push(
        projectStudioCampaignHistoryItem({
          conversationId: head.conversation_id,
          campaignObjectId: head.id,
          lifecycleStatus: head.lifecycle_status,
          updatedAt: head.updated_at,
          conversationTitle: titleByConversation.get(head.conversation_id) ?? null,
          campaignObject,
        })
      );
    } catch {
      /* skip malformed snapshots */
    }
  }

  return items;
}