/**
 * Enrich quotation items with creator avatars for preview/PDF export only.
 */
import { enrichQuotationItemsWithCreatorAvatars } from "@/lib/services/quotations/enrich-quotation-item-avatars";
import { avatarStorageQualityRank } from "@/lib/creators/creator-centric";
import { isDurableStoredAvatarUrl } from "@/lib/creators/dna-avatar";
import { creatorAvatarBrowserDisplayUrl } from "@/lib/performance/creator-avatar";
import { fetchCreatorAvatarImage } from "@/lib/creators/creator-avatar-proxy";
import {
  isDisplayableAvatarUrl,
  isInstagramCdnUrlExpired,
  isUsableAvatarUrl,
} from "@/lib/performance/avatar-sync-policy";
import { detectImageContentType } from "@/lib/performance/screenshot-capture/storage";
import { embedReportImageDataUri } from "@/lib/performance/report/report-embed-images";
import { isLikelyLowResolutionSocialThumb } from "@/lib/creators/recent-publication-thumb";
import {
  MIN_DISPLAYABLE_AVATAR_EDGE,
  PITCH_AVATAR_COMPRESS,
  SHOWCASE_AVATAR_COMPRESS,
  compressExportDataUri,
  exportImageBufferMeetsMinEdge,
  toCompressedExportDataUri,
} from "@/lib/io/compress-export-image";
import { quotationCreatorCategoriesMapToMain } from "@/lib/quotations/quotation-creator-categories";
import type { QuotationDetail } from "@/features/quotations/types";
import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";
import type { QuotationDocument } from "./quotation-document";
import type { QuotationExportItem } from "./quotation-export-utils";
import {
  groupQuotationExportItems,
  resolveExportGroupFollowers,
  resolveExportGroupPlatform,
} from "./quotation-export-utils";
import { isCreatorDeckTemplate, isPitchTemplate } from "./quotation-template";

/**
 * Best quotation-preview avatar from already-stored platform sources.
 * Prefers durable Thinkway storage, then a usable HD CDN, then initials (null).
 */
export function pickQuotationExportAvatarUrl(
  ...candidates: Array<string | null | undefined>
): string | null {
  let best: { url: string; score: number } | null = null;

  for (const candidate of candidates) {
    const url = candidate?.trim();
    if (!url) continue;
    if (url.startsWith("data:image/")) {
      return url;
    }
    if (!isDisplayableAvatarUrl(url)) continue;

    let score = 10;
    if (isUsableAvatarUrl(url)) score += 30;
    score += avatarStorageQualityRank(url) * 10;
    if (isDurableStoredAvatarUrl(url)) score += 8;
    if (isLikelyLowResolutionSocialThumb(url)) score -= 25;
    if (isInstagramCdnUrlExpired(url)) score -= 40;

    if (!best || score > best.score) {
      best = { url, score };
    }
  }

  return best?.url ?? null;
}

function quotationItemHasUsableAvatar(item: QuotationItemRow): boolean {
  const avatar =
    item.creator_profile_source?.avatarUrl?.trim() ||
    item.profile_image_url?.trim() ||
    null;
  return Boolean(avatar && isUsableAvatarUrl(avatar));
}

/** True when items have creator_profile_source and a still-usable avatar (or profile fallback). */
export function quotationItemsAvatarEnriched(items: QuotationItemRow[]): boolean {
  return items.every((item) => {
    const hasCreatorRef = Boolean(
      item.influencer_id || item.profile_id || item.unified_id
    );
    if (!hasCreatorRef) return true;
    if (item.creator_profile_source == null) return false;
    if (quotationItemHasUsableAvatar(item)) return true;
    const profileUrl =
      item.creator_profile_source.profile_url?.trim() ||
      item.profile_url?.trim() ||
      null;
    // Profile-only is not enough to skip re-enrichment when a usable primary exists
    // on the linked influencer (expired CDN snapshots should be refreshed).
    return Boolean(profileUrl) && !item.profile_image_url?.trim();
  });
}

/** True when every line has display categories that map to a main category. */
export function quotationItemsCategoriesEnriched(items: QuotationItemRow[]): boolean {
  return items.every((item) => quotationCreatorCategoriesMapToMain(item.creator_categories));
}

/** True when each creator group can resolve platform and followers for tier export. */
export function quotationItemsExportMetricsReady(items: QuotationItemRow[]): boolean {
  const clone = items.map((item) => ({ ...item })) as QuotationExportItem[];
  const groups = groupQuotationExportItems(clone);

  return groups.every((group) => {
    const hasCreatorRef = group.items.some(
      (item) =>
        item.influencer_id ||
        item.profile_id ||
        item.unified_id ||
        item.handle?.trim()
    );
    if (!hasCreatorRef) return true;
    return (
      resolveExportGroupPlatform(group.items) != null &&
      resolveExportGroupFollowers(group.items) != null
    );
  });
}

export function quotationItemsFullyEnrichedForExport(items: QuotationItemRow[]): boolean {
  const viewsReady = items.every((item) => {
    const hasCreatorRef = Boolean(
      item.influencer_id || item.profile_id || item.unified_id || item.handle?.trim()
    );
    if (!hasCreatorRef) return true;
    return (item as QuotationExportItem).avg_views !== undefined;
  });
  return (
    quotationItemsAvatarEnriched(items) &&
    quotationItemsCategoriesEnriched(items) &&
    quotationItemsExportMetricsReady(items) &&
    viewsReady
  );
}

