"use client";

import { PortalOperationalTableCard } from "@/features/portals/components/portal-operational-table-card";
import {
  buildPortalPublicationsColumns,
  getPortalPublicationsColumnMetas,
} from "@/features/portals/components/tables/portal-publications-columns";
import type { CreatorPublicationRow } from "@/features/portals/types";
import { OPERATIONAL_TABLE_IDS } from "@/lib/tables/operational-table-ids";
import { PORTAL_CREATOR_PUBLICATIONS_FILTER_ACCESSORS } from "@/lib/tables/workspace-table-filter-fields";

const CREATOR_PUBLICATIONS_COLUMNS = buildPortalPublicationsColumns();
const CREATOR_PUBLICATIONS_COLUMN_METAS = getPortalPublicationsColumnMetas();

export function CreatorPublicationsTable({ rows }: { rows: CreatorPublicationRow[] }) {
  return (
    <PortalOperationalTableCard
      title="Publications"
      contextLabel="Creator portal publications"
      tableId={OPERATIONAL_TABLE_IDS.portalCreatorPublications}
      columns={CREATOR_PUBLICATIONS_COLUMNS}
      rows={rows}
      filterAccessors={PORTAL_CREATOR_PUBLICATIONS_FILTER_ACCESSORS}
      rowKey={(row) => row.id}
      emptyMessage="No publications yet."
    />
  );
}
