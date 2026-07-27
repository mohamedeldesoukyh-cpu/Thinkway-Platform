/**
 * Single Commercial Creator activation entry for campaign_influencers success.
 * All assignment paths must call this — do not reimplement ensure logic inline.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { ensureCommercialCreatorFromAssignment } from "@/lib/creators/crm/activation-helpers";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

/**
 * Best-effort CRM activation after a campaign_influencers row is created/updated.
 * Never throws into the assignment path; logs and returns.
 */
export async function maybeActivateCommercialCreatorForAssignment(
  supabase: Supabase,
  input: {
    influencerId: string;
    campaignInfluencerId: string;
    actorId?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  if (!input.influencerId || !input.campaignInfluencerId) return;

  try {
    const result = await ensureCommercialCreatorFromAssignment(supabase, {
      influencerId: input.influencerId,
      campaignInfluencerId: input.campaignInfluencerId,
      actorId: input.actorId ?? null,
      bypassRoleCheck: true,
      metadata: input.metadata,
    });
    if (!result.ok) {
      console.warn(
        "[creator-crm] assignment activation failed",
        result.code,
        result.message,
        input.campaignInfluencerId
      );
    }
  } catch (error) {
    console.warn(
      "[creator-crm] assignment activation threw",
      error instanceof Error ? error.message : error,
      input.campaignInfluencerId
    );
  }
}
