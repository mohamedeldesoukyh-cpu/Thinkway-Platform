"use client";

import { useMemo } from "react";

import {
  deleteClientDocumentAction,
  getClientDocumentDownloadUrlAction,
} from "@/features/clients/actions";
import { uploadClientDocumentViaApi } from "@/features/clients/client-document-upload-api";
import {
  CLIENT_DOCUMENT_TYPE_OPTIONS,
  labelForOption,
} from "@/features/clients/constants";
import { DocumentWorkspace } from "@/features/documents";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { CLIENT_DOCUMENTS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";
import type { ClientDetail } from "@/types/database";
import type { DocumentFilterAccessors } from "@/features/documents/document-types";

export function ClientDocumentsTab({ client }: { client: ClientDetail }) {
  const config = useMemo(
    () => ({
      entityKind: "client" as const,
      tableId: OPERATIONAL_TABLE_IDS.clientDocuments,
      contextLabel: "Client documents",
      documentTypeOptions: CLIENT_DOCUMENT_TYPE_OPTIONS,
      filterAccessors:
        CLIENT_DOCUMENTS_FILTER_ACCESSORS as DocumentFilterAccessors<
          ClientDetail["documents"][number]
        >,
      entityIdField: "client_id",
      getDownloadUrl: getClientDocumentDownloadUrlAction,
      deleteAction: deleteClientDocumentAction,
      uploadViaApi: uploadClientDocumentViaApi,
      resolveTypeLabel: (documentType: string) =>
        labelForOption(CLIENT_DOCUMENT_TYPE_OPTIONS, documentType),
    }),
    []
  );

  return (
    <DocumentWorkspace
      entityId={client.id}
      documents={client.documents}
      config={config}
    />
  );
}
