import type { CampaignDocumentRow } from "@/types/database";

export const CAMPAIGN_CLIENT_BO_TYPE = "client_bo" as const;

export function isMissingCampaignDocumentsRelation(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("campaign_documents") &&
    (normalized.includes("does not exist") ||
      normalized.includes("schema cache") ||
      normalized.includes("could not find"))
  );
}

export function isMissingCampaignDocumentsBucket(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("campaign-documents") &&
    (normalized.includes("bucket not found") ||
      normalized.includes("not found") ||
      normalized.includes("does not exist"))
  );
}

export function friendlyCampaignDocumentError(message: string): string {
  if (isMissingCampaignDocumentsRelation(message)) {
    return "Document storage is not configured yet. Ask an admin to apply the campaign_documents migration.";
  }
  if (isMissingCampaignDocumentsBucket(message)) {
    return "Document file storage is not configured yet. Ask an admin to create the campaign-documents bucket.";
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

export function serializeCampaignDocumentRow(
  row: Record<string, unknown>
): CampaignDocumentRow {
  return {
    id: String(row.id),
    campaign_header_id: String(row.campaign_header_id),
    document_type: String(row.document_type) as CampaignDocumentRow["document_type"],
    file_name: String(row.file_name),
    storage_path: String(row.storage_path),
    mime_type: row.mime_type == null ? null : String(row.mime_type),
    file_size: normalizeFileSize(row.file_size),
    notes: row.notes == null ? null : String(row.notes),
    uploaded_by: row.uploaded_by == null ? null : String(row.uploaded_by),
    created_at: normalizeTimestamp(row.created_at),
    updated_at: normalizeTimestamp(row.updated_at),
  };
}

export type JsonSafeCampaignDocumentActionState = {
  ok: boolean;
  message?: string;
};

export function toJsonSafeCampaignDocumentActionState(
  state: JsonSafeCampaignDocumentActionState
): JsonSafeCampaignDocumentActionState {
  const safe: JsonSafeCampaignDocumentActionState = { ok: state.ok };
  if (state.message) {
    safe.message = state.message;
  }
  return JSON.parse(JSON.stringify(safe)) as JsonSafeCampaignDocumentActionState;
}
