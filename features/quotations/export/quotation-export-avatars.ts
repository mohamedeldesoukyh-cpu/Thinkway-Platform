/**
 * Enrich quotation items with creator avatars for preview/PDF export only.
 */
import { enrichQuotationItemsWithCreatorAvatars } from "@/lib/services/quotations/enrich-quotation-item-avatars";
import { creatorAvatarBrowserDisplayUrl } from "@/lib/performance/creator-avatar";
import { fetchCreatorAvatarImage } from "@/lib/creators/creator-avatar-proxy";
import { isUsableAvatarUrl } from "@/lib/performance/avatar-sync-policy";
import { detectImageContentType } from "@/lib/performance/screenshot-capture/storage";
import { embedReportImageDataUri } from "@/lib/performance/report/report-embed-images";
import {
  SHOWCASE_AVATAR_COMPRESS,
  compressExportDataUri,
  toCompressedExportDataUri,
} from "@/lib/io/compress-export-image";
import type { QuotationDetail } from "@/features/quotations/types";
import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";
import type { QuotationDocument } from "./quotation-document";
import type { QuotationExportItem } from "./quotation-export-utils";
import { isShowcaseTemplate } from "./quotation-template";

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
    if (!Array.isArray(item.creator_categories)) return false;
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
  if (quotationItemsAvatarEnriched(detail.items)) {
    return { ...detail, items: detail.items as QuotationExportItem[] };
  }

  const items = (await enrichQuotationItemsWithCreatorAvatars(
    supabase,
    detail.items
  )) as QuotationExportItem[];

  return { ...detail, items };
}

async function embedAvatarDataUri(
  src: string | null,
  profileUrl: string | null,
  compress: boolean
): Promise<string | null> {
  const trimmedSrc = src?.trim() || null;
  const trimmedProfile = profileUrl?.trim() || null;
  if (!trimmedSrc && !trimmedProfile) return null;
  if (trimmedSrc?.startsWith("data:")) {
    return compress
      ? compressExportDataUri(trimmedSrc, SHOWCASE_AVATAR_COMPRESS)
      : trimmedSrc;
  }

  const result = await fetchCreatorAvatarImage({
    src: trimmedSrc,
    profileUrl: trimmedProfile,
  });

  if (result.ok) {
    const buffer = Buffer.from(result.buffer);
    const contentType = result.contentType || detectImageContentType(buffer);
    if (compress) {
      return toCompressedExportDataUri(buffer, contentType, SHOWCASE_AVATAR_COMPRESS);
    }
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  }

  if (trimmedSrc) {
    const embedded = await embedReportImageDataUri(trimmedSrc);
    if (!embedded?.startsWith("data:")) return null;
    return compress
      ? compressExportDataUri(embedded, SHOWCASE_AVATAR_COMPRESS)
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
  const compress = isShowcaseTemplate(doc.template);
  const creatorGroups = await Promise.all(
    doc.creatorGroups.map(async (group) => {
      const embedded = await embedAvatarDataUri(
        group.avatarUrl,
        group.profileUrl,
        compress
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

  return { ...doc, creatorGroups };
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
