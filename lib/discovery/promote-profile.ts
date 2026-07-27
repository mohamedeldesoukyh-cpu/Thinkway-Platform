import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeContactEmail } from "@/lib/creators/contact-info";
import {
  countryWritePayload,
  persistCountryFromDiscoveredProfile,
} from "@/lib/creators/country-persistence";
import { ensureDiscoveryCreatorBrowsable } from "@/lib/creators/discovery-browse-eligibility";
import { requireCreatorBaselineDna } from "@/features/creator-dna/services/baseline-dna-populator";
import { CreatorDNAService } from "@/features/creator-dna/services/creator-dna-service";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;

export type PromoteResult =
  | { ok: true; influencerId: string; created: boolean }
  | { ok: false; message: string };

/**
 * Identity promote (L1): discovered profile → influencer + platform account.
 * Merges creator_dna_staging → creator_dna. Never activates Commercial Creator CRM.
 */
export async function promoteDiscoveredProfileToInfluencer(
  supabase: Supabase,
  profileId: string,
  actorId: string
): Promise<PromoteResult> {
  const { data: profile, error: profileError } = await supabase
    .from("discovered_profiles")
    .select(
      "id, platform, username, profile_url, display_name, country_code, city, bio, category_tags, profile_image_url, influencer_id, email_in_bio"
    )
    .eq("id", profileId)
    .maybeSingle();

  if (profileError) return { ok: false, message: profileError.message };
  if (!profile) return { ok: false, message: "Discovered profile not found." };

  if (profile.influencer_id) {
    const stagingPromote = await new CreatorDNAService(supabase).promoteStaging(
      profileId,
      profile.influencer_id
    );
    if (!stagingPromote.ok) {
      return { ok: false, message: stagingPromote.message };
    }
    try {
      await requireCreatorBaselineDna(supabase, profile.influencer_id);
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Creator DNA baseline failed for linked influencer.",
      };
    }
    await ensureDiscoveryCreatorBrowsable(supabase, profile.influencer_id);
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

  const countryFields = persistCountryFromDiscoveredProfile({
    country_code: profile.country_code,
    bio: profile.bio,
    displayName,
    city: profile.city,
  });

  const { data: influencer, error: influencerError } = await supabase
    .from("influencers")
    .insert({
      display_name: displayName,
      ...countryWritePayload(countryFields),
      categories: profile.category_tags ?? [],
      status: "active",
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
  const contactEmail = normalizeContactEmail(
    (profile as { email_in_bio?: string | null }).email_in_bio
  );

  const { error: accountError } = await supabase
    .from("influencer_platform_accounts")
    .insert({
      influencer_id: influencerId,
      platform: profile.platform,
      handle: profile.username,
      profile_url: profile.profile_url,
      follower_count: metrics?.followers ?? 0,
      engagement_rate: metrics?.engagement_rate ?? null,
      contact_email: contactEmail,
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

  const stagingPromote = await new CreatorDNAService(supabase).promoteStaging(
    profileId,
    influencerId
  );
  if (!stagingPromote.ok) {
    return { ok: false, message: stagingPromote.message };
  }

  await ensureDiscoveryCreatorBrowsable(supabase, influencerId);

  try {
    await requireCreatorBaselineDna(supabase, influencerId);
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Creator DNA baseline failed — promotion requires DNA.",
    };
  }

  return { ok: true, influencerId, created: true };
}
