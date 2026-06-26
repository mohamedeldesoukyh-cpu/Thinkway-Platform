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

export type EntityDocumentUploadResult = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export type PersistClientDocumentUploadResult =
  | { ok: true; message: string }
  | {
      ok: false;
      message: string;
      fieldErrors?: Record<string, string[]>;
    };

/** @deprecated Use EntityDocumentUploadResult */
export type DocumentUploadFormState = EntityDocumentUploadResult;

/** @deprecated Use EntityDocumentUploadResult */
export type ClientDocumentUploadApiResult = EntityDocumentUploadResult;
