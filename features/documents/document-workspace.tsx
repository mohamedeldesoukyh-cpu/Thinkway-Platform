"use client";

import type { ReactNode } from "react";

import { DocumentUploadPanel } from "@/features/documents/document-upload-panel";
import { DocumentLibraryTable } from "@/features/documents/document-table";
import type {
  DocumentWorkspaceConfig,
  DocumentWorkspaceLayout,
  EntityDocumentRow,
} from "@/features/documents/document-types";
import { VendorProfileTabShell } from "@/features/vendors/components/vendor-form-ui";

export type DocumentWorkspaceProps<T extends EntityDocumentRow> = {
  entityId: string;
  documents: T[];
  config: DocumentWorkspaceConfig<T>;
  layout?: DocumentWorkspaceLayout;
  uploadTitle?: string;
  uploadDescription?: string;
  libraryTitle?: string;
  emptyMessage?: string;
  /** Vendor layout wraps content in profile tab shell. */
  vendorTabTitle?: string;
  vendorTabDescription?: string;
  onCancel?: () => void;
  leading?: ReactNode;
};

export function DocumentWorkspace<T extends EntityDocumentRow>({
  entityId,
  documents,
  config,
  layout = "operational",
  uploadTitle,
  uploadDescription,
  libraryTitle,
  emptyMessage,
  vendorTabTitle = "Documents",
  vendorTabDescription,
  onCancel,
  leading,
}: DocumentWorkspaceProps<T>) {
  const content = (
    <div className={layout === "vendor" ? "grid gap-[18px]" : "space-y-4"}>
      {leading}
      <DocumentUploadPanel
        entityId={entityId}
        config={config}
        title={uploadTitle}
        description={uploadDescription}
        layout={layout}
      />
      <DocumentLibraryTable
        entityId={entityId}
        documents={documents}
        config={config}
        libraryTitle={libraryTitle}
        emptyMessage={emptyMessage}
      />
    </div>
  );

  if (layout === "vendor") {
    return (
      <VendorProfileTabShell
        title={vendorTabTitle}
        description={
          vendorTabDescription ??
          "Upload and manage compliance documents for this creator."
        }
        onCancel={onCancel}
      >
        {content}
      </VendorProfileTabShell>
    );
  }

  return content;
}
