/**
 * Load and embed creator publication screenshots for Showcase quotation export.
 * Uses stored recent_publications JSONB only — no Apify or live scrape enrichment.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import { sortPlatformsStable } from "@/lib/creators/creator-centric";
import {
  fetchPublicationPreviewImage,
  isAllowedPublicationPreviewSrcUrl,
} from "@/lib/creators/publication-preview-proxy";
import {
  creatorRecentPublicationDisplayUrl,
  isCreatorRecentPublicationVideo,
  isLikelyCreatorProfileImageUrl,
  normalizeCreatorRecentPublications,
  resolveCreatorRecentPublicationThumbnail,
  shouldProxyPublicationMediaUrl,
} from "@/lib/creators/recent-publication-thumb";
import type { CreatorRecentPublication } from "@/lib/creators/types";
import {
  resolveCreatorFromRefLookup,
  resolveUnifiedCreatorsByRefs,
} from "@/lib/creators/unified-browse";
import {
  detectImageContentType,
  fetchImageBuffer as fetchDirectImageBuffer,
} from "@/lib/performance/screenshot-capture/storage";
import { normalizeAvatarUrlForComparison } from "@/lib/performance/avatar-sync-policy";
import { embedReportImageDataUri } from "@/lib/performance/report/report-embed-images";
import {
  MIN_DISPLAYABLE_PUBLICATION_EDGE,
  SHOWCASE_PUBLICATION_COMPRESS,
  compressExportDataUri,
  exportImageBufferMeetsMinEdge,
  toCompressedExportDataUri,
} from "@/lib/io/compress-export-image";
import type { QuotationItemRow } from "@/lib/domains/commercial/quotation-detail-types";
import type { Database } from "@/types/database";

import type { QuotationDocument, QuotationDocPublicationShot } from "./quotation-document";
import { quotationCreatorDuplicateKey } from "./quotation-export-utils";
import { isCreatorDeckTemplate } from "./quotation-template";

export const SHOWCASE_PUBLICATION_SHOT_LIMIT = 6;

function publicationsHaveResolvableShots(publications: CreatorRecentPublication[]): boolean {
  return selectShowcasePublicationShots(publications, 1).length > 0;
}

/**
 * Prefer the quotation line platform, then default metrics account, then any
 * platform with resolvable thumbs/post URLs (so a Facebook line does not hide
 * Instagram/TikTok publication screenshots when FB pubs are empty).
 */
function pickPlatformPublications(
  item: QuotationItemRow,
  creator: NonNullable<ReturnType<typeof resolveCreatorFromRefLookup>>
): CreatorRecentPublication[] {
  const linePlatform = item.platform ? canonicalPlatformKey(item.platform) : null;
  const platforms = sortPlatformsStable(creator.platforms);

  const lineAccount =
    linePlatform != null
      ? platforms.find((account) => canonicalPlatformKey(account.platform) === linePlatform)
      : null;

  const fromLine = normalizeCreatorRecentPublications(lineAccount?.recent_publications);
  if (publicationsHaveResolvableShots(fromLine)) return fromLine;

  const metricsAccount =
    platforms.find((account) => account.id === creator.default_metrics_platform_account_id) ??
    platforms[0] ??
    null;
  const fromMetrics = normalizeCreatorRecentPublications(metricsAccount?.recent_publications);
  if (publicationsHaveResolvableShots(fromMetrics)) return fromMetrics;

  for (const account of platforms) {
    if (account.id === lineAccount?.id || account.id === metricsAccount?.id) continue;
    const fromAccount = normalizeCreatorRecentPublications(account.recent_publications);
    if (publicationsHaveResolvableShots(fromAccount)) return fromAccount;
  }

  const fromCreator = normalizeCreatorRecentPublications(creator.recent_publications);
  if (publicationsHaveResolvableShots(fromCreator)) return fromCreator;

  // Prefer non-empty lists even without thumbs (embed may recover via postUrl OG/oEmbed).
  if (fromLine.length > 0) return fromLine;
  if (fromMetrics.length > 0) return fromMetrics;
  return fromCreator;
}

function publicationImageIsCreatorAvatar(
  imageUrl: string,
  creatorAvatarUrl?: string | null
): boolean {
  const avatar = creatorAvatarUrl?.trim();
  if (!imageUrl || !avatar) return false;
  return normalizeAvatarUrlForComparison(imageUrl) === normalizeAvatarUrlForComparison(avatar);
}

function publicationImageUsableAsShot(imageUrl: string, creatorAvatarUrl?: string | null): boolean {
  if (!imageUrl.startsWith("http") && !imageUrl.startsWith("data:")) return false;
  if (isLikelyCreatorProfileImageUrl(imageUrl)) return false;
  if (publicationImageIsCreatorAvatar(imageUrl, creatorAvatarUrl)) return false;
  return true;
}

