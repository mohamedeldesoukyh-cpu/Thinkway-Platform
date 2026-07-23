import type { SupabaseClient } from "@supabase/supabase-js";

import { persistCreatorPrimaryIdentity } from "@/lib/creators/persist-primary-avatar";
import { getUnifiedCreatorById } from "@/lib/creators/unified-browse";
import type { UnifiedCreatorResult } from "@/lib/creators/types";
import { platformLabel } from "@/lib/campaigns/line-assignment";
import type { Database } from "@/types/database";

export type DeletePlatformFromCreatorResult =
  | { ok: true; creator: UnifiedCreatorResult; message: string }
  | { ok: false; message: string };

export async function deletePlatformFromCreator(
  supabase: SupabaseClient<Database>,
  input: {
    influencerId: string;
    platformAccountId: string;
    unifiedId: string;
  }
): Promise<DeletePlatformFromCreatorResult> {
  const influencerId = input.influencerId.trim();
  const platformAccountId = input.platformAccountId.trim();
  const unifiedId = input.unifiedId.trim();

  if (!influencerId || !platformAccountId || !unifiedId) {
    return { ok: false, message: "Creator and platform are required." };
  }

  const { data: accounts, error: accountsError } = await supabase
    .from("influencer_platform_accounts")
    .select("id, platform")
    .eq("influencer_id", influencerId);

  if (accountsError) {
    return { ok: false, message: accountsError.message };
  }

  const rows = accounts ?? [];
  if (rows.length < 2) {
    return {
      ok: false,
      message: "At least two linked platforms are required before removing one.",
    };
  }

  const target = rows.find((row) => row.id === platformAccountId);
  if (!target) {
    return { ok: false, message: "Platform account not found on this creator." };
  }

  const { error: deleteError } = await supabase
    .from("influencer_platform_accounts")
    .delete()
    .eq("id", platformAccountId)
    .eq("influencer_id", influencerId);

  if (deleteError) {
    return { ok: false, message: deleteError.message };
  }

  await persistCreatorPrimaryIdentity(supabase, influencerId);

  const creator = await getUnifiedCreatorById(supabase, unifiedId);
  if (!creator) {
    return {
      ok: false,
      message: `${platformLabel(target.platform)} removed, but the creator profile could not be reloaded.`,
    };
  }

  return {
    ok: true,
    creator,
    message: `${platformLabel(target.platform)} removed from ${creator.display_name}.`,
  };
}
