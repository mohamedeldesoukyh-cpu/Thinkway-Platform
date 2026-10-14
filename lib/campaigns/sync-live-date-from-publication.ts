/**
 * Publication writes synchronize the entire creator package through database triggers.
 * Actual publication dates take priority over copied manual dates.
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
  // Publication INSERT/UPDATE atomically reconciles the entire assignment in the database.
  // Retained for callers that also refresh their UI after saving a publication.
  void supabase; void input;
  return { updatedDeliverables: 0, updatedPosts: 0, skippedManual: 0 };
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
