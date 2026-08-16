import { normalizeCreators, type GroundedCreator } from "@/features/ai-workflows/formatters/creator-formatter";
import type { CampaignObject } from "@/features/campaign-intelligence";
import type { CreatorsSectionData } from "@/features/campaign-intelligence/types/section-schemas";
import type { AiActionCard, AiMessage } from "@/features/ai-workspace/types";
import { dedupeCreatorIds } from "@/lib/creators/dedupe-creators";

export type StudioSearchPool = {
  creatorIds: string[];
  creators: GroundedCreator[];
  total: number;
};

const EMPTY_POOL: StudioSearchPool = {
  creatorIds: [],
  creators: [],
  total: 0,
};

function readStringIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
}

function poolFromCard(card: AiActionCard): StudioSearchPool {
  const creators = normalizeCreators(card.payload.creators, "actionCardParser");
  const fromPayload = readStringIds(card.payload.creatorIds);
  const creatorIds = dedupeCreatorIds(fromPayload.length > 0 ? fromPayload : creators.map((c) => c.id));
  const totalRaw = card.payload.total;
  const total =
    typeof totalRaw === "number" && Number.isFinite(totalRaw) && totalRaw > 0
      ? Math.max(totalRaw, creatorIds.length)
      : creatorIds.length;
  return { creatorIds, creators, total };
}

/** Best Creator Match / searchCreators card in a Studio action-card list. */
export function searchPoolFromActionCards(
  cards: readonly AiActionCard[] | undefined
): StudioSearchPool {
  let best = EMPTY_POOL;
  for (const card of cards ?? []) {
    if (card.type !== "creator_search") continue;
    const pool = poolFromCard(card);
    if (pool.creatorIds.length > best.creatorIds.length) {
      best = pool;
    }
  }
  return best;
}

export function creatorSearchActionCardsFromMessages(
  messages: readonly AiMessage[] | undefined
): AiActionCard[] {
  const cards: AiActionCard[] = [];
  for (const message of messages ?? []) {
    for (const card of message.metadata?.actionCards ?? []) {
      if (card.type === "creator_search") cards.push(card);
    }
  }
  return cards;
}

export function mergeActionCards(
  ...groups: Array<readonly AiActionCard[] | undefined>
): AiActionCard[] {
  const byId = new Map<string, AiActionCard>();
  for (const group of groups) {
    for (const card of group ?? []) {
      if (!byId.has(card.id)) byId.set(card.id, card);
    }
  }
  return [...byId.values()];
}

function readCreatorsData(campaignObject: CampaignObject): CreatorsSectionData {
  return (campaignObject.sections.creators.data ?? {}) as CreatorsSectionData;
}

/**
 * When the Campaign Object has no discovery IDs but Creator Match already
 * returned a pool, copy those IDs onto discovery so mix / sufficiency / Recommended
 * stop treating a real search as empty inventory.
 */
export function ingestSearchPoolIfNeeded(
  campaignObject: CampaignObject,
  cards: readonly AiActionCard[] | undefined
): {
  campaignObject: CampaignObject;
  ingested: boolean;
  pool: StudioSearchPool;
} {
  const pool = searchPoolFromActionCards(cards);
  const creatorsData = readCreatorsData(campaignObject);
  const existingIds = dedupeCreatorIds(creatorsData.discovery?.creatorIds ?? []);
  if (existingIds.length > 0 || pool.creatorIds.length === 0) {
    return { campaignObject, ingested: false, pool };
  }

  const blocked = creatorsData.slateProposalStatus;
  const nextStatus =
    blocked?.reason === "no_discovery_results" ? undefined : blocked;

  return {
    campaignObject: {
      ...campaignObject,
      sections: {
        ...campaignObject.sections,
        creators: {
          ...campaignObject.sections.creators,
          data: {
            ...creatorsData,
            phase: creatorsData.phase === "proposal" ? creatorsData.phase : "discovery",
            discovery: {
              creatorIds: pool.creatorIds,
              total: Math.max(pool.total, pool.creatorIds.length, creatorsData.discovery?.total ?? 0),
              query: creatorsData.discovery?.query,
            },
            slateProposalStatus: nextStatus,
          } satisfies CreatorsSectionData as unknown as Record<string, unknown>,
        },
      },
    },
    ingested: true,
    pool,
  };
}
