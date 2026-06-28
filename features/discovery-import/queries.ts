import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  CREATOR_IMPORT_STATUSES,
  type CreatorImportFileRow,
  type CreatorImportStatus,
} from "./types";

type CreatorImportFileQueryRow = {
  id: string;
  filename: string;
  source_name: string | null;
  file_type: string;
  storage_path: string | null;
  uploaded_by: string | null;
  status: string;
  total_creators: number | null;
  imported_creators: number | null;
  updated_creators: number | null;
  duplicate_creators: number | null;
  failed_creators: number | null;
  processing_started_at: string | null;
  processing_completed_at: string | null;
  error_message: string | null;
  created_at: string;
};

function toImportStatus(status: string): CreatorImportStatus {
  return CREATOR_IMPORT_STATUSES.includes(status as CreatorImportStatus)
    ? (status as CreatorImportStatus)
    : "uploaded";
}

function mapCreatorImportFileRow(row: CreatorImportFileQueryRow): CreatorImportFileRow {
  return {
    id: row.id,
    filename: row.filename,
    source_name: row.source_name ?? null,
    file_type: row.file_type,
    storage_path: row.storage_path ?? null,
    uploaded_by: row.uploaded_by ?? null,
    status: toImportStatus(row.status),
    total_creators: row.total_creators ?? 0,
    imported_creators: row.imported_creators ?? 0,
    updated_creators: row.updated_creators ?? 0,
    duplicate_creators: row.duplicate_creators ?? 0,
    failed_creators: row.failed_creators ?? 0,
    processing_log: {},
    metadata: {},
    processing_started_at: row.processing_started_at ?? null,
    processing_completed_at: row.processing_completed_at ?? null,
    error_message: row.error_message ?? null,
    created_at: row.created_at,
  };
}

export async function getCreatorImportFiles(
  limit = 50
): Promise<CreatorImportFileRow[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("creator_import_files")
    .select(
      "id, filename, source_name, file_type, storage_path, uploaded_by, status, total_creators, imported_creators, updated_creators, duplicate_creators, failed_creators, processing_started_at, processing_completed_at, error_message, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) =>
    mapCreatorImportFileRow(row as CreatorImportFileQueryRow)
  );
}
