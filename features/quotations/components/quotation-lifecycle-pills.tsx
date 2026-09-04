"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import type { QuotationDetail } from "@/features/quotations/types";
import { formatDesignDate } from "@/lib/design/format-design-date";

type Props = {
  detail: QuotationDetail;
  className?: string;
  trailing?: ReactNode;
  /** HTML `.tw-mb` lifecycle strip inside the masthead (discovery.html bar). */
  variant?: "pills" | "masthead";
};

export function QuotationLifecyclePills({
  detail,
  className,
  trailing,
  variant = "pills",
}: Props) {
  const shortlistLabel = detail.shortlist_id
    ? `Shortlist ${detail.shortlist_serial ?? detail.shortlist_id} · linked`
    : "Shortlist · not linked";

  const campaignLabel = detail.campaign_header_id
    ? `Campaign ${detail.campaign_document_number ?? ""} · linked`.trim()
    : "Campaign · not linked";

  const syncLabel = detail.sync_enabled ? "Live sync enabled" : "Snapshot locked";

  if (variant === "masthead") {
    const validity =
      detail.validity_date != null
        ? `validity ${formatDesignDate(detail.validity_date)}${
            detail.valid_days_remaining != null
              ? `, ${detail.valid_days_remaining} day${detail.valid_days_remaining === 1 ? "" : "s"} remaining`
              : ""
          }`
        : null;
    const msg = [shortlistLabel.replace(" · linked", " linked").replace(" · not linked", " not linked"), campaignLabel.toLowerCase()].join(" · ");
    const sub = [syncLabel, validity].filter(Boolean).join(" · ");

    return (
      <>
        <span className="lb">Lifecycle</span>
        <span>
          <span className="msg">{msg}</span>
          {sub ? <span className="sub"> {sub}</span> : null}
        </span>
        <span className="tw-sp" />
        {detail.shortlist_id ? (
          <Link href={`/discovery/shortlists/${detail.shortlist_id}`} className="go">
            Open shortlist
          </Link>
        ) : trailing ? (
          trailing
        ) : null}
      </>
    );
  }

  return (
    <div
      className={cn(
        "discovery-suite mx-[22px] mb-2 flex flex-wrap items-center gap-2",
        className
      )}
      aria-label="Quotation lifecycle"
    >
      {detail.shortlist_id ? (
        <Link
          href={`/discovery/shortlists/${detail.shortlist_id}`}
          className="tw-p p-b transition-opacity hover:opacity-80"
        >
          {shortlistLabel}
        </Link>
      ) : (
        <span className="tw-p p-n">{shortlistLabel}</span>
      )}
      {detail.campaign_header_id ? (
        <Link
          href={`/campaigns/${detail.campaign_header_id}`}
          className="tw-p p-b transition-opacity hover:opacity-80"
        >
          {campaignLabel}
        </Link>
      ) : (
        <span className="tw-p p-n">{campaignLabel}</span>
      )}
      <span className={cn("tw-p", detail.sync_enabled ? "p-g" : "p-n")}>
        {syncLabel}
      </span>
      <span className="tw-sp" />
      {trailing}
    </div>
  );
}
