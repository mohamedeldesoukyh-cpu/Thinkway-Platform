import { listConversations } from "@/features/ai-workspace/services/conversation-service";
import { getCampaignsList } from "@/features/campaigns/queries";
import { requirePermission } from "@/lib/auth/permissions-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type StudioPickerConversation = {
  id: string;
  title: string;
  updatedAt: string;
  workspaceType: string;
  workspaceId?: string;
  isPinned: boolean;
};

export type StudioPickerCampaign = {
  id: string;
  name: string;
  documentNumber: string;
  brandName: string | null;
  clientName: string | null;
  status: string;
};

export type StudioPickerData = {
  conversations: StudioPickerConversation[];
  campaigns: StudioPickerCampaign[];
};

/** Recent studio conversations + campaigns for the Studio home picker. */
export async function listStudioPickerData(): Promise<StudioPickerData | { error: string }> {
  const supabase = await createSupabaseServerClient();
  const auth = await requirePermission(supabase, "ai.read");
  if ("error" in auth) return { error: auth.error };

  const [conversations, campaignList] = await Promise.all([
    listConversations(supabase, auth.userId, { limit: 30 }),
    getCampaignsList({ page: 1, search: "" }),
  ]);

  return {
    conversations: conversations.map((item) => ({
      id: item.id,
      title: item.title,
      updatedAt: item.updatedAt,
      workspaceType: item.workspaceType,
      workspaceId: item.workspaceId,
      isPinned: item.isPinned,
    })),
    campaigns: campaignList.campaigns.map((row) => ({
      id: row.id,
      name: row.name,
      documentNumber: row.document_number,
      brandName: row.brand?.name ?? null,
      clientName: row.client?.name ?? null,
      status: row.status,
    })),
  };
}
