import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

export type PromoteResult =
  | { ok: true; influencerId: string; created: boolean }
  | { ok: false; message: string };

/**
 * Promote a discovered profile into a real influencer so it can be assigned to a
 * campaign. Idempotent: if the profile is already linked to an influencer, returns
 * the existing id. Creates a minimal influencer + platform account otherwise and
 * back-links `discovered_profiles.influencer_id`.
 */
export async function promoteDiscoveredProfileToInfluencer(
  supabase: Supabase,
  profileId: string,
  actorId: string
): Promise<PromoteResult> {
  const { data: profile, error: profileError } = await supabase
    .from("discovered_profiles")
    .select(
      "id, platform, username, profile_url, display_name, country_code, category_tags, profile_image_url, influencer_id"
    )
    .eq("id", profileId)
    .maybeSingle();

  if (profileError) return { ok: false, message: profileError.message };
  if (!profile) return { ok: false, message: "Discovered profile not found." };

  if (profile.influencer_id) {
    return { ok: true, influencerId: profile.influencer_id, created: false };
  }

  const { data: metrics } = await supabase
    .from("profile_metrics")
    .select("followers, engagement_rate")
    .eq("profile_id", profileId)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const displayName =
    profile.display_name?.trim() || profile.username || "Discovered creator";

  const { data: influencer, error: influencerError } = await supabase
    .from("influencers")
    .insert({
      display_name: displayName,
      country_code: profile.country_code ?? null,
      categories: profile.category_tags ?? [],
      status: "prospect",
      notes: "Promoted from Discovery shortlist",
      created_by: actorId,
    } as never)
    .select("id")
    .single();

  if (influencerError || !influencer) {
    return {
      ok: false,
      message: influencerError?.message ?? "Failed to create influencer.",
    };
  }

  const influencerId = (influencer as { id: string }).id;

  const profileImageUrl = profile.profile_image_url?.trim() || null;

  const { error: accountError } = await supabase
    .from("influencer_platform_accounts")
    .insert({
      influencer_id: influencerId,
      platform: profile.platform,
      handle: profile.username,
      profile_url: profile.profile_url,
      follower_count: metrics?.followers ?? 0,
      engagement_rate: metrics?.engagement_rate ?? null,
      is_primary: true,
      ...(profileImageUrl
        ? {
            profile_picture_url: profileImageUrl,
            avatar_source: "discovery",
            avatar_last_synced_at: new Date().toISOString(),
          }
        : {}),
    } as never);

  if (accountError) {
    console.error(
      "[promote-creator] platform account insert failed",
      accountError.message
    );
  }

  await supabase
    .from("discovered_profiles")
    .update({ influencer_id: influencerId })
    .eq("id", profileId);

  return { ok: true, influencerId, created: true };
}
