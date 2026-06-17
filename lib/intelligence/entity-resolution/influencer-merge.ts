import {
  normalizeHandle,
  normalizeName,
} from "@/lib/intelligence/entity-resolution/normalize";
import {
  resolveInfluencer,
  type LiveMasters,
} from "@/lib/intelligence/entity-resolution/matchers";

export type InfluencerDimensionRow = Record<string, unknown>;

export function isEnrichedInfluencer(row: InfluencerDimensionRow): boolean {
  return !!(row.country || row.tier || row.username);
}

export type InfluencerEnrichmentLookup = {
  byName: Map<string, string>;
  byNamePlatform: Map<string, string>;
  byUsername: Map<string, string>;
};

export function buildInfluencerEnrichmentLookup(
  rows: InfluencerDimensionRow[]
): InfluencerEnrichmentLookup {
  const byName = new Map<string, string>();
  const byNamePlatform = new Map<string, string>();
  const byUsername = new Map<string, string>();

  for (const row of rows) {
    if (!isEnrichedInfluencer(row)) continue;
    const id = String(row.id);
    registerLookupKeys(byName, byNamePlatform, byUsername, id, row);
  }

  return { byName, byNamePlatform, byUsername };
}

function registerLookupKeys(
  byName: Map<string, string>,
  byNamePlatform: Map<string, string>,
  byUsername: Map<string, string>,
  id: string,
  row: InfluencerDimensionRow
) {
  const displayNorm = normalizeName(row.display_name_raw as string | null | undefined);
  const legacyNorm = normalizeName(row.legacy_name as string | null | undefined);
  const platformNorm = normalizeName(row.platform as string | null | undefined);
  const usernameNorm = normalizeHandle(row.username as string | null | undefined);

  for (const nameNorm of [displayNorm, legacyNorm]) {
    if (!nameNorm) continue;
    if (!byName.has(nameNorm)) byName.set(nameNorm, id);
    if (platformNorm) {
      const key = `${nameNorm}|${platformNorm}`;
      if (!byNamePlatform.has(key)) byNamePlatform.set(key, id);
    }
  }

  if (usernameNorm && !byUsername.has(usernameNorm)) {
    byUsername.set(usernameNorm, id);
  }
}

export function findEnrichedInfluencerId(
  display: string | null | undefined,
  platform: string | null | undefined,
  username: string | null | undefined,
  lookup: InfluencerEnrichmentLookup
): string | null {
  const usernameNorm = normalizeHandle(username);
  if (usernameNorm) {
    const byHandle = lookup.byUsername.get(usernameNorm);
    if (byHandle) return byHandle;
  }

  const displayNorm = normalizeName(display);
  const platformNorm = normalizeName(platform);
  if (displayNorm && platformNorm) {
    const byPlatform = lookup.byNamePlatform.get(`${displayNorm}|${platformNorm}`);
    if (byPlatform) return byPlatform;
  }
  if (displayNorm) {
    const byName = lookup.byName.get(displayNorm);
    if (byName) return byName;
  }

  return null;
}

function appendSourceKey(row: InfluencerDimensionRow, sourceKey: string) {
  const keys = new Set([...((row.source_keys as string[] | undefined) ?? []), sourceKey]);
  row.source_keys = [...keys];
}

export function mergeInfluencerDimensions(opts: {
  influencerMap: Map<string, string>;
  intInfluencers: InfluencerDimensionRow[];
  intCampaigns: InfluencerDimensionRow[];
  intPricingHistory: InfluencerDimensionRow[];
  masters: LiveMasters;
}): { merged: number; remapId: Map<string, string>; keptInfluencers: InfluencerDimensionRow[] } {
  const { influencerMap, intInfluencers, intCampaigns, intPricingHistory, masters } = opts;
  const enrichedRows = intInfluencers.filter(isEnrichedInfluencer);
  const lookup = buildInfluencerEnrichmentLookup(enrichedRows);
  const remapId = new Map<string, string>();

  const byNormalizedName = new Map<string, InfluencerDimensionRow[]>();
  for (const row of intInfluencers) {
    const key = normalizeName(row.display_name_raw as string);
    if (!key) continue;
    const group = byNormalizedName.get(key) ?? [];
    group.push(row);
    byNormalizedName.set(key, group);
  }

  for (const group of byNormalizedName.values()) {
    const enriched = group.filter(isEnrichedInfluencer);
    const sparse = group.filter((row) => !isEnrichedInfluencer(row));
    if (enriched.length === 0 || sparse.length === 0) continue;

    const keeper = enriched[0];
    const keeperId = String(keeper.id);

    for (const row of sparse) {
      const sparseId = String(row.id);
      if (sparseId === keeperId) continue;
      remapId.set(sparseId, keeperId);
      for (const sourceKey of (row.source_keys as string[] | undefined) ?? []) {
        influencerMap.set(sourceKey, keeperId);
        appendSourceKey(keeper, sourceKey);
      }
    }
  }

  for (const row of intInfluencers) {
    if (isEnrichedInfluencer(row)) continue;
    const matchId = findEnrichedInfluencerId(
      row.display_name_raw as string,
      row.platform as string | null,
      row.username as string | null,
      lookup
    );
    if (!matchId || matchId === row.id) continue;

    remapId.set(String(row.id), matchId);
    for (const sourceKey of (row.source_keys as string[] | undefined) ?? []) {
      influencerMap.set(sourceKey, matchId);
      const keeper = intInfluencers.find((candidate) => candidate.id === matchId);
      if (keeper) appendSourceKey(keeper, sourceKey);
    }
  }

  for (const campaign of intCampaigns) {
    const infId = campaign.int_influencer_id as string | null;
    if (infId && remapId.has(infId)) {
      campaign.int_influencer_id = remapId.get(infId)!;
    }
  }

  for (const pricing of intPricingHistory) {
    const infId = pricing.int_influencer_id as string | null;
    if (infId && remapId.has(infId)) {
      pricing.int_influencer_id = remapId.get(infId)!;
    }
  }

  const removedIds = new Set(remapId.keys());
  if (removedIds.size > 0) {
    const kept = intInfluencers.filter((row) => !removedIds.has(String(row.id)));
    intInfluencers.length = 0;
    intInfluencers.push(...kept);
  }

  for (const row of intInfluencers) {
    const resolved = resolveInfluencer(
      masters,
      row.display_name_raw as string | null,
      (row.username as string | null) ?? null
    );
    if (resolved.resolvedInfluencerId) {
      row.resolved_influencer_id = resolved.resolvedInfluencerId;
    }
    row.match_confidence = Math.max(Number(row.match_confidence ?? 0), resolved.confidence);
  }

  return { merged: remapId.size, remapId, keptInfluencers: intInfluencers };
}