/** Prefer posts with stored thumbs; also keep postUrl-only rows for OG/oEmbed embed fallback. */
export function selectShowcasePublicationShots(
  publications: CreatorRecentPublication[],
  limit = SHOWCASE_PUBLICATION_SHOT_LIMIT,
  options?: { creatorAvatarUrl?: string | null }
): QuotationDocPublicationShot[] {
  const shots: QuotationDocPublicationShot[] = [];
  const seen = new Set<string>();
  const creatorAvatarUrl = options?.creatorAvatarUrl ?? null;

  const pushShot = (shot: QuotationDocPublicationShot) => {
    if (shots.length >= limit) return;
    const dedupeKey = shot.imageUrl || shot.postUrl;
    if (!dedupeKey || seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    shots.push(shot);
  };

  const shotFromPublication = (
    pub: CreatorRecentPublication,
    imageUrl: string
  ): QuotationDocPublicationShot => ({
    imageUrl,
    postUrl: pub.url?.trim() || null,
    caption: pub.caption?.trim() || null,
    isVideo: isCreatorRecentPublicationVideo(pub),
  });

  // Pass 1: stored media thumbs / covers / screenshots (never profile pics).
  for (const pub of publications) {
    if (shots.length >= limit) break;
    const imageUrl = resolveCreatorRecentPublicationThumbnail(pub);
    if (!imageUrl) continue;
    if (!publicationImageUsableAsShot(imageUrl, creatorAvatarUrl)) continue;
    pushShot(shotFromPublication(pub, imageUrl));
  }

  // Pass 2: post URL only — embed path can resolve via OpenGraph / TikTok oEmbed.
  if (shots.length < limit) {
    for (const pub of publications) {
      if (shots.length >= limit) break;
      const postUrl = pub.url?.trim() || null;
      if (!postUrl?.startsWith("http")) continue;
      const imageUrl = resolveCreatorRecentPublicationThumbnail(pub);
      if (imageUrl && publicationImageUsableAsShot(imageUrl, creatorAvatarUrl)) continue;
      pushShot(shotFromPublication(pub, ""));
    }
  }

  return shots;
}

/** Browser/server proxy path for social CDN thumbs (mirrors discovery gallery). */
export function resolveExportPublicationShotProxyUrl(
  shot: Pick<QuotationDocPublicationShot, "imageUrl" | "postUrl" | "caption">
): string | null {
  const imageUrl = shot.imageUrl.trim();
  const postUrl = shot.postUrl?.trim() || null;
  if (!imageUrl && !postUrl) return null;

  const displayUrl = creatorRecentPublicationDisplayUrl({
    url: postUrl,
    thumbnail: imageUrl || null,
    likes: null,
    comments: null,
    views: null,
    posted_at: null,
    caption: shot.caption,
  });
  if (!displayUrl) return null;
  if (displayUrl.startsWith("/api/")) return displayUrl;
  return null;
}

function publicationShotNeedsProxy(shot: QuotationDocPublicationShot): boolean {
  const imageUrl = shot.imageUrl.trim();
  if (imageUrl && (shouldProxyPublicationMediaUrl(imageUrl) || isAllowedPublicationPreviewSrcUrl(imageUrl))) {
    return true;
  }
  return !imageUrl && Boolean(shot.postUrl?.trim());
}

function publicationShotIsDisplayable(shot: QuotationDocPublicationShot): boolean {
  const imageUrl = shot.imageUrl.trim();
  if (imageUrl.startsWith("data:")) return true;
  if (imageUrl.startsWith("http") && !publicationShotNeedsProxy(shot)) return true;
  return Boolean(shot.imageProxyUrl?.trim());
}

/**
 * Batch-load recent publication screenshots for quotation creators (Showcase only).
 * Returns a map keyed by quotationCreatorDuplicateKey → shots with raw URLs.
 */
export async function loadQuotationCreatorPublicationShots(
  supabase: SupabaseClient<Database>,
  items: QuotationItemRow[],
  limit = SHOWCASE_PUBLICATION_SHOT_LIMIT
): Promise<Map<string, QuotationDocPublicationShot[]>> {
  const result = new Map<string, QuotationDocPublicationShot[]>();
  if (items.length === 0) return result;

  const lookup = await resolveUnifiedCreatorsByRefs(supabase, {
    unifiedIds: items.map((item) => item.unified_id),
    influencerIds: items.map((item) => item.influencer_id),
    discoveredProfileIds: items.map((item) => item.profile_id),
  });

  const byCreatorKey = new Map<string, QuotationItemRow>();
  for (const item of items) {
    const key = quotationCreatorDuplicateKey(item);
    if (!byCreatorKey.has(key)) byCreatorKey.set(key, item);
  }

  for (const [creatorKey, headerItem] of byCreatorKey) {
    const creator = resolveCreatorFromRefLookup(lookup, headerItem);
    if (!creator) {
      result.set(creatorKey, []);
      continue;
    }
    const publications = pickPlatformPublications(headerItem, creator);
    const creatorAvatarUrl =
      headerItem.creator_profile_source?.avatarUrl?.trim() ||
      headerItem.profile_image_url?.trim() ||
      null;
    result.set(
      creatorKey,
      selectShowcasePublicationShots(publications, limit, { creatorAvatarUrl })
    );
  }

  return result;
}

/**
 * Embed a publication shot as a data URI for PDF/preview.
 * Social CDN thumbs often 403 when expired — pass postUrl so the preview proxy
 * can fall back to OpenGraph / oEmbed / Instagram media redirect. Omit shots that
 * cannot be embedded (never emit auth-gated proxy <img> tags in preview/PDF).
 */
async function toPublicationDataUri(
  buffer: Buffer,
  contentType: string
): Promise<string> {
  return toCompressedExportDataUri(
    buffer,
    contentType,
    SHOWCASE_PUBLICATION_COMPRESS
  );
}

async function embedFromRawBuffer(
  shot: QuotationDocPublicationShot,
  buffer: Buffer,
  contentType: string
): Promise<QuotationDocPublicationShot | null> {
  if (!(await exportImageBufferMeetsMinEdge(buffer, MIN_DISPLAYABLE_PUBLICATION_EDGE))) {
    return null;
  }
  return {
    ...shot,
    imageUrl: await toPublicationDataUri(buffer, contentType),
    imageProxyUrl: null,
  };
}

async function embedPublicationShot(
  shot: QuotationDocPublicationShot
): Promise<QuotationDocPublicationShot | null> {
  const trimmed = shot.imageUrl.trim();
  const postUrl = shot.postUrl?.trim() || null;
  if (trimmed.startsWith("data:")) {
    return {
      ...shot,
      imageUrl: await compressExportDataUri(trimmed, SHOWCASE_PUBLICATION_COMPRESS),
      imageProxyUrl: null,
    };
  }

  const needsProxy = publicationShotNeedsProxy(shot);
  const skipStoredSrc = isLikelyCreatorProfileImageUrl(trimmed);
  const storedDirect = Boolean(trimmed) && !needsProxy && !skipStoredSrc;

  // Thinkway-stored screenshots/media are complete photos. Prefer them over live
  // OG/oEmbed thumbs, which are often tiny or truncated and look posterized.
  if (storedDirect) {
    const buffer = await fetchDirectImageBuffer(trimmed);
    if (buffer) {
      const embedded = await embedFromRawBuffer(
        shot,
        buffer,
        detectImageContentType(buffer)
      );
      if (embedded) return embedded;
    }
  }

  const previewSrc = skipStoredSrc ? null : trimmed || null;
  if (needsProxy || postUrl || previewSrc) {
    const preview = await fetchPublicationPreviewImage({
      src: previewSrc,
      postUrl,
    });
    if (preview.ok) {
      const buffer = Buffer.from(preview.buffer);
      const embedded = await embedFromRawBuffer(
        shot,
        buffer,
        preview.contentType || detectImageContentType(buffer)
      );
      if (embedded) return embedded;
    }
  }

  if (trimmed && !needsProxy && !storedDirect) {
    const embedded = await embedReportImageDataUri(trimmed);
    if (embedded?.startsWith("data:")) {
      return {
        ...shot,
        imageUrl: await compressExportDataUri(embedded, SHOWCASE_PUBLICATION_COMPRESS),
        imageProxyUrl: null,
      };
    }
    // Do not keep http(s) CDN URLs — Puppeteer waitUntil:load hang / PDF timeout.
  }

  // Showcase/PDF preview must ship embedded images — never auth-gated proxy <img> tags.
  return null;
}

/** Embed Showcase publication thumbnails as data URIs for PDF/preview. */
export async function embedQuotationDocumentPublicationShots(
  doc: QuotationDocument
): Promise<QuotationDocument> {
  if (!isCreatorDeckTemplate(doc.template)) return doc;

  const creatorGroups = await Promise.all(
    doc.creatorGroups.map(async (group) => {
      if (!group.publicationShots.length) return group;

      const publicationShots = (
        await Promise.all(group.publicationShots.map((shot) => embedPublicationShot(shot)))
      ).filter(
        (shot): shot is QuotationDocPublicationShot =>
          shot != null && publicationShotIsDisplayable(shot)
      );

      return {
        ...group,
        publicationShots,
      };
    })
  );

  return { ...doc, creatorGroups };
}
