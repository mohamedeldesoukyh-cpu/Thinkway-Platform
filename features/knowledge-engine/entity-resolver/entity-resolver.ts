import type { SupabaseClient } from "@supabase/supabase-js";

import type { ContextBuilderInput } from "@/features/ai/shared";

import type { DisambiguationOption, EntityType, ResolvedEntity } from "../types";
import { searchCampaignContext, searchEntityWithPriority } from "../search/entity-search";
import {
  detectPlatform,
  extractEntityCandidates,
  extractHandles,
  extractHashtags,
  extractTwDocumentNumbers,
  inferEntityTypeFromDocumentNumber,
  isKnownPlatform,
} from "../search/patterns";

type ResolutionResult = {
  entities: ResolvedEntity[];
  disambiguation?: DisambiguationOption[];
};

const requestDedupe = new Map<string, Promise<ResolvedEntity[]>>();

function dedupeKey(type: EntityType, query: string): string {
  return `${type}:${query.trim().toLowerCase()}`;
}

async function searchDeduped(
  supabase: SupabaseClient,
  query: string,
  type: EntityType
): Promise<ResolvedEntity[]> {
  const key = dedupeKey(type, query);
  const existing = requestDedupe.get(key);
  if (existing) return existing;

  const promise = searchEntityWithPriority(supabase, query, type).then((hits) =>
    hits.map((hit) => ({
      id: hit.id,
      type: hit.type,
      label: hit.label,
      confidence: hit.confidence,
      matchedBy: hit.matchedBy,
      source: "database" as const,
      metadata: hit.metadata,
    }))
  );

  requestDedupe.set(key, promise);
  try {
    return await promise;
  } finally {
    requestDedupe.delete(key);
  }
}

function workspaceEntity(
  type: EntityType,
  id: string,
  label: string
): ResolvedEntity {
  return {
    id,
    type,
    label,
    confidence: 100,
    matchedBy: "workspace",
    source: "workspace",
  };
}

function collectWorkspaceEntities(
  input?: Omit<ContextBuilderInput, "request">
): ResolvedEntity[] {
  const entities: ResolvedEntity[] = [];

  if (input?.campaign?.id) {
    entities.push(
      workspaceEntity(
        "campaign",
        input.campaign.id,
        input.campaign.name ?? input.campaign.code ?? input.campaign.id
      )
    );
  }
  if (input?.client?.id) {
    entities.push(
      workspaceEntity("client", input.client.id, input.client.name)
    );
  }
  if (input?.shortlist?.id) {
    entities.push(
      workspaceEntity("shortlist", input.shortlist.id, input.shortlist.name)
    );
  }

  return entities;
}

function mergeEntities(existing: ResolvedEntity[], incoming: ResolvedEntity[]): ResolvedEntity[] {
  const map = new Map<string, ResolvedEntity>();
  for (const entity of [...existing, ...incoming]) {
    const key = `${entity.type}:${entity.id}`;
    const prev = map.get(key);
    if (!prev || entity.confidence > prev.confidence) {
      map.set(key, entity);
    }
  }
  return [...map.values()].sort((a, b) => b.confidence - a.confidence);
}

function buildDisambiguation(
  candidates: ResolvedEntity[],
  type: EntityType
): DisambiguationOption[] | undefined {
  const filtered = candidates.filter((c) => c.type === type);
  if (filtered.length <= 1) return undefined;

  return filtered.slice(0, 6).map((c) => ({
    id: c.id,
    type: c.type,
    label: c.label,
    confidence: c.confidence,
    matchedBy: c.matchedBy,
    subtitle: c.metadata?.subtitle as string | undefined,
  }));
}

const UUID_FORMAT_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuidFormat(value: string): boolean {
  return UUID_FORMAT_RE.test(value.trim());
}

