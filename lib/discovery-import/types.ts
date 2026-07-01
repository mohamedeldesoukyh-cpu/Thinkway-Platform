export type ParsedCreatorRow = {
  username: string;
  /** Human-readable creator name from import file (e.g. indaHash Display Name). */
  display_name: string | null;
  platform: string;
  followers: number | null;
  engagement_rate: number | null;
  country: string | null;
  source: string | null;
  categories: string[];
  audience_interests: string[];
  relevance_score: number | null;
  /** Raw profile photo URL from import file (CSV/XLSX column), when present. */
  profile_picture_url: string | null;
  /** Avatar origin when profile_picture_url is supplied by the import pipeline. */
  profile_avatar_source?: "manual" | "uploaded" | null;
  /** Creator role/type from import file (e.g. Macro, Micro, Brand ambassador). */
  role: string | null;
  /** indaHash Appearances column — preserved in import metadata when present. */
  appearances?: number | null;
  raw?: Record<string, unknown>;
};

export type ImportExtractionMethod = "text" | "ocr" | null;

export function normalizeExtractionMethod(
  value: string | null | undefined
): ImportExtractionMethod {
  if (value === "text" || value === "ocr") return value;
  return null;
}

export type ImportParseDiagnostics = {
  extractedTextLength: number | null;
  extractionMethod: ImportExtractionMethod;
  warning: string | null;
};

export type CreatorImportJobPayload = {
  importFileId: string;
  uploadedBy?: string | null;
};

export type CreatorImportFinalizeJobPayload = {
  importFileId: string;
  totalChunks: number;
  parser: string;
  extractedTextLength: number | null;
  extractionMethod: "text" | "ocr" | null;
  warning: string | null;
};

export type CreatorImportChunkJobPayload = {
  importFileId: string;
  chunkIndex: number;
  totalChunks: number;
  fileType: string;
  sourceName: string | null;
  uploadedBy: string | null;
  sourceStoragePath: string;
};

export type ImportProcessingLogEntry = {
  at: string;
  level: "info" | "warn" | "error";
  message: string;
};

export type ImportProcessingLog = {
  parser?: string;
  file_type?: string;
  duration_ms?: number;
  finalize_skipped?: boolean;
  finalize_skip_reason?: string;
  summary?: ImportUpsertCounters & {
    errors?: number;
    queue_status?: string;
  };
  errors?: Array<{ username?: string; platform?: string; message: string }>;
  entries: ImportProcessingLogEntry[];
};

export type ImportUpsertCounters = {
  total: number;
  imported: number;
  updated: number;
  skipped: number;
  duplicate: number;
  failed: number;
  platform_accounts_created: number;
  platform_accounts_updated: number;
  followers_updated: number;
  categories_updated: number;
  audience_interests_updated: number;
  avatars_imported: number;
  missing_avatars: number;
};

export type ImportUpsertResult = ImportUpsertCounters;
