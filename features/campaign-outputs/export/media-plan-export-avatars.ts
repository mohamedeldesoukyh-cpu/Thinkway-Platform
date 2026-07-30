/**
 * Embed creator avatars as data URIs for Media Plan PDF export.
 * Headless Chromium cannot load social CDN images; preview keeps remote URLs.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchCreatorAvatarImage } from "@/lib/creators/creator-avatar-proxy";
import { parseCreatorAvatarStoragePathFromUrl } from "@/lib/discovery-import/import-avatar-storage";
import {
  compressExportDataUri,
  toCompressedExportDataUri,
  type CompressExportImageOptions,
} from "@/lib/io/compress-export-image";
import { detectImageContentType } from "@/lib/performance/screenshot-capture/storage";
import { embedReportImageDataUri } from "@/lib/performance/report/report-embed-images";
import type { Database } from "@/types/database";

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

export type EmbedMediaPlanAvatarsOptions = {
  /** Prefer service-role / server client so creator-avatars storage resolves. */
  supabase?: SupabaseClient<Database> | null;
};

async function resolveEmbedSupabase(
  provided?: SupabaseClient<Database> | null
): Promise<SupabaseClient<Database> | null> {
  if (provided) return provided;
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    return createSupabaseAdminClient();
  } catch {
    return null;
  }
}

async function embedMediaPlanAvatarDataUri(
  src: string | null | undefined,
  profileUrl: string | null | undefined,
  supabase: SupabaseClient<Database> | null
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
      supabase,
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
      } else if (parseCreatorAvatarStoragePathFromUrl(trimmedSrc)) {
        // Keep durable Thinkway storage URLs — PDF Chromium may still load them.
        embedded = trimmedSrc;
      }
    }
  }

  embedCache.set(cacheKey, embedded);
  return embedded;
}

function resolveEmbeddedAvatarUrl(embedded: string | null): string | undefined {
  if (!embedded) return undefined;
  if (embedded.startsWith("data:")) return embedded;
  if (parseCreatorAvatarStoragePathFromUrl(embedded)) return embedded;
  return undefined;
}

async function embedDayAvatars(
  day: MediaPlanDay,
  supabase: SupabaseClient<Database> | null
): Promise<MediaPlanDay> {
  const avatarUrl = resolveEmbeddedAvatarUrl(
    await embedMediaPlanAvatarDataUri(day.avatarUrl, day.profileUrl, supabase)
  );

  const additionalDeliverables = day.additionalDeliverables?.length
    ? await Promise.all(
        day.additionalDeliverables.map(async (entry) =>
          embedAdditionalDeliverableAvatars(entry, supabase)
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
  entry: MediaPlanAdditionalDeliverable,
  supabase: SupabaseClient<Database> | null
): Promise<MediaPlanAdditionalDeliverable> {
  return {
    ...entry,
    avatarUrl: resolveEmbeddedAvatarUrl(
      await embedMediaPlanAvatarDataUri(entry.avatarUrl, entry.profileUrl, supabase)
    ),
  };
}

async function embedDeadlineAvatars(
  deadline: MediaPlanDeadline,
  supabase: SupabaseClient<Database> | null
): Promise<MediaPlanDeadline> {
  return {
    ...deadline,
    avatarUrl: resolveEmbeddedAvatarUrl(
      await embedMediaPlanAvatarDataUri(deadline.avatarUrl, deadline.profileUrl, supabase)
    ),
  };
}

async function embedMediaPlanDataAvatars(
  data: MediaPlanData,
  supabase: SupabaseClient<Database> | null
): Promise<MediaPlanData> {
  const weeks = await Promise.all(
    data.weeks.map(async (week) => ({
      ...week,
      days: await Promise.all(week.days.map((day) => embedDayAvatars(day, supabase))),
    }))
  );

  const deadlines = data.deadlines.length
    ? await Promise.all(
        data.deadlines.map((deadline) => embedDeadlineAvatars(deadline, supabase))
      )
    : data.deadlines;

  return { ...data, weeks, deadlines };
}

/** Embed avatars as data URIs so Puppeteer PDF export matches in-app preview. */
export async function embedMediaPlanContentAvatars(
  content: CampaignOutputContent,
  options?: EmbedMediaPlanAvatarsOptions
): Promise<CampaignOutputContent> {
  if (!isMediaPlanContent(content)) {
    return content;
  }

  embedCache.clear();
  const supabase = await resolveEmbedSupabase(options?.supabase);
  const data = await embedMediaPlanDataAvatars(content.data, supabase);
  return { ...content, data };
}
