import type { SupabaseClient } from "@supabase/supabase-js";

export type EnsureDiscoveryCreatorBrowsableResult = {
  activated: boolean;
  touchedRecency: boolean;
};

type InfluencerBrowseRow = {
  status: string;
};

/**
 * Build the influencer patch needed for Discovery default browse visibility.
 * Browse SQL (`search_creators` empty query) only returns `status = active` rows
 * ordered by `coalesce(last_enriched_at, updated_at)`. Prospect creators added via
 * shortlist/quotation therefore need activation + a recency bump.
 */
export function buildDiscoveryBrowseVisibilityPatch(
  row: InfluencerBrowseRow,
  options?: { touchRecency?: boolean; nowIso?: string }
): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {};
  if (row.status === "prospect") {
    patch.status = "active";
  }
  if (options?.touchRecency !== false) {
    patch.updated_at = options?.nowIso ?? new Date().toISOString();
  }
  return Object.keys(patch).length > 0 ? patch : null;
}

/** Activate prospect influencers and bump recency so they appear in default browse. */
export async function ensureDiscoveryCreatorBrowsable(
  supabase: SupabaseClient,
  influencerId: string | null | undefined,
  options?: { touchRecency?: boolean }
): Promise<EnsureDiscoveryCreatorBrowsableResult> {
  if (!influencerId?.trim()) {
    return { activated: false, touchedRecency: false };
  }

  const { data: row, error } = await supabase
    .from("influencers")
    .select("id, status")
    .eq("id", influencerId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row) return { activated: false, touchedRecency: false };

  const patch = buildDiscoveryBrowseVisibilityPatch(
    row as InfluencerBrowseRow,
    options
  );
  if (!patch) return { activated: false, touchedRecency: false };

  const { error: updateError } = await supabase
    .from("influencers")
    .update(patch as never)
    .eq("id", influencerId);

  if (updateError) throw new Error(updateError.message);

  return {
    activated: row.status === "prospect",
    touchedRecency: options?.touchRecency !== false,
  };
}

/** Best-effort browse visibility for batch shortlist/quotation writes. */
export async function ensureDiscoveryCreatorsBrowsable(
  supabase: SupabaseClient,
  influencerIds: Array<string | null | undefined>,
  options?: { touchRecency?: boolean }
): Promise<void> {
  const unique = [...new Set(influencerIds.filter((id): id is string => Boolean(id?.trim())))];
  await Promise.all(
    unique.map((influencerId) =>
      ensureDiscoveryCreatorBrowsable(supabase, influencerId, options).catch(() => undefined)
    )
  );
}

type QuotationOrShortlistSeed = {
  influencer_id?: string | null;
  profile_id?: string | null;
};

/** Resolve influencer ids from seeds and ensure browse visibility (profile link + recency bump). */
export async function ensureDiscoverySeedsBrowsable(
  supabase: SupabaseClient,
  seeds: QuotationOrShortlistSeed[]
): Promise<void> {
  const influencerIds = new Set<string>();
  const profileIds = new Set<string>();

  for (const seed of seeds) {
    if (seed.influencer_id?.trim()) influencerIds.add(seed.influencer_id.trim());
    if (seed.profile_id?.trim()) profileIds.add(seed.profile_id.trim());
  }

  if (profileIds.size > 0) {
    const { data, error } = await supabase
      .from("discovered_profiles")
      .select("id, influencer_id")
      .in("id", [...profileIds]);
    if (error) throw new Error(error.message);

    for (const row of data ?? []) {
      const linkedId = row.influencer_id as string | null;
      if (linkedId) influencerIds.add(linkedId);
    }

    await Promise.all(
      [...profileIds].map((profileId) =>
        ensureDiscoveredProfileBrowsable(supabase, profileId).catch(() => undefined)
      )
    );
  }

  await ensureDiscoveryCreatorsBrowsable(supabase, [...influencerIds]);
}

/** Bump discovered-profile recency for default browse (unlinked public_discovery rows). */
export async function ensureDiscoveredProfileBrowsable(
  supabase: SupabaseClient,
  profileId: string | null | undefined,
  options?: { touchRecency?: boolean; nowIso?: string }
): Promise<{ touchedRecency: boolean; linkedInfluencerId: string | null }> {
  if (!profileId?.trim()) {
    return { touchedRecency: false, linkedInfluencerId: null };
  }

  const { data: row, error } = await supabase
    .from("discovered_profiles")
    .select("id, influencer_id")
    .eq("id", profileId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row) return { touchedRecency: false, linkedInfluencerId: null };

  const linkedInfluencerId = (row.influencer_id as string | null) ?? null;
  if (linkedInfluencerId) {
    await ensureDiscoveryCreatorBrowsable(supabase, linkedInfluencerId, options);
  }

  if (options?.touchRecency === false) {
    return { touchedRecency: false, linkedInfluencerId };
  }

  const nowIso = options?.nowIso ?? new Date().toISOString();
  const { error: updateError } = await supabase
    .from("discovered_profiles")
    .update({ updated_at: nowIso } as never)
    .eq("id", profileId);

  if (updateError) throw new Error(updateError.message);

  return { touchedRecency: true, linkedInfluencerId };
}
