import type { EntityDocumentUploadResult } from "@/lib/domains/document/types";
import type { FilterableValue } from "@/lib/tables/operational-table-filter-sort";

export type { EntityDocumentUploadResult } from "@/lib/domains/document/types";

/** Minimal row shape shared by client, vendor, and group document tables. */
export type EntityDocumentRow = {
  id: string;
  document_type: string;
  file_name: string;
  storage_path: string;
  mime_type: string | null;
  file_size?: number | null;
  expires_at: string | null;
  notes?: string | null;
  uploaded_by?: string | null;
  created_at: string;
  updated_at?: string;
};

export type DocumentEntityKind = "client" | "vendor" | "group";

export type DocumentTypeOption = { value: string; label: string };

export type DocumentDownloadResult = { url?: string; error?: string };

export type DocumentDeleteAction = (
  prevState: EntityDocumentUploadResult,
  formData: FormData
) => Promise<EntityDocumentUploadResult>;

export type DocumentUploadAction = (
  prevState: EntityDocumentUploadResult,
  formData: FormData
) => Promise<EntityDocumentUploadResult>;

export type DocumentUploadViaApi = (
  entityId: string,
  formData: FormData
) => Promise<EntityDocumentUploadResult>;

export type DocumentFilterAccessors<T extends EntityDocumentRow = EntityDocumentRow> =
  Partial<Record<string, (row: T) => FilterableValue>>;

export type DocumentWorkspaceConfig<T extends EntityDocumentRow = EntityDocumentRow> = {
  entityKind: DocumentEntityKind;
  tableId: string;
  contextLabel: string;
  documentTypeOptions: readonly DocumentTypeOption[];
  filterAccessors: DocumentFilterAccessors<T>;
  /** Hidden form field name for the parent entity id (client_id, influencer_id, group_id). */
  entityIdField: string;
  /** Hidden form field name for document id on delete. */
  documentIdField?: string;
  getDownloadUrl: (
    documentId: string,
    entityId: string
  ) => Promise<DocumentDownloadResult>;
  deleteAction: DocumentDeleteAction;
  /** Prefer uploadViaApi for large files (client path). */
  uploadViaApi?: DocumentUploadViaApi;
  uploadAction?: DocumentUploadAction;
  defaultDocumentType?: string;
  resolveTypeLabel?: (documentType: string) => string;
};

export type DocumentWorkspaceLayout = "operational" | "vendor";

export type DocumentUploadPanelProps = {
  entityId: string;
  config: Pick<
    DocumentWorkspaceConfig,
    | "entityKind"
    | "entityIdField"
    | "documentTypeOptions"
    | "uploadViaApi"
    | "uploadAction"
    | "defaultDocumentType"
  >;
  title?: string;
  description?: string;
  layout?: DocumentWorkspaceLayout;
};

export type DocumentTableProps<T extends EntityDocumentRow> = {
  entityId: string;
  documents: T[];
  config: DocumentWorkspaceConfig<T>;
  emptyMessage?: string;
  libraryTitle?: string;
};

export type DocumentActionsProps = {
  entityId: string;
  document: EntityDocumentRow;
  config: Pick<
    DocumentWorkspaceConfig,
    "entityIdField" | "documentIdField" | "getDownloadUrl" | "deleteAction"
  >;
};

export type DocumentPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  mimeType: string | null;
  previewUrl: string | null;
  isLoading?: boolean;
};
