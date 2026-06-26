import { createSupabaseServerClient } from "@/lib/supabase/server";

import type { CreatorImportFileRow } from "./types";

export async function getCreatorImportFiles(
  limit = 50
): Promise<CreatorImportFileRow[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("creator_import_files")
    .select(
      "id, filename, source_name, file_type, storage_path, uploaded_by, status, total_creators, imported_creators, updated_creators, duplicate_creators, failed_creators, processing_log, metadata, processing_started_at, processing_completed_at, error_message, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => ({
    ...row,
    failed_creators: row.failed_creators ?? 0,
  })) as CreatorImportFileRow[];
}
