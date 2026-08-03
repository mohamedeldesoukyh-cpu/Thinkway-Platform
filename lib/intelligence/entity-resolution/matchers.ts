import type { SupabaseClient } from "@supabase/supabase-js";

import { isMissingIntelligenceTableError } from "@/lib/intelligence/client";
import { bestFuzzyMatch } from "@/lib/intelligence/entity-resolution/fuzzy";
import {
  normalizeCampaignDocumentNumber,
  normalizeHandle,
  normalizeName,
} from "@/lib/intelligence/entity-resolution/normalize";
import type { HarmonizedCampaignRow } from "@/types/intelligence";

export type LiveMasters = {
  groups: Array<{ id: string; name: string }>;
  clients: Array<{ id: string; name: string; group_id: string | null }>;
  brands: Array<{ id: string; name: string; client_id: string }>;
  influencers: Array<{ id: string; name: string }>;
  handles: Array<{ influencer_id: string; handle: string }>;
  headers: Array<{ id: string; document_number: string; name: string }>;
  lines: Array<{ id: string; document_number: string; campaign_header_id: string }>;
  overrides: Array<{ entity_type: string; source_key: string; resolved_id: string }>;
};

export type ResolvedEntities = {
  intClientId: string | null;
  intBrandId: string | null;
  intInfluencerId: string | null;
  resolvedHeaderId: string | null;
  resolvedLineId: string | null;
  matchConfidence: number;
};

export async function loadLiveMasters(supabase: SupabaseClient): Promise<LiveMasters> {
  const [groups, clients, brands, influencers, handles, headers, lines, overrides] =
    await Promise.all([
      supabase.from("groups").select("id, name"),
      supabase.from("clients").select("id, name, group_id"),
      supabase.from("brands").select("id, name, client_id"),
      supabase.from("influencers").select("id, display_name"),
      supabase.from("influencer_platform_accounts").select("influencer_id, handle"),
      supabase.from("campaign_headers").select("id, document_number, name"),
      supabase.from("campaign_lines").select("id, document_number, campaign_header_id"),
      supabase.schema("intelligence").from("entity_resolution_overrides").select("*"),
    ]);

  const masterErrors = [
    groups.error,
    clients.error,
    brands.error,
    influencers.error,
    handles.error,
    headers.error,
    lines.error,
  ].filter(Boolean);
  if (masterErrors.length > 0) {
    throw new Error(masterErrors.map((e) => e?.message).join("; "));
  }

  // Overrides live in the intelligence schema — degrade to empty when the API
  // schema is not exposed (PGRST106) so Studio brand matching still works.
  const overridesUnavailable = isMissingIntelligenceTableError(overrides.error?.message);
  if (overrides.error && !overridesUnavailable) {
    throw new Error(overrides.error.message);
  }

  return {
    groups: groups.data ?? [],
    clients: clients.data ?? [],
    brands: brands.data ?? [],
    influencers: (influencers.data ?? []).map((row) => ({
      id: row.id,
      name: row.display_name,
    })),
    handles: handles.data ?? [],
    headers: headers.data ?? [],
    lines: lines.data ?? [],
    overrides: overridesUnavailable ? [] : (overrides.data ?? []),
  };
}

function lookupOverride(
  masters: LiveMasters,
  entityType: string,
  sourceKey: string
): string | null {
  const hit = masters.overrides.find(
    (row) => row.entity_type === entityType && row.source_key === sourceKey
  );
  return hit?.resolved_id ?? null;
}

export function resolveClient(
  masters: LiveMasters,
  clientName: string | null,
  groupName: string | null
): { resolvedGroupId: string | null; resolvedClientId: string | null; confidence: number } {
  const sourceKey = `${normalizeName(groupName)}|${normalizeName(clientName)}`;
  const override = lookupOverride(masters, "client", sourceKey);
  if (override) {
    const client = masters.clients.find((c) => c.id === override);
    return {
      resolvedGroupId: client?.group_id ?? null,
      resolvedClientId: override,
      confidence: 1,
    };
  }

  const clientCandidates = masters.clients.map((c) => ({ id: c.id, label: c.name }));
  const clientMatch = bestFuzzyMatch(clientName, clientCandidates, 0.88);
  if (!clientMatch) return { resolvedGroupId: null, resolvedClientId: null, confidence: 0 };

  const client = masters.clients.find((c) => c.id === clientMatch.id);
  let groupConfidence = 0;
  let resolvedGroupId = client?.group_id ?? null;
  if (groupName && resolvedGroupId) {
    const group = masters.groups.find((g) => g.id === resolvedGroupId);
    groupConfidence = group ? bestFuzzyMatch(groupName, [{ id: group.id, label: group.name }], 0.75)?.score ?? 0 : 0;
  }

  const confidence = Math.round(((clientMatch.score + groupConfidence) / (groupName ? 2 : 1)) * 10000) / 10000;
  return { resolvedGroupId, resolvedClientId: clientMatch.id, confidence };
}

