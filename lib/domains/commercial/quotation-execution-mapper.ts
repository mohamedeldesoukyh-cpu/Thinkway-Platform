import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import type { LinePlatformSelection } from "@/lib/campaigns/line-assignment";
import {
  ALL_PLATFORMS_TYPE,
  deliverableTypeLines,
  postTypePlatformKey,
} from "@/lib/quotations/quotation-deliverable-types";
import type { UnifiedCreatorResult } from "@/lib/domains/creator/types";
import { normalizeCreatorId } from "@/features/campaign-studio/services/studio-draft";

import {
  buildScheduleHintsFromQuotationDeliverables,
  type ExecutionLineSeed,
} from "./campaign-execution-schedule-inheritance";
import type { QuotationDeliverable } from "./quotation-types";

export type QuotationItemExecutionRow = {
  id: string;
  influencer_id: string | null;
  unified_id: string | null;
  creator_name: string | null;
  platform: string | null;
  handle: string | null;
  deliverables: QuotationDeliverable[] | null;
  cost: number;
  revenue: number;
  cost_currency: string;
  option_number: number | null;
};

function parseDeliverables(raw: unknown): QuotationDeliverable[] {
  if (!Array.isArray(raw)) return [];
  return raw as QuotationDeliverable[];
}

function findCreatorForItem(
  item: QuotationItemExecutionRow,
  creators: UnifiedCreatorResult[]
): UnifiedCreatorResult | null {
  if (item.influencer_id) {
    const byInfluencer = creators.find((c) => c.influencer_id === item.influencer_id);
    if (byInfluencer) return byInfluencer;
  }

  if (item.unified_id) {
    const key = normalizeCreatorId(item.unified_id);
    const byUnified = creators.find(
      (c) => normalizeCreatorId(c.unified_id) === key
    );
    if (byUnified) return byUnified;
  }

  if (item.creator_name) {
    const name = item.creator_name.trim().toLowerCase();
    const byName = creators.find(
      (c) => c.display_name.trim().toLowerCase() === name
    );
    if (byName) return byName;
  }

  return null;
}

/** Split quotation platform cells like "instagram,tiktok,facebook" into canonical keys. */
function platformKeysFromRaw(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const parts = raw
    .split(/[,|/]+/)
    .map((part) => canonicalPlatformKey(part.trim()))
    .filter(Boolean);
  return [...new Set(parts)];
}

/**
 * Assign each selected post type to its native / mirrored platform.
 * Multi-platform cells (e.g. "instagram,tiktok,youtube") are package context only —
 * they must not copy every type onto every platform.
 */
export function quotationDeliverablesToPlatforms(
  deliverables: QuotationDeliverable[],
  creator: UnifiedCreatorResult | null,
  item: QuotationItemExecutionRow
): LinePlatformSelection[] {
  const grouped = new Map<string, string[]>();

  for (const deliverable of deliverables) {
    const lines = deliverableTypeLines(deliverable);
    const types = lines
      .flatMap((line) =>
        Array.from({ length: Math.max(1, line.quantity) }, () => line.type.trim())
      )
      .filter(Boolean);

    const packagePlatforms = platformKeysFromRaw(deliverable.platform);
    const itemPlatforms = platformKeysFromRaw(item.platform);
    const fallbackPlatform =
      itemPlatforms[0] ?? packagePlatforms[0] ?? "instagram";

    for (const type of types) {
      const required = postTypePlatformKey(type);
      let targets: string[];

      if (
        type === "mirrored_on_all_pf" ||
        type === ALL_PLATFORMS_TYPE ||
        type === "cross_posting"
      ) {
        targets =
          packagePlatforms.length > 0
            ? packagePlatforms
            : itemPlatforms.length > 0
              ? itemPlatforms
              : [fallbackPlatform];
      } else if (required) {
        targets = [required];
      } else {
        // Platform-agnostic types (visit, event_coverage, legacy generics).
        targets = [fallbackPlatform];
      }

      for (const platformKey of targets) {
        const existing = grouped.get(platformKey) ?? [];
        grouped.set(platformKey, [...existing, type]);
      }
    }
  }

  const selections: LinePlatformSelection[] = [];

  for (const [platformKey, types] of grouped) {
    const account =
      creator?.platforms?.find(
        (p) => canonicalPlatformKey(p.platform) === platformKey
      ) ?? null;

    if (!account?.id || !account.handle) continue;

    const uniqueTypes = [...new Set(types.length ? types : ["other"])];

    selections.push({
      account_id: account.id,
      platform: platformKey,
      handle: account.handle,
      profile_url: account.profile_url ?? null,
      follower_count: account.follower_count ?? 0,
      engagement_rate: account.engagement_rate ?? null,
      audience_country: account.audience_country ?? null,
      deliverables: uniqueTypes,
    });
  }

  return selections;
}

/**
 * Map quotation commercial snapshot rows into execution line seeds.
 * One line per quotation item (preserves multi-option rows).
 */
export function mapQuotationItemsToExecutionLineSeeds(input: {
  items: QuotationItemExecutionRow[];
  creators: UnifiedCreatorResult[];
  influencerIdByCreatorId: Map<string, string>;
  defaultCurrency: string;
}): ExecutionLineSeed[] {
  const seeds: ExecutionLineSeed[] = [];

  for (const item of input.items) {
    if (!item.influencer_id) continue;

    const creator = findCreatorForItem(item, input.creators);
    const deliverables = parseDeliverables(item.deliverables);
    const platforms = quotationDeliverablesToPlatforms(deliverables, creator, item);

    if (platforms.length === 0) continue;

    const revenue = Math.round(item.revenue > 0 ? item.revenue : item.cost);
    const cost = Math.round(item.cost > 0 ? item.cost : revenue);
    const optionLabel =
      item.option_number != null && item.option_number > 0
        ? ` · Option ${item.option_number}`
        : "";

    seeds.push({
      influencerId: item.influencer_id,
      unifiedId: item.unified_id ?? creator?.unified_id ?? item.influencer_id,
      displayName: (item.creator_name ?? creator?.display_name ?? "Vendor") + optionLabel,
      platforms,
      revenue,
      cost,
      currencyCode: item.cost_currency || input.defaultCurrency,
      scheduleHints: buildScheduleHintsFromQuotationDeliverables(deliverables),
    });
  }

  return seeds;
}
