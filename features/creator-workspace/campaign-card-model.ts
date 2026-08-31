import { formatPortalDate } from "@/features/portals/components/portal-table-utils";
import type { CreatorCampaignRow } from "@/features/portals/types";
import { creatorCampaignUnitCounts } from "@/features/creator-workspace/campaign-progress";
import { creatorPaymentNextActionLabel } from "@/features/creator-workspace/payment-copy";
import {
  unitNeedsPublicationLink,
  type CreatorUnitStatus,
} from "@/features/creator-workspace/unit-status";

export type CreatorCampaignCardModel = {
  assignmentId: string;
  href: string;
  title: string;
  documentNumber: string;
  campaignStatus: string;
  actionLine: string;
  needsAction: boolean;
  dateLine: string;
  deliverableLine: string;
  approvalLine: string;
  publicationLine: string | null;
  paymentLine: string;
  insightLine: string | null;
};

export function campaignNeedsCreatorAction(row: CreatorCampaignRow): boolean {
  return (
    row.vendor_io_status === "sent" ||
    row.pending_deliverables > 0 ||
    (row.publication_needed ?? 0) > 0
  );
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
  const publicationNeeded = row.publication_needed ?? 0;
  if (publicationNeeded === 1) {
    return "1 publication link required";
  }
  if (publicationNeeded > 1) {
    return `${publicationNeeded} publication links required`;
  }
  return creatorPaymentNextActionLabel(row.vendor_payment_status) ?? "All on track";
}

export function campaignPublicationLine(row: CreatorCampaignRow): string | null {
  if (row.published_deliverables > 0 && row.deliverable_total > 0) {
    return `${row.published_deliverables} of ${row.deliverable_total} published`;
  }
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

export type CreatorCampaignUnitOverlayInput = {
  campaignHeaderId: string;
  status: string;
  expectsPublicationUrl?: boolean;
  publicationUrl?: string | null;
};

export function overlayCreatorCampaignUnitCounts(
  rows: CreatorCampaignRow[],
  units: CreatorCampaignUnitOverlayInput[]
): CreatorCampaignRow[] {
  return rows.map((row) => {
    const campaignUnits = units.filter(
      (unit) => unit.campaignHeaderId === row.campaign_header_id
    );
    if (campaignUnits.length === 0) return { ...row, publication_needed: row.publication_needed ?? 0 };
    const counts = creatorCampaignUnitCounts(
      campaignUnits.map((unit) => ({ status: unit.status as CreatorUnitStatus }))
    );
    return {
      ...row,
      deliverable_total: counts.total,
      pending_deliverables: counts.pending,
      completed_deliverables: counts.completed,
      approved_deliverables: counts.approved,
      published_deliverables: counts.published,
      publication_needed: campaignUnits.filter((unit) =>
        unitNeedsPublicationLink({
          status: unit.status,
          expectsPublicationUrl: unit.expectsPublicationUrl,
          publicationUrl: unit.publicationUrl,
        })
      ).length,
    };
  });
}

export function toCreatorCampaignCard(
  row: CreatorCampaignRow,
  insightLine: string | null = null
): CreatorCampaignCardModel {
  const remaining = Math.max(0, row.deliverable_total - row.completed_deliverables);
  return {
    assignmentId: row.assignment_id,
    href: `/creator-portal/campaigns/${row.campaign_header_id}`,
    title: row.campaign_name,
    documentNumber: row.campaign_document_number,
    campaignStatus: row.campaign_status,
    actionLine: campaignCreatorActionLine(row),
    needsAction: campaignNeedsCreatorAction(row),
    dateLine: `${formatPortalDate(row.start_date)} → ${formatPortalDate(row.end_date)}`,
    deliverableLine:
      row.deliverable_total === 0
        ? "No deliverables assigned yet."
        : `${row.completed_deliverables} of ${row.deliverable_total} complete · ${remaining} remaining`,
    approvalLine:
      row.deliverable_total === 0
        ? "No approval status yet."
        : `${row.approved_deliverables} approved · ${row.published_deliverables} published`,
    publicationLine: campaignPublicationLine(row),
    paymentLine: row.vendor_payment_status
      ? `Payment: ${row.vendor_payment_status.replaceAll("_", " ")}`
      : "Payment: pending",
    insightLine,
  };
}
