import type { QuotationCreatorPlatformOption } from "@/features/quotations/actions";
import { getQuotationCreatorPlatformOptions } from "@/features/quotations/actions";
import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";
import {
  bootstrapPlatformOptionsFromItem,
  bootstrapManualCreatorPlatformOptions,
  isManualQuotationCreator,
  mergeCreatorPlatformOptions,
} from "@/lib/quotations/quotation-creator-platform-utils";

export {
  bootstrapPlatformOptionsFromItem,
  bootstrapManualCreatorPlatformOptions,
  isManualQuotationCreator,
  mergeCreatorPlatformOptions,
} from "@/lib/quotations/quotation-creator-platform-utils";

const platformOptionsCache = new Map<string, QuotationCreatorPlatformOption[]>();
const inflightRequests = new Map<string, Promise<QuotationCreatorPlatformOption[]>>();

export function quotationCreatorPlatformCacheKey(item: {
  unified_id?: string | null;
  influencer_id?: string | null;
  profile_id?: string | null;
}): string | null {
  return item.unified_id ?? item.influencer_id ?? item.profile_id ?? null;
}

export function getCachedCreatorPlatformOptions(
  key: string | null
): QuotationCreatorPlatformOption[] | null {
  if (!key) return null;
  return platformOptionsCache.get(key) ?? null;
}

export async function loadCreatorPlatformOptions(
  item: QuotationItemRow
): Promise<QuotationCreatorPlatformOption[]> {
  const key = quotationCreatorPlatformCacheKey(item);
  const bootstrap = bootstrapPlatformOptionsFromItem(item);
  if (!key) {
    return isManualQuotationCreator(item) && bootstrap.length === 0
      ? bootstrapManualCreatorPlatformOptions()
      : bootstrap;
  }

  const cached = platformOptionsCache.get(key);
  if (cached?.length) return mergeCreatorPlatformOptions(bootstrap, cached);

  const inflight = inflightRequests.get(key);
  if (inflight) return inflight.then((platforms) => mergeCreatorPlatformOptions(bootstrap, platforms));

  const request = getQuotationCreatorPlatformOptions({
    unified_id: item.unified_id,
    influencer_id: item.influencer_id,
    profile_id: item.profile_id,
  })
    .then((res) => {
      const fetched =
        res.ok && res.data?.platforms?.length ? res.data.platforms : [];
      const platforms = mergeCreatorPlatformOptions(bootstrap, fetched);
      if (platforms.length > 0) {
        platformOptionsCache.set(key, platforms);
      }
      return platforms.length > 0 ? platforms : bootstrap;
    })
    .catch(() => bootstrap)
    .finally(() => {
      inflightRequests.delete(key);
    });

  inflightRequests.set(key, request);
  return request;
}

/** Clear cache entry after structural quotation changes (optional). */
export function invalidateCreatorPlatformOptionsCache(key: string | null): void {
  if (!key) return;
  platformOptionsCache.delete(key);
  inflightRequests.delete(key);
}
