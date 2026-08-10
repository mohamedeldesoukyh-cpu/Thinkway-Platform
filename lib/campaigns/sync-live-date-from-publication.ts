/**
 * Sync Assignment Live ad date from campaign publications (per platform).
 * Manual overwrites are preserved until the user resets to the publication default.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { canonicalPlatformKey } from "@/lib/campaigns/deliverable-taxonomy";
import type { Database } from "@/types/database";

export type LiveDateSource = "publication" | "manual";

export type LiveDateMetadata = {
  live_date_source?: LiveDateSource;
  publication_live_date?: string | null;
  publication_id?: string | null;
};

export function readLiveDateMetadata(
  metadata: Record<string, unknown> | null | undefined
): LiveDateMetadata {
  if (!metadata || typeof metadata !== "object") return {};
  const source = metadata.live_date_source;
  return {
    live_date_source:
      source === "publication" || source === "manual" ? source : undefined,
    publication_live_date:
      typeof metadata.publication_live_date === "string"
        ? metadata.publication_live_date
        : metadata.publication_live_date === null
          ? null
          : undefined,
    publication_id:
      typeof metadata.publication_id === "string"
        ? metadata.publication_id
        : metadata.publication_id === null
          ? null
          : undefined,
  };
}

export function mergeLiveDateMetadata(
  existing: Record<string, unknown> | null | undefined,
  patch: LiveDateMetadata
): Record<string, unknown> {
  return {
    ...(existing ?? {}),
    ...patch,
  };
}

/** Mark a user-edited live date as a manual overwrite (keeps publication default). */
export function withManualLiveDateSource(
  existing: Record<string, unknown> | null | undefined
): Record<string, unknown> {
  return mergeLiveDateMetadata(existing, { live_date_source: "manual" });
}

function normalizeDateOnly(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export type SyncLiveDateFromPublicationInput = {
  campaignHeaderId: string;
  campaignLineId: string | null | undefined;
  platform: string;
  publicationDate: string | null | undefined;
  publicationId?: string | null;
  /** When true, overwrite even if user set a manual live date. */
  force?: boolean;
};

export type SyncLiveDateFromPublicationResult = {
  updatedDeliverables: number;
  updatedPosts: number;
  skippedManual: number;
};

/**
 * Apply publication_date onto matching assignment deliverables/posts for the line + platform.
 */
export async function syncLiveDateFromPublication(
  supabase: SupabaseClient<Database>,
  input: SyncLiveDateFromPublicationInput
): Promise<SyncLiveDateFromPublicationResult> {
  const liveDate = normalizeDateOnly(input.publicationDate);
  const lineId = input.campaignLineId?.trim() || null;
  const platform = canonicalPlatformKey(input.platform);
  if (!liveDate || !lineId || !platform) {
    return { updatedDeliverables: 0, updatedPosts: 0, skippedManual: 0 };
  }

  const { data: deliverables, error } = await supabase
    .from("assignment_deliverables")
    .select("id, platform, live_date, metadata, locked_at")
    .eq("campaign_line_id", lineId);

  if (error || !deliverables?.length) {
    return { updatedDeliverables: 0, updatedPosts: 0, skippedManual: 0 };
  }

  const matching = deliverables.filter(
    (row) => canonicalPlatformKey(row.platform) === platform
  );

  let updatedDeliverables = 0;
  let updatedPosts = 0;
  let skippedManual = 0;

  for (const deliverable of matching) {
    if (deliverable.locked_at) continue;

    const { data: posts } = await supabase
      .from("assignment_post_schedule")
      .select("id, live_date, metadata, locked_at")
      .eq("assignment_deliverable_id", deliverable.id);

    const deliverableMeta = readLiveDateMetadata(
      (deliverable.metadata as Record<string, unknown> | null) ?? null
    );

    const applyToDeliverable =
      input.force || deliverableMeta.live_date_source !== "manual";

    if (!applyToDeliverable) {
      skippedManual += 1;
      // Keep publication default available for reset without overwriting the manual date.
      const nextMeta = mergeLiveDateMetadata(
        (deliverable.metadata as Record<string, unknown> | null) ?? null,
        {
          publication_live_date: liveDate,
          publication_id: input.publicationId ?? null,
        }
      );
      await supabase
        .from("assignment_deliverables")
        .update({ metadata: nextMeta as never })
        .eq("id", deliverable.id);
    } else {
      const nextMeta = mergeLiveDateMetadata(
        (deliverable.metadata as Record<string, unknown> | null) ?? null,
        {
          live_date_source: "publication",
          publication_live_date: liveDate,
          publication_id: input.publicationId ?? null,
        }
      );
      const { error: deliverableError } = await supabase
        .from("assignment_deliverables")
        .update({
          live_date: liveDate,
          metadata: nextMeta as never,
        })
        .eq("id", deliverable.id);
      if (!deliverableError) updatedDeliverables += 1;
    }

    for (const post of posts ?? []) {
      if (post.locked_at) continue;
      const postRawMeta =
        (post.metadata as Record<string, unknown> | null) ?? null;
      const postPlatform = canonicalPlatformKey(
        typeof postRawMeta?.platform === "string"
          ? postRawMeta.platform
          : deliverable.platform
      );
      if (postPlatform && postPlatform !== platform) continue;

      const postMeta = readLiveDateMetadata(postRawMeta);
      const applyToPost =
        input.force || postMeta.live_date_source !== "manual";

      if (!applyToPost) {
        skippedManual += 1;
        const nextMeta = mergeLiveDateMetadata(postRawMeta, {
          publication_live_date: liveDate,
          publication_id: input.publicationId ?? null,
        });
        await supabase
          .from("assignment_post_schedule")
          .update({ metadata: nextMeta as never })
          .eq("id", post.id);
        continue;
      }

      const nextMeta = mergeLiveDateMetadata(postRawMeta, {
        live_date_source: "publication",
        publication_live_date: liveDate,
        publication_id: input.publicationId ?? null,
      });
      const { error: postError } = await supabase
        .from("assignment_post_schedule")
        .update({
          live_date: liveDate,
          metadata: nextMeta as never,
        })
        .eq("id", post.id);
      if (!postError) updatedPosts += 1;
    }
  }

  return { updatedDeliverables, updatedPosts, skippedManual };
}

/** Latest publication date for a campaign line + platform (YYYY-MM-DD). */
export async function loadLatestPublicationLiveDate(
  supabase: SupabaseClient<Database>,
  input: {
    campaignHeaderId: string;
    campaignLineId: string;
    platform: string;
  }
): Promise<{ publicationDate: string | null; publicationId: string | null }> {
  const platform = canonicalPlatformKey(input.platform);
  const { data } = await supabase
    .from("campaign_publications")
    .select("id, publication_date, platform, created_at")
    .eq("campaign_header_id", input.campaignHeaderId)
    .eq("campaign_line_id", input.campaignLineId)
    .order("publication_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(20);

  const match = (data ?? []).find(
    (row) =>
      canonicalPlatformKey(row.platform) === platform &&
      normalizeDateOnly(row.publication_date as string | null)
  );
  if (!match) return { publicationDate: null, publicationId: null };
  return {
    publicationDate: normalizeDateOnly(match.publication_date as string | null),
    publicationId: (match.id as string) ?? null,
  };
}
