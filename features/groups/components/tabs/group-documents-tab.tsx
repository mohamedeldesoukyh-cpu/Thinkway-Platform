"use client";

import { useMemo } from "react";

import { DocumentWorkspace } from "@/features/documents";
import {
  deleteGroupDocumentAction,
  getGroupDocumentDownloadUrlAction,
  uploadGroupDocumentAction,
} from "@/features/groups/actions";
import {
  GROUP_DOCUMENT_TYPE_OPTIONS,
  type GroupDocumentRow,
  type GroupWorkspace,
} from "@/features/groups/types";
import type { DocumentFilterAccessors } from "@/features/documents/document-types";
import { labelForOption } from "@/features/clients/constants";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { GROUP_DOCUMENTS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";

type GroupDocumentsTabProps = {
  workspace: GroupWorkspace;
};

export function GroupDocumentsTab({ workspace }: GroupDocumentsTabProps) {
  const config = useMemo(
    () => ({
      entityKind: "group" as const,
      tableId: OPERATIONAL_TABLE_IDS.groupDocuments,
      contextLabel: "Group documents",
      documentTypeOptions: GROUP_DOCUMENT_TYPE_OPTIONS,
      filterAccessors:
        GROUP_DOCUMENTS_FILTER_ACCESSORS as DocumentFilterAccessors<GroupDocumentRow>,
      entityIdField: "group_id",
      getDownloadUrl: getGroupDocumentDownloadUrlAction,
      deleteAction: deleteGroupDocumentAction,
      uploadAction: uploadGroupDocumentAction,
      resolveTypeLabel: (documentType: string) =>
        labelForOption(GROUP_DOCUMENT_TYPE_OPTIONS, documentType),
    }),
    []
  );

  return (
    <DocumentWorkspace
      entityId={workspace.id}
      documents={workspace.documents}
      config={config}
      uploadDescription="NDAs, agreements, tax documents, and group-level contracts."
      emptyMessage="No group documents uploaded yet."
    />
  );
}