export function resolveBrand(
  masters: LiveMasters,
  brandName: string | null,
  clientId: string | null
): { resolvedBrandId: string | null; confidence: number } {
  const sourceKey = `${normalizeName(brandName)}|${clientId ?? ""}`;
  const override = lookupOverride(masters, "brand", sourceKey);
  if (override) return { resolvedBrandId: override, confidence: 1 };

  const scoped = clientId
    ? masters.brands.filter((b) => b.client_id === clientId)
    : masters.brands;
  const match = bestFuzzyMatch(
    brandName,
    scoped.map((b) => ({ id: b.id, label: b.name })),
    0.86
  );
  return match
    ? { resolvedBrandId: match.id, confidence: match.score }
    : { resolvedBrandId: null, confidence: 0 };
}

export function resolveInfluencer(
  masters: LiveMasters,
  displayName: string | null,
  username: string | null
): { resolvedInfluencerId: string | null; confidence: number } {
  const sourceKey = `${normalizeName(displayName)}|${normalizeHandle(username)}`;
  const override = lookupOverride(masters, "influencer", sourceKey);
  if (override) return { resolvedInfluencerId: override, confidence: 1 };

  const handleCandidates = [
    normalizeHandle(username),
    normalizeHandle(displayName?.startsWith("@") ? displayName : null),
  ].filter(Boolean);

  for (const handle of handleCandidates) {
    const handleHit = masters.handles.find((h) => normalizeHandle(h.handle) === handle);
    if (handleHit) return { resolvedInfluencerId: handleHit.influencer_id, confidence: 0.97 };
  }

  const match = bestFuzzyMatch(
    displayName,
    masters.influencers.map((i) => ({ id: i.id, label: i.name })),
    0.84
  );
  return match
    ? { resolvedInfluencerId: match.id, confidence: match.score }
    : { resolvedInfluencerId: null, confidence: 0 };
}

export function resolveCampaign(
  masters: LiveMasters,
  row: HarmonizedCampaignRow
): { resolvedHeaderId: string | null; resolvedLineId: string | null; confidence: number } {
  const campKey = normalizeCampaignDocumentNumber(row.source_campaign_key);
  const lineKey = row.source_line_key?.trim() ?? null;

  if (campKey) {
    const headerOverride = lookupOverride(masters, "campaign_header", campKey);
    const header = headerOverride
      ? masters.headers.find((h) => h.id === headerOverride)
      : masters.headers.find(
          (h) => normalizeCampaignDocumentNumber(h.document_number) === campKey
        );

    if (header) {
      let line: (typeof masters.lines)[number] | undefined;
      if (lineKey) {
        const lineOverride = lookupOverride(masters, "campaign_line", `${campKey}|${lineKey}`);
        line = lineOverride
          ? masters.lines.find((l) => l.id === lineOverride)
          : masters.lines.find(
              (l) =>
                l.campaign_header_id === header.id &&
                (l.document_number.endsWith(`-${lineKey}`) ||
                  l.document_number.toLowerCase().includes(lineKey.toLowerCase()))
            );
      }

      const confidence = line ? 0.95 : 0.88;
      return {
        resolvedHeaderId: header.id,
        resolvedLineId: line?.id ?? null,
        confidence,
      };
    }
  }

  if (row.campaign_name) {
    const fuzzyHeader = bestFuzzyMatch(
      row.campaign_name,
      masters.headers.map((h) => ({ id: h.id, label: h.name })),
      0.9
    );
    if (fuzzyHeader) {
      return {
        resolvedHeaderId: fuzzyHeader.id,
        resolvedLineId: null,
        confidence: fuzzyHeader.score * 0.9,
      };
    }
  }

  return { resolvedHeaderId: null, resolvedLineId: null, confidence: 0 };
}

export function aggregateMatchConfidence(parts: number[]): number {
  const valid = parts.filter((p) => p > 0);
  if (valid.length === 0) return 0;
  const sum = valid.reduce((a, b) => a + b, 0);
  return Math.round((sum / valid.length) * 10000) / 10000;
}
