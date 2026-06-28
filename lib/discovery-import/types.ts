export type ParsedCreatorRow = {
  username: string;
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
  /** Creator role/type from import file (e.g. Macro, Micro, Brand ambassador). */
  role: string | null;
  raw?: Record<string, unknown>;
};

export type ImportParseDiagnostics = {
  extractedTextLength: number | null;
  extractionMethod: "text" | "ocr" | null;
  warning: string | null;
};

export type CreatorImportJobPayload = {
  importFileId: string;
  uploadedBy?: string | null;
};

export type CreatorImportEnrichmentJobPayload = {
  influencerId: string;
  platformAccountId: string;
  platform: string;
  username: string;
  importFileId?: string;
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
  enrichment_queued?: number;
  errors?: Array<{ username?: string; platform?: string; message: string }>;
  entries: ImportProcessingLogEntry[];
};

export type ImportUpsertCounters = {
  total: number;
  imported: number;
  updated: number;
  duplicate: number;
  failed: number;
};

export type ImportUpsertResult = ImportUpsertCounters & {
  enrichmentAccountIds: Array<{
    influencerId: string;
    platformAccountId: string;
    platform: string;
    username: string;
  }>;
};
