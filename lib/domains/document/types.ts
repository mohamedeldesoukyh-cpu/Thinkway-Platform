/** Shared document upload / storage domain types. */

export type GroupDocumentType =
  | "nda"
  | "agreement"
  | "tax_document"
  | "group_contract";

export type DocumentBucket =
  | "client-documents"
  | "influencer-documents"
  | "group-documents";

export type ClientDocumentUploadPayload = {
  id: string;
  client_id: string;
  document_type: import("@/types/database").ClientDocumentType;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  expires_at: string | null;
  notes: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PersistClientDocumentUploadResult =
  | { ok: true; message: string; document: ClientDocumentUploadPayload }
  | {
      ok: false;
      message: string;
      fieldErrors?: Record<string, string[]>;
    };

export type EntityDocumentUploadResult =
  | {
      ok: true;
      message?: string;
      document?: ClientDocumentUploadPayload;
      fieldErrors?: Record<string, string[]>;
    }
  | {
      ok: false;
      message?: string;
      fieldErrors?: Record<string, string[]>;
    };

/** @deprecated Use EntityDocumentUploadResult */
export type DocumentUploadFormState = EntityDocumentUploadResult;

/** @deprecated Use EntityDocumentUploadResult */
export type ClientDocumentUploadApiResult = EntityDocumentUploadResult;
