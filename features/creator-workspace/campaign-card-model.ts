import { formatPortalDate } from "@/features/portals/components/portal-table-utils";
import type { CreatorCampaignRow } from "@/features/portals/types";

export type CreatorCampaignCardModel = {
  assignmentId: string;
  href: string;
  title: string;
  documentNumber: string;
  actionLine: string;
  needsAction: boolean;
  dateLine: string;
  publicationLine: string | null;
};

export function campaignNeedsCreatorAction(row: CreatorCampaignRow): boolean {
  return row.vendor_io_status === "sent" || row.pending_deliverables > 0;
}

export function campaignCreatorActionLine(row: CreatorCampaignRow): string {
  if (row.vendor_io_status === "sent") {
    return "Review your agreement";
  }
  if (row.pending_deliverables === 1) {
    return "1 deliverable needs action";
  }
  if (row.pending_deliverables > 1) {
    return `${row.pending_deliverables} of ${row.deliverable_total} deliverables need action`;
  }
  return "All on track";
}

export function campaignPublicationLine(row: CreatorCampaignRow): string | null {
  if (row.publication_total <= 0) return null;
  if (row.publication_total === 1) {
    return row.recent_publication_status
      ? `1 publication · ${row.recent_publication_status}`
      : "1 publication";
  }
  return row.recent_publication_status
    ? `${row.publication_total} publications · ${row.recent_publication_status}`
    : `${row.publication_total} publications`;
}

export function overlayCreatorCampaignUnitCounts(
  rows: CreatorCampaignRow[],
  units: Array<{ campaignHeaderId: string; status: string }>
): CreatorCampaignRow[] {
  return rows.map((row) => {
    const campaignUnits = units.filter(
      (unit) => unit.campaignHeaderId === row.campaign_header_id
    );
    const pending = campaignUnits.filter(
      (unit) => unit.status === "to_do" || unit.status === "changes_requested"
    ).length;
    return {
      ...row,
      deliverable_total: campaignUnits.length,
      pending_deliverables: pending,
    };
  });
}

export function toCreatorCampaignCard(row: CreatorCampaignRow): CreatorCampaignCardModel {
  return {
    assignmentId: row.assignment_id,
    href: `/creator-portal/campaigns/${row.campaign_header_id}`,
    title: row.campaign_name,
    documentNumber: row.campaign_document_number,
    actionLine: campaignCreatorActionLine(row),
    needsAction: campaignNeedsCreatorAction(row),
    dateLine: `${formatPortalDate(row.start_date)} → ${formatPortalDate(row.end_date)}`,
    publicationLine: campaignPublicationLine(row),
  };
}
