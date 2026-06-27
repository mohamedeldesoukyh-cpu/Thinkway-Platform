"use client";

import { useMemo } from "react";

import {
  OperationalConfigurableTable,
  type OperationalConfigurableColumnDef,
} from "@/components/tables/operational-configurable-table";
import { OperationalTableSuiteProvider } from "@/components/tables/operational-table-suite-provider";
import { OperationalTableControlsSlot } from "@/components/tables/operational-data-table";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { CampaignOperationalSectionHeader } from "@/features/campaigns/components/campaign-operational-section-header";
import { DocumentRowActions } from "@/features/documents/document-actions";
import type {
  DocumentTableProps,
  EntityDocumentRow,
} from "@/features/documents/document-types";
import {
  formatDocumentDate,
  resolveDocumentTypeLabel,
} from "@/features/documents/document-utils";

export function buildDocumentTableColumns<T extends EntityDocumentRow>(
  entityId: string,
  config: DocumentTableProps<T>["config"]
): OperationalConfigurableColumnDef<T>[] {
  const resolveLabel =
    config.resolveTypeLabel ??
    ((documentType: string) =>
      resolveDocumentTypeLabel(documentType, config.documentTypeOptions));

  return [
    {
      id: "type",
      label: "Type",
      renderCell: (doc) => resolveLabel(doc.document_type),
    },
    {
      id: "file",
      label: "File",
      cellClassName: "max-w-[200px] truncate",
      renderCell: (doc) => doc.file_name,
    },
    {
      id: "uploaded",
      label: "Uploaded",
      cellClassName: "text-muted-foreground",
      renderCell: (doc) => formatDocumentDate(doc.created_at),
    },
    {
      id: "expiry",
      label: "Expiry",
      cellClassName: "text-muted-foreground",
      renderCell: (doc) => formatDocumentDate(doc.expires_at),
    },
    {
      id: "actions",
      label: "Actions",
      locked: true,
      headerClassName: "text-right",
      cellClassName: "text-right",
      renderCell: (doc) => (
        <DocumentRowActions entityId={entityId} document={doc} config={config} />
      ),
    },
  ];
}

export function DocumentLibraryTable<T extends EntityDocumentRow>({
  entityId,
  documents,
  config,
  emptyMessage = "No documents uploaded yet.",
  libraryTitle = "Document library",
}: DocumentTableProps<T>) {
  const columns = useMemo(
    () => buildDocumentTableColumns(entityId, config),
    [entityId, config]
  );

  return (
    <OperationalTableSuiteProvider
      tableId={config.tableId}
      columns={columns}
      rows={documents}
      filterAccessors={config.filterAccessors}
    >
      <OperationalTableSection
        wide
        tableOnly
        cardSurface
        leading={
          <CampaignOperationalSectionHeader
            title={libraryTitle}
            actions={
              <OperationalTableControlsSlot contextLabel={config.contextLabel} />
            }
          />
        }
      >
        {documents.length === 0 ? (
          <p className="px-4 py-8 text-[11px] text-muted-foreground">
            {emptyMessage}
          </p>
        ) : (
          <OperationalConfigurableTable
            columns={columns}
            rows={documents}
            rowKey={(doc) => doc.id}
          />
        )}
      </OperationalTableSection>
    </OperationalTableSuiteProvider>
  );
}
