"use client";

import { DocumentUploadForm } from "@/components/forms/document-upload-form";
import { OperationalFormSection } from "@/components/workspace/operational-workspace-ui";
import { VendorFormSection } from "@/features/vendors/components/vendor-form-ui";
import { FileStackIcon } from "lucide-react";
import type {
  DocumentUploadPanelProps,
  EntityDocumentUploadResult,
} from "@/features/documents/document-types";
import { mapEntityDocumentUploadFormData } from "@/features/documents/document-utils";

export function DocumentUploadPanel({
  entityId,
  config,
  title = "Upload document",
  description,
  layout = "operational",
}: DocumentUploadPanelProps) {
  const uploadViaApi = config.uploadViaApi
    ? async (id: string, formData: FormData) =>
        config.uploadViaApi!(
          id,
          mapEntityDocumentUploadFormData(config, id, formData)
        )
    : undefined;

  const uploadAction = config.uploadAction
    ? async (prev: EntityDocumentUploadResult, formData: FormData) => {
        const id = String(formData.get("entity_id") ?? "");
        return config.uploadAction!(
          prev,
          mapEntityDocumentUploadFormData(config, id, formData)
        );
      }
    : undefined;

  const form = (
    <DocumentUploadForm
      entityId={entityId}
      documentTypeOptions={config.documentTypeOptions}
      defaultDocumentType={config.defaultDocumentType}
      uploadDocument={uploadViaApi}
      action={uploadAction}
    />
  );

  if (layout === "vendor") {
    return (
      <VendorFormSection
        icon={FileStackIcon}
        title={title}
        description={description}
      >
        {form}
      </VendorFormSection>
    );
  }

  return (
    <OperationalFormSection title={title} description={description}>
      {form}
    </OperationalFormSection>
  );
}
