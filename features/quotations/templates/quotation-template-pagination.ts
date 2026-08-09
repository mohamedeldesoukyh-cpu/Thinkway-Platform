/**
 * Manual pagination for fixed A4-landscape quotation pages (297×210mm).
 * Heights are millimetres of usable content — tuned against Thinkway Showcase PDF.
 */

export const MIX_PAGE_HEAD_MM = 30;
export const MIX_PAGE_BUDGET_MM = 176;
export const MIX_ROW_MM = 6.7;
export const MIX_TIER_HEADER_MM = 17;
export const MIX_BANNER_MM = 28;
/** Category cards on line-item first mix page (approx). */
export const MIX_CATEGORY_BLOCK_MM = 42;

export type MixPlatformRow = {
  platform: string;
  followers: string;
  views: string;
  engagement: string;
};

export type MixCreatorUnit = {
  handle: string;
  category: string;
  fee: string | null;
  platforms: MixPlatformRow[];
};

export type MixTierInput = {
  name: string;
  slug: string;
  meta: string;
  creators: MixCreatorUnit[];
};

export type MixPageTierSlice = {
  name: string;
  slug: string;
  meta: string;
  continued: boolean;
  creators: MixCreatorUnit[];
};

export type MixPagePlan = {
  continued: boolean;
  /** First page of line-item mix may show category cards. */
  showCategories: boolean;
  tiers: MixPageTierSlice[];
  showBanner: boolean;
};

function creatorUnitHeightMm(creator: MixCreatorUnit): number {
  const rows = Math.max(1, creator.platforms.length);
  return rows * MIX_ROW_MM;
}

function tierBodyHeightMm(creators: MixCreatorUnit[]): number {
  return creators.reduce((sum, creator) => sum + creatorUnitHeightMm(creator), 0);
}

/**
 * Pack tier/creator units into fixed-height pages.
 * Never splits a creator's platform rows; re-emits tier headers as "(cont.)".
 */
export function paginateMixTiers(
  tiers: MixTierInput[],
  options?: {
    /** Reserve space for category cards on the first page only. */
    firstPageExtraMm?: number;
    /** Total investment / grand-total banner on the last page. */
    includeBanner?: boolean;
  }
): MixPagePlan[] {
  const firstPageExtraMm = options?.firstPageExtraMm ?? 0;
  const includeBanner = options?.includeBanner ?? true;
  if (tiers.length === 0) {
    return [
      {
        continued: false,
        showCategories: firstPageExtraMm > 0,
        tiers: [],
        showBanner: includeBanner,
      },
    ];
  }

  const pages: MixPagePlan[] = [];
  let pageTiers: MixPageTierSlice[] = [];
  let used = MIX_PAGE_HEAD_MM + firstPageExtraMm;
  let isFirstPage = true;
  let pageContinued = false;

  const flush = (showBanner: boolean) => {
    pages.push({
      continued: pageContinued,
      showCategories: isFirstPage && firstPageExtraMm > 0,
      tiers: pageTiers,
      showBanner,
    });
    pageTiers = [];
    used = MIX_PAGE_HEAD_MM;
    isFirstPage = false;
    pageContinued = true;
  };

  const startTier = (slice: MixPageTierSlice, height: number) => {
    pageTiers.push(slice);
    used += height;
  };

  tiers.forEach((tier, tierIndex) => {
    const isLastTier = tierIndex === tiers.length - 1;
    let remaining = [...tier.creators];
    let continued = false;

    while (remaining.length > 0) {
      const next = remaining[0]!;
      const unitH = creatorUnitHeightMm(next);
      const needHeader = pageTiers.length === 0 || pageTiers[pageTiers.length - 1]?.slug !== tier.slug;
      const headerH = needHeader ? MIX_TIER_HEADER_MM : 0;
      const bannerReserve =
        includeBanner && isLastTier && remaining.length === tier.creators.length && !continued
          ? MIX_BANNER_MM
          : includeBanner && isLastTier && remaining.length === 1
            ? MIX_BANNER_MM
            : 0;

      // Before opening the final tier, prefer keeping the whole tier + banner together.
      if (
        includeBanner &&
        isLastTier &&
        !continued &&
        remaining.length === tier.creators.length &&
        pageTiers.length > 0
      ) {
        const wholeTierH =
          MIX_TIER_HEADER_MM + tierBodyHeightMm(tier.creators) + MIX_BANNER_MM;
        if (used + wholeTierH > MIX_PAGE_BUDGET_MM) {
          flush(false);
          continued = false;
          continue;
        }
      }

      if (used + headerH + unitH + bannerReserve > MIX_PAGE_BUDGET_MM) {
        if (pageTiers.length > 0) {
          flush(false);
          continued = pageContinued;
          continue;
        }
        // Force at least one creator onto an empty page (oversized unit).
      }

      if (needHeader) {
        startTier(
          {
            name: tier.name,
            slug: tier.slug,
            meta: tier.meta,
            continued,
            creators: [next],
          },
          headerH + unitH
        );
      } else {
        const last = pageTiers[pageTiers.length - 1]!;
        last.creators.push(next);
        used += unitH;
      }
      remaining = remaining.slice(1);
      continued = true;
    }
  });

  if (pageTiers.length > 0 || pages.length === 0) {
    pages.push({
      continued: pageContinued && pages.length > 0,
      showCategories: isFirstPage && firstPageExtraMm > 0,
      tiers: pageTiers,
      showBanner: includeBanner,
    });
  } else if (includeBanner && pages.length > 0) {
    pages[pages.length - 1]!.showBanner = true;
  }

  // Ensure banner is only on the final page.
  for (let i = 0; i < pages.length; i++) {
    pages[i]!.showBanner = includeBanner && i === pages.length - 1;
  }

  return pages;
}