function queueCandidateSearch(
  supabase: SupabaseClient,
  candidate: string,
  campaignIntent: boolean,
  searchTasks: Array<Promise<ResolvedEntity[]>>
): void {
  if (isUuidFormat(candidate)) {
    searchTasks.push(
      Promise.all([
        searchDeduped(supabase, candidate, "campaign"),
        searchDeduped(supabase, candidate, "client"),
        searchDeduped(supabase, candidate, "brand"),
      ]).then((results) => results.flat())
    );
    return;
  }

  if (/^TW-/i.test(candidate)) {
    searchTasks.push(
      searchDeduped(
        supabase,
        candidate,
        inferEntityTypeFromDocumentNumber(candidate) === "campaign_line"
          ? "campaign_line"
          : "campaign"
      )
    );
    return;
  }

  if (campaignIntent && candidate.length >= 4) {
    searchTasks.push(
      searchCampaignContext(supabase, candidate).then((hits) =>
        hits.map((hit) => ({
          id: hit.id,
          type: hit.type,
          label: hit.label,
          confidence: hit.confidence,
          matchedBy: hit.matchedBy,
          source: "database" as const,
          metadata: hit.metadata,
        }))
      )
    );
    return;
  }

  searchTasks.push(
    Promise.all([
      searchDeduped(supabase, candidate, "brand"),
      searchDeduped(supabase, candidate, "client"),
      searchDeduped(supabase, candidate, "campaign"),
      searchDeduped(supabase, candidate, "shortlist"),
    ]).then((results) => results.flat())
  );
}

export async function resolveEntitiesFromMessage(
  supabase: SupabaseClient,
  message: string,
  workspaceInput?: Omit<ContextBuilderInput, "request">
): Promise<ResolutionResult> {
  requestDedupe.clear();

  const entities: ResolvedEntity[] = collectWorkspaceEntities(workspaceInput);
  const candidates: string[] = extractEntityCandidates(message);
  const docNumbers = extractTwDocumentNumbers(message);
  const handles = extractHandles(message);
  const hashtags = extractHashtags(message);
  const platform = detectPlatform(message);

  const searchTasks: Array<Promise<ResolvedEntity[]>> = [];

  for (const doc of docNumbers) {
    const hint = inferEntityTypeFromDocumentNumber(doc);
    searchTasks.push(
      searchDeduped(
        supabase,
        doc,
        hint === "document_number" ? "campaign" : hint
      )
    );
  }

  for (const handle of handles) {
    searchTasks.push(searchDeduped(supabase, handle, "creator_handle"));
  }

  for (const tag of hashtags) {
    entities.push({
      id: tag,
      type: "hashtag",
      label: `#${tag}`,
      confidence: 92,
      matchedBy: "pattern",
      source: "message",
    });
  }

  if (platform && isKnownPlatform(platform)) {
    entities.push({
      id: platform,
      type: "platform",
      label: platform,
      confidence: 95,
      matchedBy: "pattern",
      source: "message",
      metadata: { platform },
    });
  }

  const campaignIntent = /\bcampaign\b/i.test(message);
  for (let index = 0; index < candidates.length; index += 1) {
    queueCandidateSearch(supabase, candidates[index]!, campaignIntent, searchTasks);
  }

  const searchResults = await Promise.all(searchTasks);
  const merged = mergeEntities(entities, searchResults.flat());

  const campaignMatches = merged.filter((e) => e.type === "campaign");
  const brandMatches = merged.filter((e) => e.type === "brand");
  const clientMatches = merged.filter((e) => e.type === "client");

  let disambiguation: DisambiguationOption[] | undefined;

  if (campaignIntent && campaignMatches.length > 1) {
    disambiguation = buildDisambiguation(campaignMatches, "campaign");
  } else if (brandMatches.length > 1 && !campaignMatches.length) {
    disambiguation = buildDisambiguation(brandMatches, "brand");
  } else if (clientMatches.length > 1 && !brandMatches.length && !campaignMatches.length) {
    disambiguation = buildDisambiguation(clientMatches, "client");
  }

  return { entities: merged, disambiguation };
}

export function clearEntityResolutionDedupe(): void {
  requestDedupe.clear();
}
