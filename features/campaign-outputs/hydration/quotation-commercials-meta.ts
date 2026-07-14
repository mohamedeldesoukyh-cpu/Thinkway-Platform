import type { CampaignObjectMeta } from "@/features/campaign-intelligence/types/campaign-object";

import type { SeedCreator } from "./hydration-types";
import { normalizeCreatorMatchKey } from "./quotation-service-types";

/** Durable quotation commercial snapshot — survives Copilot creator-section overwrites. */
export type QuotationCommercialCreator = {
  creatorId: string;
  displayName: string;
  tier?: string;
  platform?: string;
  handle?: string;
  avatarUrl?: string;
  profileUrl?: string;
  serviceTypes: string[];
  quotedRevenue?: number;
  quotedCurrency?: string;
};

export type QuotationCommercialsMeta = {
  quotationId?: string;
  syncedAt: string;
  creators: QuotationCommercialCreator[];
  /** Legal entity (client) — distinct from brand. */
  clientName?: string;
  brandName?: string;
  groupName?: string;
  agencyOrDirect?: "agency" | "direct" | "hybrid";
  /** Legal entity / agency name when `agencyOrDirect` is agency. */
  agencyName?: string;
};

export function quotationCommercialCreatorKey(
  creator: Pick<SeedCreator, "creatorId" | "handle" | "displayName">
): string {
  const handle = creator.handle?.replace(/^@/, "").trim().toLowerCase();
  if (handle) return `h:${handle}`;
  const name = normalizeCreatorMatchKey(creator.displayName);
  if (name) return `n:${name}`;
  return `i:${creator.creatorId.trim().toLowerCase()}`;
}

export type QuotationCommercialsContextPatch = {
  quotationId?: string;
  syncedAt?: string;
  clientName?: string;
  brandName?: string;
  groupName?: string;
  agencyOrDirect?: "agency" | "direct" | "hybrid";
  agencyName?: string;
};

/** Merge context fields onto an existing quotation commercials snapshot. */
export function mergeQuotationCommercialsContext(
  existing: QuotationCommercialsMeta | undefined,
  patch: QuotationCommercialsContextPatch
): QuotationCommercialsMeta {
  const syncedAt = patch.syncedAt ?? existing?.syncedAt ?? new Date().toISOString();
  const agencyOrDirect = patch.agencyOrDirect ?? existing?.agencyOrDirect;
  const agencyName =
    agencyOrDirect === "agency"
      ? patch.agencyName?.trim() || existing?.agencyName
      : agencyOrDirect === "direct"
        ? undefined
        : existing?.agencyName;

  return {
    quotationId: patch.quotationId ?? existing?.quotationId,
    syncedAt,
    creators: existing?.creators ?? [],
    clientName: patch.clientName?.trim() || existing?.clientName,
    brandName: patch.brandName?.trim() || existing?.brandName,
    groupName: patch.groupName?.trim() || existing?.groupName,
    agencyOrDirect,
    agencyName,
  };
}

export function buildQuotationCommercialsMeta(
  creators: SeedCreator[],
  options?: {
    quotationId?: string;
    syncedAt?: string;
    clientName?: string;
    brandName?: string;
    groupName?: string;
    agencyOrDirect?: "agency" | "direct" | "hybrid";
    agencyName?: string;
  }
): QuotationCommercialsMeta {
  const syncedAt = options?.syncedAt ?? new Date().toISOString();
  const seen = new Set<string>();
  const commercialCreators: QuotationCommercialCreator[] = [];

  for (const creator of creators) {
    const key = quotationCommercialCreatorKey(creator);
    if (seen.has(key)) continue;
    seen.add(key);

    const serviceTypes = [
      ...new Set((creator.serviceTypes ?? []).filter((type) => type.trim())),
    ];
    if (!serviceTypes.length && creator.serviceLabel?.trim()) {
      serviceTypes.push(
        ...creator.serviceLabel
          .split(/\s*(?:\+|·)\s*/)
          .map((part) => part.trim())
          .filter(Boolean)
      );
    }

    commercialCreators.push({
      creatorId: creator.creatorId,
      displayName: creator.displayName,
      tier: creator.tier,
      platform: creator.platform,
      handle: creator.handle,
      avatarUrl: creator.avatarUrl,
      profileUrl: creator.profileUrl,
      serviceTypes,
      quotedRevenue: creator.quotedRevenue,
      quotedCurrency: creator.quotedCurrency,
    });
  }

  return {
    quotationId: options?.quotationId,
    syncedAt,
    creators: commercialCreators,
    clientName: options?.clientName?.trim() || undefined,
    brandName: options?.brandName?.trim() || undefined,
    groupName: options?.groupName?.trim() || undefined,
    agencyOrDirect: options?.agencyOrDirect,
    agencyName: options?.agencyName?.trim() || undefined,
  };
}

export function quotationCommercialsFromMeta(
  meta: CampaignObjectMeta | undefined
): QuotationCommercialsMeta | undefined {
  const snapshot = meta?.quotationCommercials;
  if (!snapshot?.creators?.length) return undefined;
  return snapshot;
}
