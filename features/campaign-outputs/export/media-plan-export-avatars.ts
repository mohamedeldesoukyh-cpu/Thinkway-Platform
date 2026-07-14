/**
 * Embed creator avatars as data URIs for Media Plan PDF export.
 * Headless Chromium cannot load social CDN images; preview keeps remote URLs.
 */
import { fetchCreatorAvatarImage } from "@/lib/creators/creator-avatar-proxy";
import {
  compressExportDataUri,
  toCompressedExportDataUri,
  type CompressExportImageOptions,
} from "@/lib/io/compress-export-image";
import { detectImageContentType } from "@/lib/performance/screenshot-capture/storage";
import { embedReportImageDataUri } from "@/lib/performance/report/report-embed-images";

import type {
  MediaPlanAdditionalDeliverable,
  MediaPlanData,
  MediaPlanDay,
  MediaPlanDeadline,
} from "../generators/media-plan";
import type { CampaignOutputContent } from "../output-types";
import { isMediaPlanContent } from "./media-plan-content";

const MEDIA_PLAN_AVATAR_COMPRESS: CompressExportImageOptions = {
  maxEdge: 64,
  quality: 75,
};

const embedCache = new Map<string, string | null>();

async function embedMediaPlanAvatarDataUri(
  src: string | null | undefined,
  profileUrl: string | null | undefined
): Promise<string | null> {
  const trimmedSrc = src?.trim() || null;
  const trimmedProfile = profileUrl?.trim() || null;
  if (!trimmedSrc && !trimmedProfile) return null;

  const cacheKey = `${trimmedSrc ?? ""}|${trimmedProfile ?? ""}`;
  const cached = embedCache.get(cacheKey);
  if (cached !== undefined) return cached;

  let embedded: string | null = null;

  if (trimmedSrc?.startsWith("data:")) {
    embedded = await compressExportDataUri(trimmedSrc, MEDIA_PLAN_AVATAR_COMPRESS);
  } else {
    const result = await fetchCreatorAvatarImage({
      src: trimmedSrc,
      profileUrl: trimmedProfile,
    });

    if (result.ok) {
      const buffer = Buffer.from(result.buffer);
      const contentType = result.contentType || detectImageContentType(buffer);
      embedded = await toCompressedExportDataUri(
        buffer,
        contentType,
        MEDIA_PLAN_AVATAR_COMPRESS
      );
    } else if (trimmedSrc) {
      const fetched = await embedReportImageDataUri(trimmedSrc);
      if (fetched?.startsWith("data:")) {
        embedded = await compressExportDataUri(fetched, MEDIA_PLAN_AVATAR_COMPRESS);
      }
    }
  }

  embedCache.set(cacheKey, embedded);
  return embedded;
}

function resolveEmbeddedAvatarUrl(embedded: string | null): string | undefined {
  return embedded?.startsWith("data:") ? embedded : undefined;
}

async function embedDayAvatars(day: MediaPlanDay): Promise<MediaPlanDay> {
  const avatarUrl = resolveEmbeddedAvatarUrl(
    await embedMediaPlanAvatarDataUri(day.avatarUrl, day.profileUrl)
  );

  const additionalDeliverables = day.additionalDeliverables?.length
    ? await Promise.all(
        day.additionalDeliverables.map(async (entry) =>
          embedAdditionalDeliverableAvatars(entry)
        )
      )
    : day.additionalDeliverables;

  return {
    ...day,
    avatarUrl,
    additionalDeliverables,
  };
}

async function embedAdditionalDeliverableAvatars(
  entry: MediaPlanAdditionalDeliverable
): Promise<MediaPlanAdditionalDeliverable> {
  return {
    ...entry,
    avatarUrl: resolveEmbeddedAvatarUrl(
      await embedMediaPlanAvatarDataUri(entry.avatarUrl, entry.profileUrl)
    ),
  };
}

async function embedDeadlineAvatars(deadline: MediaPlanDeadline): Promise<MediaPlanDeadline> {
  return {
    ...deadline,
    avatarUrl: resolveEmbeddedAvatarUrl(
      await embedMediaPlanAvatarDataUri(deadline.avatarUrl, deadline.profileUrl)
    ),
  };
}

async function embedMediaPlanDataAvatars(data: MediaPlanData): Promise<MediaPlanData> {
  const weeks = await Promise.all(
    data.weeks.map(async (week) => ({
      ...week,
      days: await Promise.all(week.days.map((day) => embedDayAvatars(day))),
    }))
  );

  const deadlines = data.deadlines.length
    ? await Promise.all(data.deadlines.map((deadline) => embedDeadlineAvatars(deadline)))
    : data.deadlines;

  return { ...data, weeks, deadlines };
}

/** Embed avatars as data URIs so Puppeteer PDF export matches in-app preview. */
export async function embedMediaPlanContentAvatars(
  content: CampaignOutputContent
): Promise<CampaignOutputContent> {
  if (!isMediaPlanContent(content)) {
    return content;
  }

  embedCache.clear();
  const data = await embedMediaPlanDataAvatars(content.data);
  return { ...content, data };
}
