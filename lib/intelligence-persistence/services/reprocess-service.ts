/**
 * Reprocessing pipeline — regenerate AI classifications from stored snapshots
 * WITHOUT calling external providers.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  inferCategoriesFromProfileSignals,
  mergeInferredCategories,
} from "@/lib/creator-enrichment/category-inference";

import type { IplReprocessJobType, IplReprocessResult } from "../types";
import { getSnapshotById } from "./snapshot-service";

type AnySupabase = SupabaseClient;

export type EnqueueReprocessInput = {
  snapshotId: string;
  jobType: IplReprocessJobType;
  requestedBy?: string | null;
};

async function createReprocessJob(
  supabase: AnySupabase,
  input: EnqueueReprocessInput & {
    influencerId: string | null;
    platformAccountId: string | null;
    snapshotVersion: number;
  }
): Promise<string | null> {
  const { data, error } = await supabase
    .from("ipl_reprocess_jobs")
    .insert({
      snapshot_id: input.snapshotId,
      influencer_id: input.influencerId,
      platform_account_id: input.platformAccountId,
      job_type: input.jobType,
      status: "queued",
      input_snapshot_version: input.snapshotVersion,
      requested_by: input.requestedBy ?? null,
    } as never)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[ipl] reprocess job insert failed", error.message);
    return null;
  }
  return (data as { id: string } | null)?.id ?? null;
}

async function updateReprocessJob(
  supabase: AnySupabase,
  jobId: string,
  patch: {
    status: "running" | "completed" | "failed" | "skipped";
    outputMetadata?: Record<string, unknown>;
    errorMessage?: string | null;
  }
): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from("ipl_reprocess_jobs")
    .update({
      status: patch.status,
      output_metadata: patch.outputMetadata ?? {},
      error_message: patch.errorMessage ?? null,
      ...(patch.status === "running" ? { started_at: now } : {}),
      ...(patch.status === "completed" || patch.status === "failed" || patch.status === "skipped"
        ? { completed_at: now }
        : {}),
    } as never)
    .eq("id", jobId);
}

function runCategoryInference(
  normalized: import("../types").NormalizedProfileSnapshot
): string[] {
  const inferred = inferCategoriesFromProfileSignals({
    bio: normalized.bio,
    hashtags: normalized.hashtags,
    mentions: normalized.mentions,
    extraTerms: normalized.categories,
  });
  return mergeInferredCategories(normalized.categories, inferred);
}

/**
 * Run reprocessing inline for a snapshot. Does NOT call external providers.
 */
export async function reprocessSnapshot(
  supabase: AnySupabase,
  input: EnqueueReprocessInput
): Promise<IplReprocessResult> {
  const snapshot = await getSnapshotById(supabase, input.snapshotId);
  if (!snapshot) {
    return {
      ok: false,
      jobId: "",
      status: "failed",
      message: "Snapshot not found.",
    };
  }

  const jobId = await createReprocessJob(supabase, {
    ...input,
    influencerId: snapshot.influencerId,
    platformAccountId: snapshot.platformAccountId,
    snapshotVersion: snapshot.snapshotVersion,
  });

  if (!jobId) {
    return {
      ok: false,
      jobId: "",
      status: "failed",
      message: "Could not create reprocess job.",
    };
  }

  await updateReprocessJob(supabase, jobId, { status: "running" });

  try {
    let output: Record<string, unknown> = {};

    switch (input.jobType) {
      case "category_inference": {
        const categories = runCategoryInference(snapshot.normalized);
        output = { categories, source: "ipl_reprocess" };
        await updateReprocessJob(supabase, jobId, {
          status: "completed",
          outputMetadata: output,
        });

        if (snapshot.influencerId) {
          void import("./dna-bridge").then(({ bridgeReprocessToCreatorDna }) =>
            bridgeReprocessToCreatorDna(supabase, {
              snapshotId: snapshot.id,
              influencerId: snapshot.influencerId!,
              categories,
              snapshotVersion: snapshot.snapshotVersion,
              fetchedAt: snapshot.normalized.fetchedAt ?? new Date().toISOString(),
            })
          );
        }

        return {
          ok: true,
          jobId,
          status: "completed",
          categories,
          message: `Reprocessed ${categories.length} categor(ies) from snapshot v${snapshot.snapshotVersion}.`,
        };
      }
      case "brand_fit":
      case "niche_classification":
        await updateReprocessJob(supabase, jobId, {
          status: "skipped",
          outputMetadata: { reason: "Reserved for Sprint 9 Creator DNA." },
        });
        return {
          ok: true,
          jobId,
          status: "skipped",
          message: `${input.jobType} reserved for Sprint 9.`,
        };
      default:
        await updateReprocessJob(supabase, jobId, {
          status: "failed",
          errorMessage: `Unknown job type: ${input.jobType}`,
        });
        return {
          ok: false,
          jobId,
          status: "failed",
          message: `Unknown job type: ${input.jobType}`,
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reprocess failed.";
    await updateReprocessJob(supabase, jobId, {
      status: "failed",
      errorMessage: message,
    });
    return { ok: false, jobId, status: "failed", message };
  }
}

/**
 * Reprocess the latest snapshot for a platform account.
 */
export async function reprocessLatestSnapshotForAccount(
  supabase: AnySupabase,
  input: {
    platformAccountId: string;
    provider?: "apify";
    jobType: IplReprocessJobType;
    requestedBy?: string | null;
  }
): Promise<IplReprocessResult> {
  const { data, error } = await supabase
    .from("ipl_snapshots")
    .select("id")
    .eq("platform_account_id", input.platformAccountId)
    .eq("provider", input.provider ?? "apify")
    .eq("is_latest", true)
    .maybeSingle();

  if (error || !data) {
    return {
      ok: false,
      jobId: "",
      status: "failed",
      message: "No latest snapshot found for platform account.",
    };
  }

  return reprocessSnapshot(supabase, {
    snapshotId: (data as { id: string }).id,
    jobType: input.jobType,
    requestedBy: input.requestedBy,
  });
}