export function resolveQuotationExportSiteOrigin(
  requestHost?: string | null,
  requestProto?: string | null
): string {
  if (requestHost) {
    const proto = requestProto?.replace(/:$/, "") || "http";
    return `${proto}://${requestHost}`;
  }
  const envOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (envOrigin) return envOrigin;
  return "http://localhost:3000";
}

export async function enrichQuotationDetailForExport(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  detail: QuotationDetail
): Promise<QuotationDetail & { items: QuotationExportItem[] }> {
  const { attachExportPlatformAccounts } = await import(
    "./quotation-export-platforms"
  );

  let items: QuotationExportItem[];
  if (quotationItemsFullyEnrichedForExport(detail.items)) {
    items = detail.items as QuotationExportItem[];
  } else {
    items = (await enrichQuotationItemsWithCreatorAvatars(
      supabase,
      detail.items
    )) as QuotationExportItem[];
  }

  // Always attach multi-platform account metrics so mix/roster/creator slides
  // show Instagram + TikTok + … not only the deliverable line platform.
  items = await attachExportPlatformAccounts(supabase, items);

  return { ...detail, items };
}

async function resolveExportAvatarSupabase() {
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    return createSupabaseAdminClient();
  } catch {
    return null;
  }
}

async function embedAvatarDataUri(
  src: string | null,
  profileUrl: string | null,
  compress: boolean,
  compressOptions = SHOWCASE_AVATAR_COMPRESS,
  supabase: Awaited<ReturnType<typeof resolveExportAvatarSupabase>> = null
): Promise<string | null> {
  const trimmedSrc = src?.trim() || null;
  const trimmedProfile = profileUrl?.trim() || null;
  if (!trimmedSrc && !trimmedProfile) return null;
  if (trimmedSrc?.startsWith("data:")) {
    return compress
      ? compressExportDataUri(trimmedSrc, compressOptions)
      : trimmedSrc;
  }

  const result = await fetchCreatorAvatarImage({
    src: trimmedSrc,
    profileUrl: trimmedProfile,
    supabase,
  });

  if (result.ok) {
    const buffer = Buffer.from(result.buffer);
    if (!(await exportImageBufferMeetsMinEdge(buffer, MIN_DISPLAYABLE_AVATAR_EDGE))) {
      return null;
    }
    const contentType = result.contentType || detectImageContentType(buffer);
    if (compress) {
      return toCompressedExportDataUri(buffer, contentType, compressOptions);
    }
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  }

  if (trimmedSrc) {
    const embedded = await embedReportImageDataUri(trimmedSrc);
    if (!embedded?.startsWith("data:")) return null;
    return compress
      ? compressExportDataUri(embedded, compressOptions)
      : embedded;
  }

  return null;
}

/**
 * Embed avatars as data URIs for preview/PDF.
 * Showcase templates strip unresolved http(s) URLs so Puppeteer never waits on
 * social CDN hosts during PDF generation.
 */
export async function embedQuotationDocumentAvatars(
  doc: QuotationDocument
): Promise<QuotationDocument> {
  const compress = isCreatorDeckTemplate(doc.template);
  const compressOptions = isPitchTemplate(doc.template)
    ? PITCH_AVATAR_COMPRESS
    : SHOWCASE_AVATAR_COMPRESS;
  const supabase = await resolveExportAvatarSupabase();
  const creatorGroups = await Promise.all(
    doc.creatorGroups.map(async (group) => {
      const embedded = await embedAvatarDataUri(
        group.avatarUrl,
        group.profileUrl,
        compress,
        compressOptions,
        supabase
      );
      if (embedded?.startsWith("data:")) {
        return {
          ...group,
          avatarUrl: embedded,
          avatarProxyUrl: null,
        };
      }
      // Showcase PDF/preview must not emit hanging CDN <img> tags.
      if (compress) {
        return {
          ...group,
          avatarUrl: null,
          avatarProxyUrl: null,
        };
      }
      return {
        ...group,
        avatarUrl: embedded ?? group.avatarUrl,
        avatarProxyUrl: null,
      };
    })
  );

  const collapseContentGroups = await Promise.all(
    doc.collapseContentGroups.map(async (bundle) => ({
      ...bundle,
      packages: await Promise.all(
        bundle.packages.map(async (pkg) => ({
          ...pkg,
          creators: await Promise.all(
            pkg.creators.map(async (creator) => {
              const embedded = await embedAvatarDataUri(
                creator.avatarUrl,
                creator.profileUrl,
                compress,
                compressOptions,
                supabase
              );
              if (embedded?.startsWith("data:")) {
                return {
                  ...creator,
                  avatarUrl: embedded,
                  avatarProxyUrl: null,
                };
              }
              if (compress) {
                return {
                  ...creator,
                  avatarUrl: null,
                  avatarProxyUrl: null,
                };
              }
              return {
                ...creator,
                avatarUrl: embedded ?? creator.avatarUrl,
                avatarProxyUrl: null,
              };
            })
          ),
        }))
      ),
    }))
  );

  return { ...doc, creatorGroups, collapseContentGroups };
}

export function resolveExportAvatarProxyUrl(
  item: QuotationExportItem,
  profileUrl: string | null,
  avatarUrl?: string | null
): string | null {
  const imageUrl =
    avatarUrl?.trim() ||
    item.creator_profile_source?.avatarUrl?.trim() ||
    item.profile_image_url?.trim() ||
    null;
  return creatorAvatarBrowserDisplayUrl(imageUrl, profileUrl);
}
