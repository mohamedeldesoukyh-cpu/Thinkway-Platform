import type { ClientDocumentRow } from "@/types/database";

export function isMissingClientDocumentsRelation(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("client_documents") &&
    (normalized.includes("does not exist") ||
      normalized.includes("schema cache") ||
      normalized.includes("could not find"))
  );
}

export function isMissingClientDocumentsBucket(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("client-documents") &&
    (normalized.includes("bucket not found") ||
      normalized.includes("not found") ||
      normalized.includes("does not exist"))
  );
}

export function friendlyClientDocumentError(message: string): string {
  if (isMissingClientDocumentsRelation(message)) {
    return "Document storage is not configured yet. Ask an admin to apply the client_documents migration.";
  }
  if (isMissingClientDocumentsBucket(message)) {
    return "Document file storage is not configured yet. Ask an admin to create the client-documents bucket.";
  }
  return message;
}

function normalizeFileSize(value: unknown): number | null {
  if (value == null) {
    return null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeTimestamp(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    return value;
  }
  return String(value ?? "");
}

function normalizeDateField(value: unknown): string | null {
  if (value == null || value === "") {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value);
}

/** Plain JSON-safe shape for Next.js server action responses. */
export function serializeClientDocumentRow(
  row: Record<string, unknown>
): ClientDocumentRow {
  return {
    id: String(row.id),
    client_id: String(row.client_id),
    document_type: String(row.document_type) as ClientDocumentRow["document_type"],
    file_name: String(row.file_name),
    storage_path: String(row.storage_path),
    mime_type: row.mime_type == null ? null : String(row.mime_type),
    file_size: normalizeFileSize(row.file_size),
    expires_at: normalizeDateField(row.expires_at),
    notes: row.notes == null ? null : String(row.notes),
    uploaded_by: row.uploaded_by == null ? null : String(row.uploaded_by),
    created_at: normalizeTimestamp(row.created_at),
    updated_at: normalizeTimestamp(row.updated_at),
  };
}
