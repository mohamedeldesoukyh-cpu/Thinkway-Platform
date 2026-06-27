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
import { QuotationStatusBadge } from "@/features/quotations/components/quotation-status-badge";
import { quotationDetailPath } from "@/features/quotations/constants";
import type { QuotationStatus } from "@/types/database";

import type { ShortlistLinkedQuotation } from "../types";

const ISSUED_STATUSES = new Set<QuotationStatus>([
  "sent",
  "approved",
  "accepted",
]);

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
              href={quotationDetailPath(q.id)}
              className="flex cursor-pointer items-center justify-between gap-2"
            >
              <span className="min-w-0 truncate font-mono text-xs">
                {q.serial_number ?? q.name}
              </span>
              <QuotationStatusBadge status={q.status} />
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : (
    <Button size="sm" asChild disabled={busy}>
      <Link href={quotationDetailPath(latest.id)}>
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
    <div className="rounded-2xl border border-border/80 bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Quotation
          </p>
          <p className="text-sm font-medium">
            {issued ? "Quotation issued" : "Quotation linked"}
          </p>
          <p className="text-xs text-muted-foreground">
            {quotationCountLabel(quotations.length)}
            {" · "}
            Latest version:{" "}
            <span className="font-mono text-foreground">
              {latest.serial_number ?? "—"}
            </span>
          </p>
          <QuotationStatusBadge status={latest.status} />
        </div>
        {actionButtons}
      </div>
    </div>
  );
}

export function ShortlistQuotationActions(props: Props) {
  return <ShortlistQuotationPanel {...props} actionsOnly />;
}
