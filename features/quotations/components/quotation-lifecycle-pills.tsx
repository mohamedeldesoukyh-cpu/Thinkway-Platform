"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";
import type { QuotationDetail } from "@/features/quotations/types";

type Props = {
  detail: QuotationDetail;
  className?: string;
};

function LifecyclePill({
  label,
  tone,
  pulse,
}: {
  label: string;
  tone: "blue" | "gray" | "green";
  pulse?: boolean;
}) {
  const toneClass =
    tone === "blue"
      ? "bg-[var(--camp-blue-light)] text-[var(--camp-blue-text)]"
      : tone === "green"
        ? "bg-[var(--camp-green-bg)] text-[var(--camp-green-text)]"
        : "border border-[var(--camp-border)] bg-[var(--camp-surface)] text-[var(--camp-text-2)]";

  const dotClass =
    tone === "blue"
      ? "bg-[var(--camp-blue)]"
      : tone === "green"
        ? "bg-[var(--camp-green)]"
        : "bg-[var(--camp-text-3)]";

  return (
    <span className={cn("thinkway-campaign-sh-pill", toneClass)}>
      <span
        className={cn("thinkway-campaign-sh-dot", dotClass, pulse && "pulse")}
        aria-hidden
      />
      {label}
    </span>
  );
}

export function QuotationLifecyclePills({ detail, className }: Props) {
  const shortlistLabel = detail.shortlist_id
    ? `Shortlist ${detail.shortlist_serial ?? detail.shortlist_id} · Linked`
    : "Shortlist · Not linked";

  const campaignLabel = detail.campaign_header_id
    ? `Campaign ${detail.campaign_document_number ?? ""} · Linked`.trim()
    : "Campaign · Not linked";

  const syncLabel = detail.sync_enabled ? "Live sync enabled" : "Snapshot locked";

  return (
    <div
      className={cn(
        "thinkway-campaign-sync-health thinkway-campaign-sync-health--header",
        className
      )}
      aria-label="Quotation lifecycle"
    >
      <span className="thinkway-campaign-sh-title">Lifecycle</span>
      <div className="thinkway-campaign-sh-pills">
        {detail.shortlist_id ? (
          <Link href={`/discovery/shortlists/${detail.shortlist_id}`}>
            <LifecyclePill label={shortlistLabel} tone="blue" />
          </Link>
        ) : (
          <LifecyclePill label={shortlistLabel} tone="gray" />
        )}
        {detail.campaign_header_id ? (
          <Link href={`/campaigns/${detail.campaign_header_id}`}>
            <LifecyclePill label={campaignLabel} tone="blue" />
          </Link>
        ) : (
          <LifecyclePill label={campaignLabel} tone="gray" />
        )}
        <LifecyclePill
          label={syncLabel}
          tone={detail.sync_enabled ? "green" : "gray"}
          pulse={detail.sync_enabled}
        />
      </div>
    </div>
  );
}
