import type { SupabaseClient } from "@supabase/supabase-js";

import type { CampaignObject } from "@/features/campaign-intelligence";
import { CampaignObjectPersistenceService } from "@/features/campaign-intelligence/services/campaign-object-persistence";
import {
  displayLabelForMediaPlanIdentity,
  mediaPlanIdentityFromMeta,
  type MediaPlanIdentityMeta,
} from "@/features/campaign-outputs/media-plan-identity";
import { getMediaPlanLifecycle } from "@/features/campaign-outputs/media-plan-mutations";
import type { MediaPlanStatus } from "@/lib/media-plan";
import type { Database } from "@/types/database";

export type CampaignMediaPlanListItem = {
  campaignObjectId: string;
  conversationId: string | null;
  isDefault: boolean;
  label: string;
  identity: MediaPlanIdentityMeta;
  status: MediaPlanStatus;
  currentVersion: number;
  updatedAt: string | null;
};

async function loadTipObject(
  supabase: SupabaseClient<Database>,
  campaignObjectId: string,
  conversationId: string | null,
  currentVersion: number
): Promise<CampaignObject | null> {
  if (currentVersion > 0) {
    const version = await CampaignObjectPersistenceService.loadVersion(
      supabase,
      campaignObjectId,
      currentVersion
    );
    if (version?.campaignObject) return version.campaignObject;
  }
  if (conversationId) {
    return CampaignObjectPersistenceService.restoreForConversation(supabase, conversationId);
  }
  return null;
}

/**
 * List all Media Plan campaign_objects for a Campaign header.
 * Default plan is `campaign_headers.campaign_object_id` when present.
 */
export async function listCampaignMediaPlans(
  supabase: SupabaseClient<Database>,
  campaignHeaderId: string,
  defaultCampaignObjectId: string | null
): Promise<CampaignMediaPlanListItem[]> {
  const { data, error } = await supabase
    .from("campaign_objects")
    .select("id, conversation_id, current_version, updated_at")
    .eq("campaign_header_id", campaignHeaderId)
    .order("updated_at", { ascending: false });

  if (error || !data?.length) {
    // Fallback: default pointer may still exist without header_id backfilled.
    if (!defaultCampaignObjectId) return [];
    const { data: head } = await supabase
      .from("campaign_objects")
      .select("id, conversation_id, current_version, updated_at")
      .eq("id", defaultCampaignObjectId)
      .maybeSingle();
    if (!head) return [];
    const tip = await loadTipObject(
      supabase,
      head.id as string,
      (head.conversation_id as string | null) ?? null,
      Number(head.current_version ?? 0)
    );
    const identity = mediaPlanIdentityFromMeta(tip?.meta);
    return [
      {
        campaignObjectId: head.id as string,
        conversationId: (head.conversation_id as string | null) ?? null,
        isDefault: true,
        label: displayLabelForMediaPlanIdentity(identity, "Default Media Plan"),
        identity,
        status: tip ? getMediaPlanLifecycle(tip).status : "draft",
        currentVersion: Number(head.current_version ?? 0),
        updatedAt: (head.updated_at as string | null) ?? null,
      },
    ];
  }

  const items: CampaignMediaPlanListItem[] = [];
  for (const row of data) {
    const id = row.id as string;
    const tip = await loadTipObject(
      supabase,
      id,
      (row.conversation_id as string | null) ?? null,
      Number(row.current_version ?? 0)
    );
    const identity = mediaPlanIdentityFromMeta(tip?.meta);
    const isDefault = Boolean(defaultCampaignObjectId && id === defaultCampaignObjectId);
    items.push({
      campaignObjectId: id,
      conversationId: (row.conversation_id as string | null) ?? null,
      isDefault,
      label: displayLabelForMediaPlanIdentity(
        identity,
        isDefault ? "Default Media Plan" : "Media Plan"
      ),
      identity,
      status: tip ? getMediaPlanLifecycle(tip).status : "draft",
      currentVersion: Number(row.current_version ?? 0),
      updatedAt: (row.updated_at as string | null) ?? null,
    });
  }

  // Ensure default pointer appears even if header_id not set on that row.
  if (
    defaultCampaignObjectId &&
    !items.some((item) => item.campaignObjectId === defaultCampaignObjectId)
  ) {
    const { data: head } = await supabase
      .from("campaign_objects")
      .select("id, conversation_id, current_version, updated_at")
      .eq("id", defaultCampaignObjectId)
      .maybeSingle();
    if (head) {
      const tip = await loadTipObject(
        supabase,
        head.id as string,
        (head.conversation_id as string | null) ?? null,
        Number(head.current_version ?? 0)
      );
      const identity = mediaPlanIdentityFromMeta(tip?.meta);
      items.unshift({
        campaignObjectId: head.id as string,
        conversationId: (head.conversation_id as string | null) ?? null,
        isDefault: true,
        label: displayLabelForMediaPlanIdentity(identity, "Default Media Plan"),
        identity,
        status: tip ? getMediaPlanLifecycle(tip).status : "draft",
        currentVersion: Number(head.current_version ?? 0),
        updatedAt: (head.updated_at as string | null) ?? null,
      });
    }
  }

  items.sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
  });

  return items;
}
