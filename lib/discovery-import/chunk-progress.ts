import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import type { ImportUpsertCounters, ImportUpsertResult } from "./types";

export type ImportChunkResult = ImportUpsertCounters;

export type ImportPipelineMetadata = {
  prepared_at?: string;
  finalized_at?: string;
  total_chunks?: number;
  source_storage_path?: string;
  chunk_results?: Record<string, ImportChunkResult>;
  paused_at?: string;
  paused_from_status?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readImportMetadata(
  metadata: Database["public"]["Tables"]["creator_import_files"]["Row"]["metadata"]
): Record<string, unknown> {
  if (!isRecord(metadata)) return {};
  return { ...metadata };
}

export function readImportPipelineMetadata(
  metadata: Database["public"]["Tables"]["creator_import_files"]["Row"]["metadata"]
): ImportPipelineMetadata {
  const root = readImportMetadata(metadata);
  const pipeline = root.import_pipeline;
  if (!isRecord(pipeline)) return {};
  return pipeline as ImportPipelineMetadata;
}

export function mergeImportPipelineMetadata(
  metadata: Database["public"]["Tables"]["creator_import_files"]["Row"]["metadata"],
  patch: ImportPipelineMetadata
): Record<string, unknown> {
  const root = readImportMetadata(metadata);
  const current = readImportPipelineMetadata(metadata);
  return {
    ...root,
    import_pipeline: {
      ...current,
      ...patch,
      chunk_results: {
        ...(current.chunk_results ?? {}),
        ...(patch.chunk_results ?? {}),
      },
    },
  };
}

export function isChunkCompleted(
  pipeline: ImportPipelineMetadata,
  chunkIndex: number
): boolean {
  return Boolean(pipeline.chunk_results?.[String(chunkIndex)]);
}

export function aggregateChunkCounters(
  pipeline: ImportPipelineMetadata
): ImportUpsertCounters {
  const results = Object.values(pipeline.chunk_results ?? {});
  return results.reduce<ImportUpsertCounters>(
    (totals, chunk) => ({
      total: totals.total + chunk.total,
      imported: totals.imported + chunk.imported,
      updated: totals.updated + chunk.updated,
      skipped: totals.skipped + (chunk.skipped ?? 0),
      duplicate: totals.duplicate + chunk.duplicate,
      failed: totals.failed + chunk.failed,
      platform_accounts_created:
        totals.platform_accounts_created + (chunk.platform_accounts_created ?? 0),
      platform_accounts_updated:
        totals.platform_accounts_updated + (chunk.platform_accounts_updated ?? 0),
      followers_updated: totals.followers_updated + (chunk.followers_updated ?? 0),
      categories_updated: totals.categories_updated + (chunk.categories_updated ?? 0),
      audience_interests_updated:
        totals.audience_interests_updated + (chunk.audience_interests_updated ?? 0),
      avatars_imported: totals.avatars_imported + (chunk.avatars_imported ?? 0),
      missing_avatars: totals.missing_avatars + (chunk.missing_avatars ?? 0),
    }),
    {
      total: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      duplicate: 0,
      failed: 0,
      platform_accounts_created: 0,
      platform_accounts_updated: 0,
      followers_updated: 0,
      categories_updated: 0,
      audience_interests_updated: 0,
      avatars_imported: 0,
      missing_avatars: 0,
    }
  );
}

export function chunkProgressPercent(
  pipeline: ImportPipelineMetadata
): number {
  const totalChunks = pipeline.total_chunks ?? 0;
  if (totalChunks <= 0) return 0;
  const completed = Object.keys(pipeline.chunk_results ?? {}).length;
  return Math.min(100, Math.round((completed / totalChunks) * 100));
}

export async function recordChunkProgress(
  supabase: SupabaseClient<Database>,
  input: {
    importFileId: string;
    chunkIndex: number;
    result: ImportUpsertResult;
  }
): Promise<{ alreadyCompleted: boolean; pipeline: ImportPipelineMetadata }> {
  const { data: importFile, error: loadError } = await supabase
    .from("creator_import_files")
    .select("metadata")
    .eq("id", input.importFileId)
    .single();

  if (loadError || !importFile) {
    throw new Error(loadError?.message ?? "Import file not found.");
  }

  const pipeline = readImportPipelineMetadata(importFile.metadata);
  if (isChunkCompleted(pipeline, input.chunkIndex)) {
    return { alreadyCompleted: true, pipeline };
  }

  const chunkResult: ImportChunkResult = { ...input.result };

  const nextMetadata = mergeImportPipelineMetadata(importFile.metadata, {
    chunk_results: {
      [String(input.chunkIndex)]: chunkResult,
    },
  });
  const nextPipeline = nextMetadata.import_pipeline as ImportPipelineMetadata;
  const counters = aggregateChunkCounters(nextPipeline);

  const { error: updateError } = await supabase
    .from("creator_import_files")
    .update({
      metadata: nextMetadata,
      total_creators: counters.total,
      imported_creators: counters.imported,
      updated_creators: counters.updated,
      duplicate_creators: counters.duplicate,
      failed_creators: counters.failed,
    })
    .eq("id", input.importFileId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return { alreadyCompleted: false, pipeline: nextPipeline };
}
