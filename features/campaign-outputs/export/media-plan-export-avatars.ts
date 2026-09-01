/**
 * Embed creator avatars as data URIs for Media Plan PDF export.
 * Headless Chromium cannot load social CDN images; preview keeps remote URLs.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchCreatorAvatarImage } from "@/lib/creators/creator-avatar-proxy";
import { parseCreatorAvatarStoragePathFromUrl } from "@/lib/discovery-import/import-avatar-storage";
import { detectImageContentType } from "@/lib/performance/screenshot-capture/storage";
import { toUnprocessedImageDataUri } from "@/lib/performance/report/embed-publication-previews";
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

const embedCache = new Map<string, string | null>();

export type EmbedMediaPlanAvatarsOptions = {
  /** Server or service-role client — used to resolve durable primary avatars. */
  supabase?: SupabaseClient<Database> | null;
};

type CreatorAvatarFallback = {
  avatarUrl?: string;
  profileUrl?: string;
};

async function resolveEmbedSupabase(
  provided?: SupabaseClient<Database> | null
): Promise<SupabaseClient<Database> | null> {
  // Prefer service-role: creator-avatars storage.download is service_role-only.
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    return createSupabaseAdminClient();
  } catch {
    return provided ?? null;
  }
}

async function loadCreatorAvatarFallbacks(
  supabase: SupabaseClient<Database>,
  creatorIds: string[]
): Promise<Map<string, CreatorAvatarFallback>> {
  const unique = [...new Set(creatorIds.map((id) => id.trim()).filter(Boolean))];
  const map = new Map<string, CreatorAvatarFallback>();
  if (!unique.length) return map;

  const [{ data: influencers }, { data: accounts }] = await Promise.all([
    supabase.from("influencers").select("id, primary_avatar_url").in("id", unique),
    supabase
      .from("influencer_platform_accounts")
      .select("influencer_id, profile_url, profile_picture_url, is_primary")
      .in("influencer_id", unique),
  ]);

  for (const row of influencers ?? []) {
    const id = String(row.id);
    const primary = row.primary_avatar_url?.trim();
    if (primary) {
      map.set(id, { avatarUrl: primary });
    }
  }

  for (const account of accounts ?? []) {
    const id = String(account.influencer_id);
    const current = map.get(id) ?? {};
    const picture = account.profile_picture_url?.trim();
    const profileUrl = account.profile_url?.trim();
    const preferPicture =
      Boolean(picture) &&
      (!current.avatarUrl ||
        (account.is_primary && !parseCreatorAvatarStoragePathFromUrl(current.avatarUrl)));

    map.set(id, {
      avatarUrl: preferPicture ? picture : current.avatarUrl || picture || undefined,
      profileUrl: account.is_primary
        ? profileUrl || current.profileUrl
        : current.profileUrl || profileUrl,
    });
  }

  return map;
}

function collectCreatorIds(data: MediaPlanData): string[] {
  const ids: string[] = [];
  for (const week of data.weeks) {
    for (const day of week.days) {
      if (day.creatorId) ids.push(day.creatorId);
      for (const extra of day.additionalDeliverables ?? []) {
        if (extra.creatorId) ids.push(extra.creatorId);
      }
    }
  }
  for (const deadline of data.deadlines) {
    if (deadline.creatorId) ids.push(deadline.creatorId);
  }
  return ids;
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
    embedded = trimmedSrc;
  } else {
    const result = await fetchCreatorAvatarImage({
      src: trimmedSrc,
      profileUrl: trimmedProfile,
      supabase,
    });

    if (result.ok) {
      const buffer = Buffer.from(result.buffer);
      const contentType = result.contentType || detectImageContentType(buffer);
      embedded = toUnprocessedImageDataUri(buffer, contentType);
    } else if (trimmedSrc) {
      const fetched = await embedReportImageDataUri(trimmedSrc);
      if (fetched?.startsWith("data:")) {
        embedded = fetched;
      } else if (parseCreatorAvatarStoragePathFromUrl(trimmedSrc)) {
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

function mergeAvatarSources(
  entry: { avatarUrl?: string; profileUrl?: string; creatorId?: string },
  fallbacks: Map<string, CreatorAvatarFallback>
): { avatarUrl?: string; profileUrl?: string } {
  const fallback = entry.creatorId ? fallbacks.get(entry.creatorId) : undefined;
  const stored = entry.avatarUrl?.trim();
  const durable = fallback?.avatarUrl?.trim();
  // Prefer durable Thinkway storage over stale social CDN on the calendar card.
  const avatarUrl =
    (durable && parseCreatorAvatarStoragePathFromUrl(durable) ? durable : undefined) ||
    stored ||
    durable ||
    undefined;
  return {
    avatarUrl,
    profileUrl: entry.profileUrl?.trim() || fallback?.profileUrl || undefined,
  };
}

async function embedDayAvatars(
  day: MediaPlanDay,
  supabase: SupabaseClient<Database> | null,
  fallbacks: Map<string, CreatorAvatarFallback>
): Promise<MediaPlanDay> {
  const sources = mergeAvatarSources(day, fallbacks);
  const avatarUrl = resolveEmbeddedAvatarUrl(
    await embedMediaPlanAvatarDataUri(sources.avatarUrl, sources.profileUrl, supabase)
  );

  const additionalDeliverables = day.additionalDeliverables?.length
    ? await Promise.all(
        day.additionalDeliverables.map(async (entry) =>
          embedAdditionalDeliverableAvatars(entry, supabase, fallbacks)
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
  supabase: SupabaseClient<Database> | null,
  fallbacks: Map<string, CreatorAvatarFallback>
): Promise<MediaPlanAdditionalDeliverable> {
  const sources = mergeAvatarSources(entry, fallbacks);
  return {
    ...entry,
    avatarUrl: resolveEmbeddedAvatarUrl(
      await embedMediaPlanAvatarDataUri(sources.avatarUrl, sources.profileUrl, supabase)
    ),
  };
}

async function embedDeadlineAvatars(
  deadline: MediaPlanDeadline,
  supabase: SupabaseClient<Database> | null,
  fallbacks: Map<string, CreatorAvatarFallback>
): Promise<MediaPlanDeadline> {
  const sources = mergeAvatarSources(deadline, fallbacks);
  return {
    ...deadline,
    avatarUrl: resolveEmbeddedAvatarUrl(
      await embedMediaPlanAvatarDataUri(sources.avatarUrl, sources.profileUrl, supabase)
    ),
  };
}

async function embedMediaPlanDataAvatars(
  data: MediaPlanData,
  supabase: SupabaseClient<Database> | null
): Promise<MediaPlanData> {
  const fallbacks =
    supabase != null
      ? await loadCreatorAvatarFallbacks(supabase, collectCreatorIds(data))
      : new Map<string, CreatorAvatarFallback>();

  const weeks = await Promise.all(
    data.weeks.map(async (week) => ({
      ...week,
      days: await Promise.all(
        week.days.map((day) => embedDayAvatars(day, supabase, fallbacks))
      ),
    }))
  );

  const deadlines = data.deadlines.length
    ? await Promise.all(
        data.deadlines.map((deadline) =>
          embedDeadlineAvatars(deadline, supabase, fallbacks)
        )
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
