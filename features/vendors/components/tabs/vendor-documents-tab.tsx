"use client";

import { useMemo } from "react";

import { DocumentWorkspace } from "@/features/documents";
import {
  deleteInfluencerDocumentAction,
  getInfluencerDocumentDownloadUrlAction,
  uploadInfluencerDocumentAction,
} from "@/features/vendors/actions";
import {
  INFLUENCER_DOCUMENT_TYPE_OPTIONS,
  labelForOption,
} from "@/features/vendors/constants";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { VENDOR_DOCUMENTS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";
import type { VendorDetail } from "@/types/database";
import type { DocumentFilterAccessors } from "@/features/documents/document-types";

export function VendorDocumentsTab({
  vendor,
  onCancel,
}: {
  vendor: VendorDetail;
  onCancel?: () => void;
}) {
  const config = useMemo(
    () => ({
      entityKind: "vendor" as const,
      tableId: OPERATIONAL_TABLE_IDS.vendorDocuments,
      contextLabel: "Vendor documents",
      documentTypeOptions: INFLUENCER_DOCUMENT_TYPE_OPTIONS,
      filterAccessors:
        VENDOR_DOCUMENTS_FILTER_ACCESSORS as DocumentFilterAccessors<
          VendorDetail["documents"][number]
        >,
      entityIdField: "influencer_id",
      getDownloadUrl: getInfluencerDocumentDownloadUrlAction,
      deleteAction: deleteInfluencerDocumentAction,
      uploadAction: uploadInfluencerDocumentAction,
      resolveTypeLabel: (documentType: string) =>
        labelForOption(INFLUENCER_DOCUMENT_TYPE_OPTIONS, documentType),
    }),
    []
  );

  return (
    <DocumentWorkspace
      entityId={vendor.id}
      documents={vendor.documents}
      config={config}
      layout="vendor"
      uploadDescription="Attach trade licenses, IDs, and other vendor files."
      onCancel={onCancel}
    />
  );
}
