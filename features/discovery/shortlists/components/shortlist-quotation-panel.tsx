"use client";

import Link from "next/link";
import { ChevronDownIcon, ExternalLinkIcon, FileTextIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QuotationListStatusPill } from "@/features/quotations/components/quotation-list-status-pill";
import { quotationDetailPath } from "@/features/quotations/constants";
import type { QuotationStatus } from "@/types/database";

import type { ShortlistLinkedQuotation } from "../types";

const ISSUED_STATUSES = new Set<QuotationStatus>([
  "sent",
  "approved",
  "accepted",
]);

function formatDisplayVersion(versionNumber: number): string {
  return `v${versionNumber}`;
}

function quotationCountLabel(count: number): string {
  return count === 1 ? "1 quotation linked" : `${count} quotations linked`;
}

type Props = {
  quotations: ShortlistLinkedQuotation[];
  onGenerateNewVersion: () => void;
  busy?: boolean;
  /** When true, render compact action buttons only (creators toolbar). */
  actionsOnly?: boolean;
};

export function ShortlistQuotationPanel({
  quotations,
  onGenerateNewVersion,
  busy,
  actionsOnly,
}: Props) {
  if (quotations.length === 0) return null;

  const latest = quotations[0];
  const issued = ISSUED_STATUSES.has(latest.status);
  const multiple = quotations.length > 1;
  const detailHref = quotationDetailPath(latest.id, latest.serial_number);
  const displayVersion = formatDisplayVersion(latest.version_number);

  const openButton = multiple ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" disabled={busy}>
          <ExternalLinkIcon className="size-4" />
          Open quotation
          <ChevronDownIcon className="size-3.5 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Linked quotations</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {quotations.map((q) => (
          <DropdownMenuItem key={q.id} asChild>
            <Link
              href={quotationDetailPath(q.id, q.serial_number)}
              className="flex cursor-pointer items-center justify-between gap-2"
            >
              <span className="min-w-0 truncate font-mono text-xs">
                {q.serial_number ?? q.name}
              </span>
              <QuotationListStatusPill status={q.status} />
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : (
    <Button size="sm" asChild disabled={busy}>
      <Link href={detailHref}>
        <ExternalLinkIcon className="size-4" />
        Open quotation
      </Link>
    </Button>
  );

  const actionButtons = (
    <div className="flex flex-wrap items-center gap-2">
      {openButton}
      <Button size="sm" variant="outline" onClick={onGenerateNewVersion} disabled={busy}>
        <FileTextIcon className="size-4" />
        Generate new version
      </Button>
    </div>
  );

  if (actionsOnly) {
    return actionButtons;
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--tw-border)] bg-background p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-[0.4px] text-[var(--text-3)]">
            Quotation
          </p>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {issued ? "Quotation issued" : "Quotation linked"}
              {latest.serial_number ? (
                <>
                  {" · "}
                  <Link
                    href={detailHref}
                    className="font-mono text-[12.5px] font-bold text-[var(--blue-text)] hover:underline"
                  >
                    {latest.serial_number}
                  </Link>
                </>
              ) : null}
            </p>
            <p className="text-xs text-[var(--text-3)]">
              {quotationCountLabel(quotations.length)}
              {" · "}
              Latest version:{" "}
              <span className="font-mono font-semibold text-foreground">
                {displayVersion}
              </span>
            </p>
          </div>
          <QuotationListStatusPill status={latest.status} />
        </div>
        {actionButtons}
      </div>
    </div>
  );
}

export function ShortlistQuotationActions(props: Props) {
  return <ShortlistQuotationPanel {...props} actionsOnly />;
}
