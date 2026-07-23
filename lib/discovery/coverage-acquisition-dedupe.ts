/**
 * Coverage acquisition deduplication.
 *
 * Multiple browse/AI requests that need the same missing coverage attach to one
 * in-flight acquisition job instead of creating duplicate Apify runs.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { DiscoveryJobPayload } from "@/lib/discovery/types";

const ACTIVE_COVERAGE_ACQUISITION_STATUSES = ["pending", "running"] as const;

export type CoverageAcquisitionDedupeKeyParts = {
  platform: string;
  method: string;
  country: string;
  categories: string;
  seed: string;
};

/** Normalize tokens used in the coverage acquisition dedupe key. */
export function normalizeCoverageDedupeToken(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 64);
}

export function normalizeCoverageDedupeCategories(
  categories: string[] | null | undefined
): string {
  if (!categories?.length) return "-";
  const normalized = [
    ...new Set(
      categories
        .map((category) => normalizeCoverageDedupeToken(category))
        .filter(Boolean)
    ),
  ].sort();
  return normalized.length > 0 ? normalized.join("+") : "-";
}

/**
 * Stable key for "same missing coverage" acquisition work.
 * Format: acq:{platform}:{country}:{categories}:{method}:{seed}
 */
export function buildCoverageAcquisitionDedupeKey(
  jobPayload: DiscoveryJobPayload
): string {
  const platform = normalizeCoverageDedupeToken(jobPayload.platform ?? "instagram") || "instagram";
  const method = normalizeCoverageDedupeToken(jobPayload.method) || "unknown";
  const country =
    normalizeCoverageDedupeToken(
      jobPayload.coverageIntent?.country ?? jobPayload.locationCountry
    ) || "xx";
  const categories = normalizeCoverageDedupeCategories(
    jobPayload.coverageIntent?.categories
  );
  const seed =
    normalizeCoverageDedupeToken(
      jobPayload.hashtag ?? jobPayload.locationQuery ?? jobPayload.seedUsername
    ) || "noseed";

  return `acq:${platform}:${country}:${categories}:${method}:${seed}`;
}

export type ActiveCoverageAcquisitionJob = {
  id: string;
  status: string;
  payload: Record<string, unknown>;
  coverageDedupeKey: string;
};

function asPayloadRecord(payload: unknown): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

function readSearchSessionIds(payload: Record<string, unknown>): string[] {
  const ids = new Set<string>();
  const primary = typeof payload.searchSessionId === "string" ? payload.searchSessionId.trim() : "";
  if (primary) ids.add(primary);

  const list = payload.searchSessionIds;
  if (Array.isArray(list)) {
    for (const value of list) {
      if (typeof value === "string" && value.trim()) ids.add(value.trim());
    }
  }
  return [...ids];
}

function readSearchIds(payload: Record<string, unknown>): string[] {
  const ids = new Set<string>();
  const primary = typeof payload.searchId === "string" ? payload.searchId.trim() : "";
  if (primary) ids.add(primary);

  const list = payload.searchIds;
  if (Array.isArray(list)) {
    for (const value of list) {
      if (typeof value === "string" && value.trim()) ids.add(value.trim());
    }
  }
  return [...ids];
}

/** Find a pending/running acquisition job for the same coverage key. */
export async function findActiveCoverageAcquisitionJob(
  supabase: SupabaseClient,
  coverageDedupeKey: string
): Promise<ActiveCoverageAcquisitionJob | null> {
  const key = coverageDedupeKey.trim();
  if (!key) return null;

  const { data, error } = await supabase
    .from("discovery_jobs")
    .select("id, status, payload")
    .in("status", [...ACTIVE_COVERAGE_ACQUISITION_STATUSES])
    .filter("payload->>coverageDedupeKey", "eq", key)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data?.id) return null;

  const payload = asPayloadRecord(data.payload);
  return {
    id: String(data.id),
    status: String(data.status ?? ""),
    payload,
    coverageDedupeKey: key,
  };
}

export type AttachCoverageAcquisitionSessionInput = {
  searchSessionId?: string | null;
  searchId?: string | null;
};

export type AttachCoverageAcquisitionSessionResult = {
  attached: boolean;
  jobId: string;
  searchSessionIds: string[];
  searchIds: string[];
  alreadyAttached: boolean;
};

/**
 * Attach an additional search session / search id to an in-flight acquisition job.
 * Does not create a new BullMQ job.
 */
export async function attachSearchSessionToCoverageAcquisitionJob(
  supabase: SupabaseClient,
  jobId: string,
  input: AttachCoverageAcquisitionSessionInput
): Promise<AttachCoverageAcquisitionSessionResult> {
  const trimmedJobId = jobId.trim();
  const { data, error } = await supabase
    .from("discovery_jobs")
    .select("id, status, payload")
    .eq("id", trimmedJobId)
    .in("status", [...ACTIVE_COVERAGE_ACQUISITION_STATUSES])
    .maybeSingle();

  if (error || !data?.id) {
    return {
      attached: false,
      jobId: trimmedJobId,
      searchSessionIds: [],
      searchIds: [],
      alreadyAttached: false,
    };
  }

  const payload = asPayloadRecord(data.payload);
  const searchSessionIds = readSearchSessionIds(payload);
  const searchIds = readSearchIds(payload);

  const sessionId = input.searchSessionId?.trim() || "";
  const searchId = input.searchId?.trim() || "";

  const sessionAlready = sessionId ? searchSessionIds.includes(sessionId) : true;
  const searchAlready = searchId ? searchIds.includes(searchId) : true;
  const alreadyAttached = sessionAlready && searchAlready;

  if (sessionId && !sessionAlready) searchSessionIds.push(sessionId);
  if (searchId && !searchAlready) searchIds.push(searchId);

  const nextPayload = {
    ...payload,
    searchSessionId:
      (typeof payload.searchSessionId === "string" && payload.searchSessionId.trim()) ||
      searchSessionIds[0] ||
      null,
    searchSessionIds,
    searchId:
      (typeof payload.searchId === "string" && payload.searchId.trim()) ||
      searchIds[0] ||
      null,
    searchIds,
  };

  if (!alreadyAttached) {
    const { error: updateError } = await supabase
      .from("discovery_jobs")
      .update({ payload: nextPayload })
      .eq("id", trimmedJobId)
      .in("status", [...ACTIVE_COVERAGE_ACQUISITION_STATUSES]);

    if (updateError) {
      return {
        attached: false,
        jobId: trimmedJobId,
        searchSessionIds,
        searchIds,
        alreadyAttached: false,
      };
    }
  }

  console.log(
    "[coverage-acquisition-dedupe] attached",
    JSON.stringify({
      jobId: trimmedJobId,
      coverageDedupeKey: payload.coverageDedupeKey ?? null,
      searchSessionId: sessionId || null,
      searchId: searchId || null,
      alreadyAttached,
      searchSessionIds,
    })
  );

  return {
    attached: true,
    jobId: trimmedJobId,
    searchSessionIds,
    searchIds,
    alreadyAttached,
  };
}

export function mergeCoverageSessionIds(
  payload: Record<string, unknown> | null | undefined
): string[] {
  return readSearchSessionIds(asPayloadRecord(payload));
}
