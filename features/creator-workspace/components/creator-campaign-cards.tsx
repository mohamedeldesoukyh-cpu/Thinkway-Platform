import Link from "next/link";

import {
  campaignDeliveredPercent,
  campaignStatusPill,
  paymentPendingPill,
} from "@/features/creator-workspace/chrome";
import { CreatorPlatformMark } from "@/features/creator-workspace/components/creator-platform-mark";
import {
  CreatorEmpty,
  CreatorMeter,
  CreatorRowChevron,
} from "@/features/creator-workspace/components/creator-workspace-ui";
import { formatPortalDate } from "@/features/portals/components/portal-table-utils";
import type { CreatorCampaignRow } from "@/features/portals/types";

export function CreatorCampaignCards({
  rows,
  emptyTitle = "No assigned campaigns yet",
  emptyDescription = "When Thinkway assigns you to a campaign it appears here with the brief, deliverables and fee.",
}: {
  rows: CreatorCampaignRow[];
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (rows.length === 0) {
    return <CreatorEmpty title={emptyTitle} description={emptyDescription} />;
  }
  return (
    <>
      {rows.map((row) => (
        <CreatorCampaignRow key={row.assignment_id} row={row} />
      ))}
    </>
  );
}

export function CreatorCampaignRow({ row }: { row: CreatorCampaignRow }) {
  const status = campaignStatusPill(row.campaign_status);
  const payment = paymentPendingPill(row.vendor_payment_status);
  const percent = campaignDeliveredPercent(row.published_deliverables, row.deliverable_total);
  const delivered =
    row.deliverable_total > 0
      ? ` · ${row.published_deliverables} of ${row.deliverable_total} delivered`
      : "";

  return (
    <Link href={`/creator-portal/campaigns/${row.campaign_header_id}`} className="row">
      <span className="row__b">
        <span className="row__t">{row.campaign_name}</span>
        <span className="row__m">
          {row.campaign_document_number} · {formatPortalDate(row.start_date)} →{" "}
          {formatPortalDate(row.end_date)}
          {delivered}
        </span>
      </span>
      <CreatorMeter percent={percent} />
      <span className="row__x">
        <span className={status.className}>{status.label}</span>
        <span className={payment.className}>{payment.label}</span>
      </span>
      <CreatorRowChevron />
    </Link>
  );
}

export function CreatorDeliverableNavRow({
  href,
  title,
  meta,
  platform,
  statusClassName,
  statusLabel,
}: {
  href: string;
  title: string;
  meta: string;
  platform: string | null;
  statusClassName: string;
  statusLabel: string;
}) {
  return (
    <Link href={href} className="row">
      <CreatorPlatformMark platform={platform} size={30} />
      <span className="row__b">
        <span className="row__t">{title}</span>
        <span className="row__m">{meta}</span>
      </span>
      <span className="row__x">
        <span className={statusClassName}>{statusLabel}</span>
      </span>
      <CreatorRowChevron />
    </Link>
  );
}
