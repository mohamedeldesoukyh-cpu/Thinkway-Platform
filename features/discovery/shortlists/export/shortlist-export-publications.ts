/**
 * Load and embed creator publication screenshots for Showcase shortlist export.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { sortPlatformsStable } from "@/lib/creators/creator-centric";
import {
  fetchPublicationPreviewImage,
  isAllowedPublicationPreviewSrcUrl,
} from "@/lib/creators/publication-preview-proxy";
import {
  creatorRecentPublicationDisplayUrl,
  isCreatorRecentPublicationVideo,
  normalizeCreatorRecentPublications,
  resolveCreatorRecentPublicationThumbnail,
  shouldProxyPublicationMediaUrl,
} from "@/lib/creators/recent-publication-thumb";
import type { CreatorRecentPublication } from "@/lib/creators/types";
import {
  resolveCreatorFromRefLookup,
  resolveUnifiedCreatorsByRefs,
} from "@/lib/creators/unified-browse";
import { detectImageContentType } from "@/lib/performance/screenshot-capture/storage";
import { toUnprocessedImageDataUri } from "@/lib/performance/report/embed-publication-previews";
import { embedReportImageDataUri } from "@/lib/performance/report/report-embed-images";
import type { Database } from "@/types/database";

import type { ShortlistCreatorItem } from "../types";
import type {
  ShortlistDocPublicationShot,
  ShortlistDocument,
} from "./shortlist-document";
import { shortlistCreatorKey } from "./shortlist-document";
import { isCreatorDeckTemplate } from "./shortlist-template";

export const SHOWCASE_PUBLICATION_SHOT_LIMIT = 6;

function publicationsHaveResolvableShots(publications: CreatorRecentPublication[]): boolean {
  return selectShowcasePublicationShots(publications, 1).length > 0;
}

function pickCreatorPublications(
  creator: NonNullable<ReturnType<typeof resolveCreatorFromRefLookup>>
): CreatorRecentPublication[] {
  const platforms = sortPlatformsStable(creator.platforms);
  const metricsAccount =
    platforms.find((account) => account.id === creator.default_metrics_platform_account_id) ??
    platforms[0] ??
    null;

  const fromMetrics = normalizeCreatorRecentPublications(metricsAccount?.recent_publications);
  if (publicationsHaveResolvableShots(fromMetrics)) return fromMetrics;

  for (const account of platforms) {
    const fromAccount = normalizeCreatorRecentPublications(account.recent_publications);
    if (publicationsHaveResolvableShots(fromAccount)) return fromAccount;
  }

  const fromCreator = normalizeCreatorRecentPublications(creator.recent_publications);
  if (publicationsHaveResolvableShots(fromCreator)) return fromCreator;

  if (fromMetrics.length > 0) return fromMetrics;
  return fromCreator;
}

/** Prefer posts with stored thumbs; also keep postUrl-only rows for OG/oEmbed embed fallback. */
export function selectShowcasePublicationShots(
  publications: CreatorRecentPublication[],
  limit = SHOWCASE_PUBLICATION_SHOT_LIMIT
): ShortlistDocPublicationShot[] {
  const shots: ShortlistDocPublicationShot[] = [];
  const seen = new Set<string>();

  const pushShot = (shot: ShortlistDocPublicationShot) => {
    if (shots.length >= limit) return;
    const dedupeKey = shot.imageUrl || shot.postUrl;
    if (!dedupeKey || seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    shots.push(shot);
  };

  const shotFromPublication = (
    pub: CreatorRecentPublication,
    imageUrl: string
  ): ShortlistDocPublicationShot => ({
    imageUrl,
    postUrl: pub.url?.trim() || null,
    caption: pub.caption?.trim() || null,
    isVideo: isCreatorRecentPublicationVideo(pub),
  });

  for (const pub of publications) {
    if (shots.length >= limit) break;
    const imageUrl = resolveCreatorRecentPublicationThumbnail(pub);
    if (!imageUrl?.startsWith("http") && !imageUrl?.startsWith("data:")) continue;
    pushShot(shotFromPublication(pub, imageUrl));
  }

  if (shots.length < limit) {
    for (const pub of publications) {
      if (shots.length >= limit) break;
      const postUrl = pub.url?.trim() || null;
      if (!postUrl?.startsWith("http")) continue;
      const imageUrl = resolveCreatorRecentPublicationThumbnail(pub);
      if (imageUrl?.startsWith("http") || imageUrl?.startsWith("data:")) continue;
      pushShot(shotFromPublication(pub, ""));
    }
  }

  return shots;
}

export function resolveExportPublicationShotProxyUrl(
  shot: Pick<ShortlistDocPublicationShot, "imageUrl" | "postUrl" | "caption">
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

function publicationShotNeedsProxy(shot: ShortlistDocPublicationShot): boolean {
  const imageUrl = shot.imageUrl.trim();
  if (
    imageUrl &&
    (shouldProxyPublicationMediaUrl(imageUrl) || isAllowedPublicationPreviewSrcUrl(imageUrl))
  ) {
    return true;
  }
  return !imageUrl && Boolean(shot.postUrl?.trim());
}

async function embedPublicationShot(
  shot: ShortlistDocPublicationShot
): Promise<ShortlistDocPublicationShot | null> {
  try {
    const trimmed = shot.imageUrl.trim();
    const postUrl = shot.postUrl?.trim() || null;
    if (trimmed.startsWith("data:")) {
      return {
        ...shot,
        imageUrl: trimmed,
        imageProxyUrl: null,
      };
    }

    const needsProxy = publicationShotNeedsProxy(shot);

    if (needsProxy || postUrl || trimmed) {
      const preview = await fetchPublicationPreviewImage({
        src: trimmed || null,
        postUrl,
      });
      if (preview.ok) {
        const buffer = Buffer.from(preview.buffer);
        const contentType = preview.contentType || detectImageContentType(buffer);
        return {
          ...shot,
          imageUrl: toUnprocessedImageDataUri(buffer, contentType),
          imageProxyUrl: null,
        };
      }
    }

    if (trimmed && !needsProxy) {
      const embedded = await embedReportImageDataUri(trimmed);
      if (embedded?.startsWith("data:")) {
        return {
          ...shot,
          imageUrl: embedded,
          imageProxyUrl: null,
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

export async function loadShortlistCreatorPublicationShots(
  supabase: SupabaseClient<Database>,
  items: ShortlistCreatorItem[],
  limit = SHOWCASE_PUBLICATION_SHOT_LIMIT
): Promise<Map<string, ShortlistDocPublicationShot[]>> {
  const result = new Map<string, ShortlistDocPublicationShot[]>();
  if (items.length === 0) return result;

  const lookup = await resolveUnifiedCreatorsByRefs(supabase, {
    unifiedIds: items.map((item) => item.unified_id),
    influencerIds: items.map((item) => item.influencer_id),
    discoveredProfileIds: items.map((item) => item.profile_id),
  });

  const byCreatorKey = new Map<string, ShortlistCreatorItem>();
  for (const item of items) {
    const key = shortlistCreatorKey(item);
    if (!byCreatorKey.has(key)) byCreatorKey.set(key, item);
  }

  for (const [creatorKey, headerItem] of byCreatorKey) {
    const creator = resolveCreatorFromRefLookup(lookup, headerItem);
    if (!creator) {
      result.set(creatorKey, []);
      continue;
    }
    const publications = pickCreatorPublications(creator);
    result.set(creatorKey, selectShowcasePublicationShots(publications, limit));
  }

  return result;
}

export async function embedShortlistDocumentPublicationShots(
  doc: ShortlistDocument
): Promise<ShortlistDocument> {
  if (!isCreatorDeckTemplate(doc.template) || !doc.creatorGroups?.length) return doc;

  const creatorGroups = await Promise.all(
    doc.creatorGroups.map(async (group) => {
      const shots = group.publicationShots ?? [];
      if (!shots.length) return group;

      const embeddedShots = (
        await Promise.all(shots.map((shot) => embedPublicationShot(shot)))
      ).filter((shot): shot is ShortlistDocPublicationShot => shot != null);

      return { ...group, publicationShots: embeddedShots };
    })
  );

  return { ...doc, creatorGroups };
}
