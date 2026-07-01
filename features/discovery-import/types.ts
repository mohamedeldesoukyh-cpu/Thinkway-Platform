export const CREATOR_IMPORT_STATUSES = [
  "uploaded",
  "queued",
  "processing",
  "paused",
  "completed",
  "failed",
] as const;

export type CreatorImportStatus = (typeof CREATOR_IMPORT_STATUSES)[number];

export const CREATOR_IMPORT_FILE_EXTENSIONS = [
  ".pdf",
  ".xlsx",
  ".csv",
  ".zip",
] as const;

export type CreatorImportFileExtension =
  (typeof CREATOR_IMPORT_FILE_EXTENSIONS)[number];

export type CreatorImportFileRow = {
  id: string;
  filename: string;
  source_name: string | null;
  file_type: string;
  storage_path: string | null;
  uploaded_by: string | null;
  status: CreatorImportStatus;
  total_creators: number;
  imported_creators: number;
  updated_creators: number;
  duplicate_creators: number;
  failed_creators: number;
  processing_log: Record<string, unknown>;
  metadata: Record<string, unknown>;
  processing_started_at: string | null;
  processing_completed_at: string | null;
  error_message: string | null;
  created_at: string;
};

export type CreatorImportUploadResult = {
  ok: boolean;
  message?: string;
  fileId?: string;
  filename?: string;
};

export type CreatorImportUploadProgressItem = {
  filename: string;
  status: "pending" | "uploading" | "success" | "error";
  message?: string;
};
