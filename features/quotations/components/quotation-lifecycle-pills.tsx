"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import type { QuotationDetail } from "@/features/quotations/types";

type Props = {
  detail: QuotationDetail;
  className?: string;
  trailing?: ReactNode;
};

function LifecyclePill({
  label,
  tone,
  pulse,
  href,
}: {
  label: string;
  tone: "blue" | "gray" | "green";
  pulse?: boolean;
  href?: string;
}) {
  const pill = (
    <span
      className={cn(
        "chip",
        tone === "blue" && "link",
        tone === "green" && "ok",
        tone === "gray" && "mut"
      )}
    >
      <span className={cn("d", pulse && "animate-pulse")} aria-hidden />
      {label}
    </span>
  );

  if (href) {
    return (
      <Link href={href} className="transition-opacity hover:opacity-80">
        {pill}
      </Link>
    );
  }

  return pill;
}

export function QuotationLifecyclePills({ detail, className, trailing }: Props) {
  const shortlistLabel = detail.shortlist_id
    ? `Shortlist ${detail.shortlist_serial ?? detail.shortlist_id} · Linked`
    : "Shortlist · Not linked";

  const campaignLabel = detail.campaign_header_id
    ? `Campaign ${detail.campaign_document_number ?? ""} · Linked`.trim()
    : "Campaign · Not linked";

  const syncLabel = detail.sync_enabled ? "Live sync enabled" : "Snapshot locked";

  return (
    <div className={cn("lcband", className)} aria-label="Quotation lifecycle">
      <span className="lclabel">Lifecycle</span>
      {detail.shortlist_id ? (
        <LifecyclePill
          label={shortlistLabel}
          tone="blue"
          href={`/discovery/shortlists/${detail.shortlist_id}`}
        />
      ) : (
        <LifecyclePill label={shortlistLabel} tone="gray" />
      )}
      {detail.campaign_header_id ? (
        <LifecyclePill
          label={campaignLabel}
          tone="blue"
          href={`/campaigns/${detail.campaign_header_id}`}
        />
      ) : (
        <LifecyclePill label={campaignLabel} tone="gray" />
      )}
      <LifecyclePill
        label={syncLabel}
        tone={detail.sync_enabled ? "green" : "gray"}
        pulse={detail.sync_enabled}
      />
      {trailing}
    </div>
  );
}
