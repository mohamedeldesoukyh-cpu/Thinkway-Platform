import type { SupabaseClient } from "@supabase/supabase-js";

import { insertAuditLog } from "@/lib/audit/insert-audit-log";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

export async function logCampaignGroupAssignmentChange(
  supabase: Supabase,
  input: {
    campaignId: string;
    actorId: string;
    previousGroupId: string | null;
    newGroupId: string | null;
    previousGroupName?: string | null;
    newGroupName?: string | null;
  }
) {
  if (input.previousGroupId === input.newGroupId) return;

  const action =
    input.newGroupId == null
      ? "campaign.group_removed"
      : input.previousGroupId == null
        ? "campaign.group_assigned"
        : "campaign.group_changed";

  const summary =
    input.newGroupId == null
      ? "Campaign unlinked from holding group (independent)."
      : input.previousGroupId == null
        ? `Campaign assigned to holding group ${input.newGroupName ?? input.newGroupId}.`
        : `Campaign holding group changed to ${input.newGroupName ?? input.newGroupId}.`;

  await insertAuditLog(supabase, {
    action,
    entity_type: "campaign_header",
    entity_id: input.campaignId,
    actor_id: input.actorId,
    old_data: { group_id: input.previousGroupId },
    new_data: { group_id: input.newGroupId },
    metadata: {
      summary,
      previous_group_id: input.previousGroupId,
      new_group_id: input.newGroupId,
      previous_group_name: input.previousGroupName ?? null,
      new_group_name: input.newGroupName ?? null,
    },
  });
}
